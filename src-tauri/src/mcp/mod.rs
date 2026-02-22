use crate::auth;
use crate::automation;
use crate::model::User;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::get;
use lazy_static::lazy_static;
use reqwest::StatusCode;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::StreamableHttpService;
use rmcp::transport::StreamableHttpServerConfig;
use rmcp::{
    handler::server::{tool::ToolCallContext, tool::ToolRouter, wrapper::Parameters},
    model::*,
    tool, tool_router, ErrorData, Json, ServerHandler,
};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

lazy_static! {
    static ref MCP_SERVER_TOKEN: Mutex<Option<CancellationToken>> = Mutex::new(None);
    static ref MCP_STATUS: Mutex<McpStatus> = Mutex::new(McpStatus {
        is_running: false,
        port: 0,
        token: None,
    });
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpStatus {
    pub is_running: bool,
    pub port: u16,
    pub token: Option<String>,
}

// A simple token store
#[derive(Clone)]
struct TokenStore {
    valid_token: Option<String>,
}

impl TokenStore {
    fn is_valid(&self, token: &str) -> bool {
        match &self.valid_token {
            Some(valid) => valid == token,
            None => false,
        }
    }
}

// Extract authorization token from headers
fn extract_token_from_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|auth_header| {
            auth_header
                .strip_prefix("Bearer ")
                .map(|stripped| stripped.to_string())
        })
}

