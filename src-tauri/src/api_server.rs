use crate::{ai, auth, automation};
use salvo::cors::{Cors, CorsHandler};
use salvo::oapi::extract::*;
use salvo::oapi::{EndpointOutRegister, ToSchema};
use salvo::prelude::*;
use serde::{Deserialize, Serialize};

// ============ 错误处理 ============

/// API 错误响应
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ApiError {
    /// 错误代码
    code: String,
    /// 错误消息
    message: String,
}

impl EndpointOutRegister for ApiError {
    fn register(components: &mut salvo::oapi::Components, operation: &mut salvo::oapi::Operation) {
        operation.responses.insert(
            "400",
            salvo::oapi::Response::new("请求参数错误")
                .add_content("application/json", ApiError::to_schema(components)),
        );
        operation.responses.insert(
            "401",
            salvo::oapi::Response::new("未授权 - API Key 无效或缺失")
                .add_content("application/json", ApiError::to_schema(components)),
        );
        operation.responses.insert(
            "500",
            salvo::oapi::Response::new("服务器内部错误")
                .add_content("application/json", ApiError::to_schema(components)),
        );
    }
}

// API Key 认证中间件
#[handler]
async fn auth_middleware(req: &mut Request, res: &mut Response, ctrl: &mut FlowCtrl) {
    // 从配置中读取 API Key
    let expected_key = match ai::get_config_value("api_key".to_string()).await {
        Ok(Some(key)) => key,
        _ => {
            res.status_code(StatusCode::UNAUTHORIZED);
            res.render(Json(serde_json::json!({
                "code": "UNAUTHORIZED",
                "message": "API key not configured"
            })));
            ctrl.skip_rest();
            return;
        }
    };

    let provided_key = req.headers().get("X-API-Key").and_then(|v| v.to_str().ok());

    if let Some(key) = provided_key {
        if key == expected_key.as_str() {
            return;
        }
    }

    res.status_code(StatusCode::UNAUTHORIZED);
    res.render(Json(serde_json::json!({
        "code": "UNAUTHORIZED",
        "message": "Invalid or missing API key"
    })));
    ctrl.skip_rest();
}

// ============ 用户管理 API ============

/// 开始登录请求
#[derive(Debug, Deserialize, ToSchema)]
struct StartLoginRequest {
    /// 手机号码
    #[salvo(schema(example = "13800138000"))]
    phone: String,
}

/// 提交验证码请求
#[derive(Debug, Deserialize, ToSchema)]
struct SubmitCodeRequest {
    /// 手机号码
    #[salvo(schema(example = "13800138000"))]
    phone: String,
    /// 验证码
    #[salvo(schema(example = "123456"))]
    code: String,
}

/// 登出请求
#[derive(Debug, Deserialize, ToSchema)]
struct LogoutRequest {
    /// 手机号码
    #[salvo(schema(example = "13800138000"))]
    phone: String,
}

