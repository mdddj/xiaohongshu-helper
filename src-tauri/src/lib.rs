pub mod ai;
pub mod analytics;
pub mod api_server;
pub mod auth;
pub mod automation;
pub mod mcp;
pub mod model;
pub mod storage;
pub mod util;

use std::sync::Arc;
use tauri_plugin_sql::Builder as SqlPluginBuilder;
use tokio::sync::RwLock;

// API 服务器状态
pub struct ApiServerHandle {
    pub is_running: Arc<RwLock<bool>>,
    pub port: u16,
    pub shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

lazy_static::lazy_static! {
    static ref API_SERVER_HANDLE: Arc<RwLock<Option<ApiServerHandle>>> = Arc::new(RwLock::new(None));
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_trends() -> Result<serde_json::Value, String> {
    let url = "https://agi.ylsap.com/links/v1/getdata";
    let client = reqwest::Client::new();

    let resp = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    let json = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = storage::sqlite::get_migrations();
    let db_path = storage::get_db_path();

    // 初始化数据库
    tauri::async_runtime::block_on(async {
        if let Err(e) = storage::sqlite::initialize_database().await {
            eprintln!("Failed to initialize database: {}", e);
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            SqlPluginBuilder::default()
                .add_migrations(&db_path, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            auth::start_login_process,
            auth::submit_verification_code,
            auth::clear_browser_session,
            auth::logout_user,
            auth::open_user_data_dir,
            auth::get_users,
            ai::generate_ai_text,
            ai::polish_title_with_options,
            ai::generate_ai_image,
            ai::get_ai_providers,
            ai::save_ai_provider,
            ai::delete_ai_provider,
            ai::save_config,
            ai::get_config_value,
            ai::list_local_images,
            ai::delete_local_image,
            ai::import_local_images,
            ai::test_ai_provider,
            ai::test_model_chat,
            ai::test_model_structured_output,
            ai::analyze_local_image,
            auth::save_post,
            auth::get_posts,
            auth::delete_post,
            automation::publish_post,
            automation::validate_login_status,
            analytics::fetch_user_analytics,
            get_trends,
            mcp::start_mcp_server,
            mcp::stop_mcp_server,
            mcp::get_mcp_status,
            start_api_server,
            stop_api_server,
            get_api_status,
            generate_api_key,
            save_api_key,
            get_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ============ API 服务器管理命令 ============

#[tauri::command]
async fn start_api_server(port: u16) -> Result<(), String> {
    let mut handle = API_SERVER_HANDLE.write().await;

    if let Some(h) = handle.as_ref() {
        let is_running = h.is_running.read().await;
        if *is_running {
            return Err("API 服务器已在运行中".to_string());
        }
    }

    // 检查端口是否可用
    if let Err(e) = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
        return Err(format!("端口 {} 不可用: {}", port, e));
    }

    // 获取 API Key
    let api_key = match ai::get_config_value("api_key".to_string()).await {
        Ok(Some(key)) => key,
        _ => {
            // 如果没有 API Key，生成一个新的
            let new_key = uuid::Uuid::new_v4().to_string();
            ai::save_config("api_key".to_string(), new_key.clone())
                .await
                .ok();
            new_key
        }
    };

    let is_running = Arc::new(RwLock::new(true));
    let is_running_clone = is_running.clone();

    // 创建关闭通道
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

    // 在后台启动服务器
    tokio::spawn(async move {
        println!("启动 API 服务器在端口 {}", port);
        match api_server::start_api_server(port, api_key, shutdown_rx).await {
            Ok(_) => {
                println!("API 服务器正常退出");
            }
            Err(e) => {
                eprintln!("API 服务器错误: {}", e);
            }
        }
        *is_running_clone.write().await = false;
    });

    *handle = Some(ApiServerHandle {
        is_running,
        port,
        shutdown_tx: Some(shutdown_tx),
    });

    Ok(())
}

#[tauri::command]
async fn stop_api_server() -> Result<(), String> {
    let mut handle = API_SERVER_HANDLE.write().await;

    if let Some(mut h) = handle.take() {
        // 发送关闭信号
        if let Some(tx) = h.shutdown_tx.take() {
            let _ = tx.send(());
        }

        // 设置运行状态为 false
        *h.is_running.write().await = false;

        // 等待一小段时间让服务器完全关闭
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        println!("API 服务器已停止");
        Ok(())
    } else {
        Err("API 服务器未运行".to_string())
    }
}

#[tauri::command]
async fn get_api_status() -> Result<serde_json::Value, String> {
    let handle = API_SERVER_HANDLE.read().await;

    if let Some(h) = handle.as_ref() {
        let is_running = *h.is_running.read().await;
        Ok(serde_json::json!({
            "is_running": is_running,
            "port": h.port
        }))
    } else {
        Ok(serde_json::json!({
            "is_running": false,
            "port": 8080
        }))
    }
}

#[tauri::command]
async fn generate_api_key() -> Result<String, String> {
    let new_key = uuid::Uuid::new_v4().to_string();
    ai::save_config("api_key".to_string(), new_key.clone()).await?;
    Ok(new_key)
}

#[tauri::command]
async fn save_api_key(key: String) -> Result<(), String> {
    ai::save_config("api_key".to_string(), key).await
}

#[tauri::command]
async fn get_api_key() -> Result<Option<String>, String> {
    ai::get_config_value("api_key".to_string()).await
}