// Authorization middleware
async fn auth_middleware(
    State(token_store): State<Arc<TokenStore>>,
    request: axum::extract::Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let headers = request.headers();

    // 1. 优先尝试从 Header 获取 (Bearer)
    let mut token = extract_token_from_header(headers);

    // 2. 如果 Header 没有，尝试从 Path 获取 (格式: /mcp/TOKEN)
    if token.is_none() {
        let path = request.uri().path();
        // 匹配 /mcp/TOKEN/...
        if path.starts_with("/mcp/") {
            let parts: Vec<&str> = path.split('/').collect();
            // path 是 /mcp/TOKEN 所以 split 结果是 ["", "mcp", "TOKEN"]
            if parts.len() >= 3 && !parts[2].is_empty() {
                token = Some(parts[2].to_string());
            }
        }
    }

    // 3. 兜底尝试从 Query 获取
    if token.is_none() {
        if let Some(query) = request.uri().query() {
            let params: std::collections::HashMap<String, String> =
                serde_urlencoded::from_str(query).unwrap_or_default();
            token = params.get("token").cloned();
        }
    }

    match token {
        Some(t) if token_store.is_valid(&t) => {
            // Token is valid, proceed with the request
            Ok(next.run(request).await)
        }
        _ => {
            // Token is invalid, return 401 error
            println!(
                "MCP: Unauthorized access attempt (Method: {}, URI: {})",
                request.method(),
                request.uri()
            );
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct StartLoginArgs {
    pub phone: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct SubmitCodeArgs {
    pub phone: String,
    pub code: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct GetUserInfoParams {
    /// 用户名(昵称)或手机号
    pub query: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct PublishPostArgs {
    pub phone: String,
    pub title: String,
    pub content: String,
    pub images: Vec<String>,
    pub cover_image: Option<String>,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct ValidateLoginArgs {
    pub phone: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct LogoutArgs {
    pub phone: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct SwitchAccountArgs {
    pub phone: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct ImportNetworkImagesArgs {
    pub urls: Vec<String>,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct ImportLocalImagesArgs {
    pub paths: Vec<String>,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct StringOutput {
    pub result: String,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct SingleUserOutput {
    pub user: User,
}

#[derive(Serialize, Deserialize, schemars::JsonSchema)]
pub struct UsersOutput {
    pub users: Vec<User>,
}

#[derive(Clone)]
pub struct XhsMcpTools {
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl XhsMcpTools {
    pub fn new() -> Self {
        let router = Self::tool_router();
        println!(
            "MCP: XhsMcpTools::new() - Router has {} tools",
            router.list_all().len()
        );
        Self {
            tool_router: router,
        }
    }

    #[tool(name = "start_login", description = "开始登录流程,发送验证码")]
    async fn start_login(
        &self,
        params: Parameters<StartLoginArgs>,
    ) -> Result<Json<StringOutput>, ErrorData> {
        let message = auth::start_login_process(params.0.phone)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;
        Ok(Json(StringOutput { result: message }))
    }

    #[tool(name = "submit_code", description = "提交验证码完成登录")]
    async fn submit_code(
        &self,
        params: Parameters<SubmitCodeArgs>,
    ) -> Result<Json<SingleUserOutput>, ErrorData> {
        let user = auth::submit_verification_code(params.0.phone, params.0.code)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;
        Ok(Json(SingleUserOutput { user }))
    }

    #[tool(name = "list_users", description = "获取已登录的用户列表")]
    async fn list_users(&self) -> Result<Json<UsersOutput>, ErrorData> {
        let users = auth::get_users()
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;
        Ok(Json(UsersOutput { users }))
    }

    #[tool(
        name = "get_user_info",
        description = "根据用户名或手机号获取指定用户信息"
    )]
    async fn get_user_info(
        &self,
        params: Parameters<GetUserInfoParams>,
    ) -> Result<Json<SingleUserOutput>, ErrorData> {
        // ✅ 改为 SingleUserOutput
        let user = auth::find_user(params.0.query)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // ✅ 如果找不到用户,返回错误
        match user {
            Some(u) => Ok(Json(SingleUserOutput { user: u })),
            None => Err(ErrorData::new(
                ErrorCode(-1),
                "User not found".to_string(),
                None,
            )),
        }
    }

    #[tool(
        name = "publish_post",
        description = "发布笔记到小红书. 需要手机号, 标题, 内容, 和图片列表."
    )]
    async fn publish_post(
        &self,
        params: Parameters<PublishPostArgs>,
    ) -> Result<Json<StringOutput>, ErrorData> {
        let args = params.0;
        automation::publish_post(
            args.phone,
            args.title,
            args.content,
            args.images,
            args.cover_image,
        )
        .await
        .map_err(|e| ErrorData::internal_error(e, None))?;

        Ok(Json(StringOutput {
            result: "发布任务已提交".to_string(),
        }))
    }

    #[tool(
        name = "validate_login_status",
        description = "验证指定手机号的登录状态"
    )]
    async fn validate_login_status(
        &self,
        params: Parameters<ValidateLoginArgs>,
    ) -> Result<Json<SingleUserOutput>, ErrorData> {
        let user = automation::validate_login_status(params.0.phone)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;

        Ok(Json(SingleUserOutput { user }))
    }

    #[tool(name = "logout_user", description = "退出登录并删除本地账号数据")]
    async fn logout_user(
        &self,
        params: Parameters<LogoutArgs>,
    ) -> Result<Json<StringOutput>, ErrorData> {
        auth::logout_user(params.0.phone)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;

        Ok(Json(StringOutput {
            result: "已退出登录并清理本地数据".to_string(),
        }))
    }

    #[tool(
        name = "switch_account",
        description = "切换到指定手机号的账号进行后续操作"
    )]
    async fn switch_account(
        &self,
        params: Parameters<SwitchAccountArgs>,
    ) -> Result<Json<SingleUserOutput>, ErrorData> {
        let user = auth::find_user(params.0.phone)
            .await
            .map_err(|e| ErrorData::internal_error(e, None))?;

        match user {
            Some(u) => Ok(Json(SingleUserOutput { user: u })),
            None => Err(ErrorData::new(
                ErrorCode(-1),
                "Account not found or not logged in".to_string(),
                None,
            )),
        }
    }

    #[tool(
        name = "import_network_images",
        description = "下载网络图片到本地,并移动到素材库"
    )]
    async fn import_network_images(
        &self,
        params: Parameters<ImportNetworkImagesArgs>,
    ) -> Result<Json<StringOutput>, ErrorData> {
        let urls = params.0.urls;
        let images_dir = crate::storage::get_images_dir();
        let client = reqwest::Client::new();
        let mut count = 0;
        let mut saved_paths = Vec::new();

        for url_str in urls {
            let extension = if url_str.to_lowercase().contains(".jpg")
                || url_str.to_lowercase().contains(".jpeg")
            {
                "jpg"
            } else if url_str.to_lowercase().contains(".webp") {
                "webp"
            } else if url_str.to_lowercase().contains(".gif") {
                "gif"
            } else {
                "png"
            };

            let filename = format!(
                "net_imported_{}_{}.{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
                uuid::Uuid::new_v4()
                    .to_string()
                    .chars()
                    .take(8)
                    .collect::<String>(),
                extension
            );

            let mut dest_path = images_dir.clone();
            dest_path.push(filename);

            let response = match client.get(&url_str).send().await {
                Ok(res) => res,
                Err(e) => {
                    println!("MCP: Error downloading {}: {}", url_str, e);
                    continue;
                }
            };

            if response.status().is_success() {
                if let Ok(bytes) = response.bytes().await {
                    if let Err(e) = std::fs::write(&dest_path, bytes) {
                        println!("MCP: Error saving {}: {}", dest_path.display(), e);
                    } else {
                        saved_paths.push(dest_path.to_string_lossy().to_string());
                        count += 1;
                    }
                }
            } else {
                println!(
                    "MCP: Error downloading {}, status: {}",
                    url_str,
                    response.status()
                );
            }
        }

        Ok(Json(StringOutput {
            result: format!(
                "成功导入 {} 张网络图片到素材库.\n图片路径:\n{}",
                count,
                saved_paths.join("\n")
            ),
        }))
    }

    #[tool(name = "import_local_images", description = "移动本地图片到素材库")]
    async fn import_local_images(
        &self,
        params: Parameters<ImportLocalImagesArgs>,
    ) -> Result<Json<StringOutput>, ErrorData> {
        let paths = params.0.paths;
        let images_dir = crate::storage::get_images_dir();
        let mut count = 0;
        let mut saved_paths = Vec::new();

        for path_str in paths {
            let source_path = std::path::Path::new(&path_str);
            if !source_path.exists() {
                println!("MCP: Error importing {}: file does not exist", path_str);
                continue;
            }

            let extension = source_path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("png");

            let filename = format!(
                "imported_{}_{}.{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
                uuid::Uuid::new_v4()
                    .to_string()
                    .chars()
                    .take(8)
                    .collect::<String>(),
                extension
            );

            let mut dest_path = images_dir.clone();
            dest_path.push(filename);

            match std::fs::copy(source_path, &dest_path) {
                Ok(_) => {
                    saved_paths.push(dest_path.to_string_lossy().to_string());
                    count += 1;
                }
                Err(e) => {
                    println!("MCP: Error copying {}: {}", path_str, e);
                }
            }
        }

        Ok(Json(StringOutput {
            result: format!(
                "成功导入 {} 张本地图片到素材库.\n图片路径:\n{}",
                count,
                saved_paths.join("\n")
            ),
        }))
    }
}

impl ServerHandler for XhsMcpTools {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::LATEST,
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: "小红书 MCP".to_string(),
                title: Some("小红书自动化创作助手 MCP 服务".to_string()),
                version: "0.1".to_string(),
                icons: None,
                website_url: Some("https://itbug.shop".to_string()),
            },
            instructions: Some("小红书创作助手 MCP 服务".to_string()),
        }
    }

    fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: rmcp::service::RequestContext<rmcp::RoleServer>,
    ) -> impl Future<Output = Result<ListToolsResult, rmcp::ErrorData>> + Send + '_ {
        let tools = self.tool_router.list_all();
        println!("MCP: list_tools called, returning {} tools", tools.len());
        for t in &tools {
            println!("  - {}", t.name);
        }
        std::future::ready(Ok(ListToolsResult {
            tools,
            next_cursor: None,
            meta: None,
        }))
    }

    fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: rmcp::service::RequestContext<rmcp::RoleServer>,
    ) -> impl Future<Output = Result<CallToolResult, rmcp::ErrorData>> + Send + '_ {
        let context = ToolCallContext::new(self, request, context);
        self.tool_router.call(context)
    }
}

// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
#[tauri::command]
pub async fn start_mcp_server(port: u16, token: Option<String>) -> Result<(), String> {
    let mut token_lock = MCP_SERVER_TOKEN.lock().await;
    if token_lock.is_some() {
        return Err("MCP server is already running".to_string());
    }

    let cancel_token = CancellationToken::new();
    let cancel_token_for_shutdown = cancel_token.clone();

    // 生成或使用提供的 token
    let auth_token = token.unwrap_or_else(|| Uuid::new_v4().to_string());
    let token_store = Arc::new(TokenStore {
        valid_token: Some(auth_token.clone()),
    });

    // 创建服务
    let service = StreamableHttpService::new(
        || Ok(XhsMcpTools::new()),
        LocalSessionManager::default().into(),
        StreamableHttpServerConfig::default(),
    );
    // 使用 Axum
    let app = axum::Router::new()
        .route("/health", get(health_check))
        // 使用动态路径支持鉴权信息持久化在 URL 中
        .nest_service("/mcp", service)
        .layer(middleware::from_fn_with_state(
            token_store.clone(),
            auth_middleware,
        ))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| e.to_string())?;

    // 存储 token
    *token_lock = Some(cancel_token);

    // 更新状态
    let mut status = MCP_STATUS.lock().await;
    status.is_running = true;
    status.port = port;
    status.token = Some(auth_token);
    drop(status); // 释放锁
    drop(token_lock); // 释放锁

    // 在后台启动服务器
    tokio::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            cancel_token_for_shutdown.cancelled().await;
        });

        if let Err(e) = server.await {
            eprintln!("MCP server error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_mcp_server() -> Result<(), String> {
    let mut token_lock = MCP_SERVER_TOKEN.lock().await;
    if let Some(token) = token_lock.take() {
        token.cancel();
    }

    let mut status = MCP_STATUS.lock().await;
    status.is_running = false;
    status.port = 0;
    status.token = None;

    Ok(())
}

#[tauri::command]
pub async fn get_mcp_status() -> Result<McpStatus, String> {
    let status = MCP_STATUS.lock().await;
    Ok(status.clone())
}