/// 获取已登录用户列表
///
/// 返回所有已登录的小红书账号列表
#[endpoint(
    tags("用户管理"),
    responses(
        (status_code = 200, description = "成功获取用户列表", body = inline(serde_json::Value)),
        (status_code = 401, description = "未授权"),
        (status_code = 500, description = "服务器错误"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn get_users_api() -> Result<Json<serde_json::Value>, StatusError> {
    match auth::get_users().await {
        Ok(users) => Ok(Json(serde_json::json!({"users": users}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 开始登录流程
///
/// 发送验证码到指定手机号
#[endpoint(
    tags("用户管理"),
    responses(
        (status_code = 200, description = "验证码发送成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "请求参数错误"),
        (status_code = 500, description = "服务器错误"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn start_login_api(
    body: JsonBody<StartLoginRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::start_login_process(body.phone.clone()).await {
        Ok(msg) => Ok(Json(serde_json::json!({"message": msg}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 提交验证码完成登录
///
/// 使用手机号和验证码完成登录流程
#[endpoint(
    tags("用户管理"),
    responses(
        (status_code = 200, description = "登录成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "验证码错误"),
        (status_code = 500, description = "服务器错误"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn submit_code_api(
    body: JsonBody<SubmitCodeRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::submit_verification_code(body.phone.clone(), body.code.clone()).await {
        Ok(user) => Ok(Json(serde_json::json!({"user": user}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 退出登录
///
/// 退出指定账号并清除本地数据
#[endpoint(
    tags("用户管理"),
    responses(
        (status_code = 200, description = "登出成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "用户不存在"),
        (status_code = 500, description = "服务器错误"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn logout_api(body: JsonBody<LogoutRequest>) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::logout_user(body.phone.clone()).await {
        Ok(_) => Ok(Json(serde_json::json!({"success": true}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

// ============ AI 功能 API ============

/// AI 文本生成请求
#[derive(Debug, Deserialize, ToSchema)]
struct GenerateTextRequest {
    /// 提示词
    #[salvo(schema(example = "写一篇关于春天的小红书文案"))]
    prompt: String,
    /// AI 提供商 ID
    #[salvo(schema(example = 1))]
    provider_id: i64,
    /// 模型名称
    #[salvo(schema(example = "gpt-4o-mini"))]
    model_name: String,
}

/// AI 图片生成请求
#[derive(Debug, Deserialize, ToSchema)]
struct GenerateImageRequest {
    /// 图片描述提示词
    #[salvo(schema(example = "一只可爱的猫咪在花园里玩耍"))]
    prompt: String,
    /// AI 提供商 ID
    #[salvo(schema(example = 1))]
    provider_id: i64,
    /// 模型名称
    #[salvo(schema(example = "dall-e-3"))]
    model_name: String,
    /// 图片尺寸
    #[salvo(schema(example = "1024x1024"))]
    size: String,
}

/// 生成 AI 文本
///
/// 使用指定的 AI 模型生成文本内容
#[endpoint(
    tags("AI 功能"),
    responses(
        (status_code = 200, description = "生成成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 404, description = "提供商不存在"),
        (status_code = 500, description = "生成失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn generate_text_api(
    body: JsonBody<GenerateTextRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    let providers = ai::get_ai_providers()
        .await
        .map_err(|e| StatusError::internal_server_error().brief(e))?;
    let provider = providers
        .into_iter()
        .find(|p| p.id == Some(body.provider_id))
        .ok_or_else(|| StatusError::not_found().brief("Provider not found"))?;

    match ai::generate_ai_text(body.prompt.clone(), None, provider, body.model_name.clone()).await {
        Ok(text) => Ok(Json(serde_json::json!({"text": text}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 生成 AI 图片
///
/// 使用指定的 AI 模型生成图片
#[endpoint(
    tags("AI 功能"),
    responses(
        (status_code = 200, description = "生成成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 404, description = "提供商不存在"),
        (status_code = 500, description = "生成失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn generate_image_api(
    body: JsonBody<GenerateImageRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    let providers = ai::get_ai_providers()
        .await
        .map_err(|e| StatusError::internal_server_error().brief(e))?;
    let provider = providers
        .into_iter()
        .find(|p| p.id == Some(body.provider_id))
        .ok_or_else(|| StatusError::not_found().brief("Provider not found"))?;

    match ai::generate_ai_image(
        body.prompt.clone(),
        provider,
        body.model_name.clone(),
        Some(body.size.clone()),
    )
    .await
    {
        Ok(path) => Ok(Json(serde_json::json!({"image_path": path}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

// ============ 内容管理 API ============

/// 笔记/草稿
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct Post {
    /// 草稿 ID（新建时为空）
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<i64>,
    /// 标题
    #[salvo(schema(example = "春日限定｜这些地方太适合拍照了"))]
    title: String,
    /// 正文内容
    #[salvo(schema(example = "今天给大家分享几个超美的拍照地点..."))]
    content: String,
    /// 图片路径列表
    images: Vec<String>,
    /// 封面图片路径
    #[serde(skip_serializing_if = "Option::is_none")]
    cover_image: Option<String>,
    /// 用户 ID
    user_id: i64,
}

/// 保存草稿请求
#[derive(Debug, Deserialize, ToSchema)]
struct SavePostRequest {
    /// 用户 ID
    user_id: i64,
    /// 草稿内容
    post: Post,
}

/// 删除草稿请求
#[derive(Debug, Deserialize, ToSchema)]
struct DeletePostRequest {
    /// 草稿 ID
    post_id: i64,
}

/// 保存草稿
///
/// 保存或更新笔记草稿
#[endpoint(
    tags("内容管理"),
    responses(
        (status_code = 200, description = "保存成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 500, description = "保存失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn save_post_api(
    body: JsonBody<SavePostRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::save_post(
        body.user_id,
        body.post.title.clone(),
        body.post.content.clone(),
        body.post.images.clone(),
        body.post.cover_image.clone(),
    )
    .await
    {
        Ok(id) => Ok(Json(serde_json::json!({"id": id}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 获取草稿列表
///
/// 获取指定用户的所有草稿
#[endpoint(
    tags("内容管理"),
    parameters(
        ("user_id" = i64, Query, description = "用户 ID", example = 1)
    ),
    responses(
        (status_code = 200, description = "获取成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 500, description = "获取失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn get_posts_api(
    user_id: QueryParam<i64, true>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::get_posts(*user_id).await {
        Ok(posts) => Ok(Json(serde_json::json!({"posts": posts}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

/// 删除草稿
///
/// 删除指定的草稿
#[endpoint(
    tags("内容管理"),
    responses(
        (status_code = 200, description = "删除成功", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 404, description = "草稿不存在"),
        (status_code = 500, description = "删除失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn delete_post_api(
    body: JsonBody<DeletePostRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match auth::delete_post(body.post_id).await {
        Ok(_) => Ok(Json(serde_json::json!({"success": true}))),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

// ============ 发布功能 API ============

/// 发布笔记请求
#[derive(Debug, Deserialize, ToSchema)]
struct PublishPostRequest {
    /// 手机号
    #[salvo(schema(example = "13800138000"))]
    phone: String,
    /// 标题
    #[salvo(schema(example = "春日限定｜这些地方太适合拍照了"))]
    title: String,
    /// 正文内容
    #[salvo(schema(example = "今天给大家分享几个超美的拍照地点..."))]
    content: String,
    /// 图片路径列表
    images: Vec<String>,
    /// 封面图片路径
    #[serde(skip_serializing_if = "Option::is_none")]
    cover_image: Option<String>,
}

/// 发布笔记到小红书
///
/// 使用浏览器自动化将笔记发布到小红书平台
#[endpoint(
    tags("发布功能"),
    responses(
        (status_code = 200, description = "发布任务已提交", body = inline(serde_json::Value)),
        (status_code = 400, description = "参数错误"),
        (status_code = 401, description = "用户未登录"),
        (status_code = 500, description = "发布失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn publish_post_api(
    body: JsonBody<PublishPostRequest>,
) -> Result<Json<serde_json::Value>, StatusError> {
    match automation::publish_post(
        body.phone.clone(),
        body.title.clone(),
        body.content.clone(),
        body.images.clone(),
        body.cover_image.clone(),
    )
    .await
    {
        Ok(_) => Ok(Json(
            serde_json::json!({"success": true, "message": "发布任务已提交"}),
        )),
        Err(e) => Err(StatusError::internal_server_error().brief(e)),
    }
}

// ============ 趋势 API ============

/// 获取热门趋势
///
/// 获取小红书平台的热门话题和趋势
#[endpoint(
    tags("趋势"),
    responses(
        (status_code = 200, description = "获取成功", body = inline(serde_json::Value)),
        (status_code = 500, description = "获取失败"),
    ),
    security(
        ("api_key" = [])
    )
)]
async fn get_trends_api() -> Result<Json<serde_json::Value>, StatusError> {
    let url = "https://agi.ylsap.com/links/v1/getdata";
    let client = reqwest::Client::new();

    let resp = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| StatusError::internal_server_error().brief(e.to_string()))?;

    let json = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| StatusError::internal_server_error().brief(e.to_string()))?;

    Ok(Json(json))
}

// 创建 CORS 中间件
fn create_cors() -> CorsHandler {
    use salvo::http::Method;
    Cors::new()
        .allow_origin("*")
        .allow_methods(vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(vec!["Content-Type", "X-API-Key"])
        .into_handler()
}

// 启动 API 服务器
pub async fn start_api_server(
    port: u16,
    _api_key: String,
    shutdown_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error>> {
    // 创建路由
    let router = Router::new().hoop(create_cors()).push(
        Router::with_path("/api")
            .hoop(auth_middleware)
            .push(
                Router::with_path("/users")
                    .get(get_users_api)
                    .push(Router::with_path("/login/start").post(start_login_api))
                    .push(Router::with_path("/login/submit").post(submit_code_api))
                    .push(Router::with_path("/logout").post(logout_api)),
            )
            .push(
                Router::with_path("/ai")
                    .push(Router::with_path("/text").post(generate_text_api))
                    .push(Router::with_path("/image").post(generate_image_api)),
            )
            .push(
                Router::with_path("/posts")
                    .get(get_posts_api)
                    .post(save_post_api)
                    .push(Router::with_path("/delete").post(delete_post_api))
                    .push(Router::with_path("/publish").post(publish_post_api)),
            )
            .push(Router::with_path("/trends").get(get_trends_api)),
    );

    // 创建 OpenAPI 文档
    let doc = OpenApi::new("小红书助手 API", "1.0.0").merge_router(&router);

    // 添加 OpenAPI 文档路由
    let router = router
        .unshift(doc.into_router("/api-doc/openapi.json"))
        .unshift(SwaggerUi::new("/api-doc/openapi.json").into_router("/swagger-ui"));

    let acceptor = TcpListener::new(format!("127.0.0.1:{}", port)).bind().await;

    // 使用 graceful shutdown
    let server = Server::new(acceptor);

    // 在单独的任务中运行服务器
    let server_handle = tokio::spawn(async move {
        server.serve(router).await;
    });

    // 等待关闭信号
    let _ = shutdown_rx.await;

    println!("收到关闭信号,正在停止 API 服务器...");

    // 中止服务器任务
    server_handle.abort();

    // 等待任务完成
    let _ = server_handle.await;

    println!("API 服务器已完全停止");

    Ok(())
}
