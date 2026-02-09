use crate::auth;
use crate::automation;
use crate::model::User;
use lazy_static::lazy_static;
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
use std::time::Duration;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

lazy_static! {
    static ref MCP_SERVER_TOKEN: Mutex<Option<CancellationToken>> = Mutex::new(None);
    static ref MCP_STATUS: Mutex<McpStatus> = Mutex::new(McpStatus {
        is_running: false,
        port: 0,
    });
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpStatus {
    pub is_running: bool,
    pub port: u16,
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

#[tauri::command]
pub async fn start_mcp_server(port: u16) -> Result<(), String> {
    let mut token_lock = MCP_SERVER_TOKEN.lock().await;
    if token_lock.is_some() {
        return Err("MCP server is already running".to_string());
    }

    let cancel_token = CancellationToken::new();
    let cancel_token_for_shutdown = cancel_token.clone();

    // 创建 SSE 服务配置
    let config = StreamableHttpServerConfig {
        // SSE 心跳间隔（保持连接活跃）
        sse_keep_alive: Some(Duration::from_secs(15)),
        // SSE 重试间隔（用于断线重连）
        sse_retry: Some(Duration::from_secs(3)),
        // 启用有状态模式（保持会话）
        stateful_mode: true,
        // 取消令牌
        cancellation_token: cancel_token.clone(),
    };

    // 创建服务
    let service = StreamableHttpService::new(
        || Ok(XhsMcpTools::new()), // 服务工厂
        LocalSessionManager::default().into(),
        config,
    );
    // 使用 Axum
    let app = axum::Router::new().nest_service("/mcp", service);

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| e.to_string())?;

    // 存储 token
    *token_lock = Some(cancel_token);

    // 更新状态
    let mut status = MCP_STATUS.lock().await;
    status.is_running = true;
    status.port = port;
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

    Ok(())
}

#[tauri::command]
pub async fn get_mcp_status() -> Result<McpStatus, String> {
    let status = MCP_STATUS.lock().await;
    Ok(status.clone())
}
