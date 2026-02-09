use crate::automation::take_screenshot;
use crate::storage::{get_browser_data_dir, get_db_path};
use headless_chrome::browser::default_executable;
use headless_chrome::{Browser, LaunchOptions, Tab};
use lazy_static::lazy_static;
use serde::Deserialize;
use sqlx::{sqlite::SqlitePoolOptions, Row};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;

// 小红书用户信息结构
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XhsUserInfo {
    pub user_id: String,
    pub user_name: String,
    pub user_avatar: String,
    pub red_id: String,
    pub phone: String,
    pub role: String,
}

// 用于保存在进行的登录会话
#[derive(Clone)]
pub struct LoginSession {
    pub tab: Arc<Tab>,
    pub browser: Browser,
    pub phone: String,
    pub data_dir: PathBuf,
}

lazy_static! {
    pub static ref BROWSER_SESSIONS: Mutex<HashMap<String, LoginSession>> =
        Mutex::new(HashMap::new());
}

pub fn get_active_session(phone: &str) -> Option<LoginSession> {
    let sessions = BROWSER_SESSIONS.lock().unwrap();
    sessions.get(phone).cloned()
}

#[tauri::command]
pub async fn start_login_process(phone: String) -> Result<String, String> {
    println!("开始登录流程: {:?}", phone);

    // 先检查账号是否已经登录
    println!("检查账号 {} 是否已登录...", phone);
    match crate::automation::validate_login_status(phone.clone()).await {
        Ok(user) => {
            println!(
                "账号 {} 已登录，昵称: {}，跳过登录流程",
                phone, user.nickname
            );
            return Ok(format!(
                "already_logged_in:{}",
                serde_json::to_string(&user).unwrap_or_default()
            ));
        }
        Err(e) => {
            println!("账号 {} 未登录或登录已过期: {}，开始登录流程", phone, e);
        }
    }

    // 未登录，执行正常的登录流程
    println!("开始新的登录流程: {:?}", phone);
    let data_dir = get_browser_data_dir(&phone);

    // 启动前先清理可能的 SingletonLock 锁文件，防止进程卡死
    crate::storage::clear_browser_lock(&phone);

    // 获取无头模式设置
    let headless = crate::ai::get_headless_mode().await;

    let browser = Browser::new(
        LaunchOptions::default_builder()
            .headless(headless)
            .user_data_dir(Some(data_dir.clone()))
            .path(Some(default_executable().unwrap()))
            .window_size(Some((1920, 1080)))
            .enable_gpu(false)
            .args(vec![
                std::ffi::OsStr::new("--disable-extensions"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--no-first-run"),
                std::ffi::OsStr::new("--no-default-browser-check"),
            ])
            .build()
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    println!("创建浏览器完毕,开始执行登录流程");
    let tab = browser.new_tab().map_err(|e| e.to_string())?;
    tab.navigate_to("https://creator.xiaohongshu.com/login")
        .map_err(|e| e.to_string())?;

    take_screenshot(&tab, "登录页面start01");
    sleep(Duration::from_secs(3)).await;
    take_screenshot(&tab, "登录页面start02");
    // 等待手机号输入框并输入
    let phone_input = tab
        .wait_for_element("input[placeholder='手机号']")
        .map_err(|e| e.to_string())?;
    phone_input.type_into(&phone).map_err(|e| e.to_string())?;

    // 点击发送验证码
    let code_button = tab
        .wait_for_elements_by_xpath("//div[text()='发送验证码']")
        .map_err(|e| e.to_string())?
        .into_iter()
        .next()
        .ok_or("无法找到发送验证码按钮")?;
    code_button.click().map_err(|e| e.to_string())?;

    // 保存会话到全局 Map
    let mut sessions = BROWSER_SESSIONS.lock().unwrap();
    sessions.insert(
        phone.clone(),
        LoginSession {
            tab,
            browser,
            phone,
            data_dir,
        },
    );

    Ok("Verification code sent".to_string())
}

#[tauri::command]
pub async fn submit_verification_code(
    phone: String,
    code: String,
) -> Result<crate::model::User, String> {
    let session_opt = get_active_session(&phone);

    if let Some(session) = session_opt {
        let tab = session.tab;

        let code_input = tab
            .wait_for_element("input[placeholder='验证码']")
            .map_err(|e| e.to_string())?;
        code_input.type_into(&code).map_err(|e| e.to_string())?;

        let submit_button = tab
            .wait_for_elements_by_xpath("//button[contains(., '登 录')]")
            .map_err(|e| e.to_string())?
            .into_iter()
            .next()
            .ok_or("无法找到登录按钮")?;
        submit_button.click().map_err(|e| e.to_string())?;

        // 等待登录成功跳转并确保数据刷盘 - 使用异步休眠，防止阻塞 tokio executor
        tab.wait_until_navigated().map_err(|e| e.to_string())?;

        let cookies = tab.get_cookies().map_err(|e| e.to_string())?;
        println!("Cookies: {:#?}", cookies);

        // 获取用户信息
        let local_user_info: Option<XhsUserInfo> = tab.get_storage("USER_INFO_FOR_BIZ").ok();
        println!("Local Storage: {:#?}", local_user_info);

        let (nickname, avatar) = if let Some(info) = local_user_info {
            (info.user_name, Some(info.user_avatar))
        } else {
            ("小红书用户".to_string(), None)
        };

        // 迁移临时目录到正式的 profile 目录 (可选，或者直接重命名)
        // 这里简单处理：记录到数据库

        // 记录到数据库
        let db_url = get_db_path();
        let pool = SqlitePoolOptions::new()
            .connect(&db_url)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT OR REPLACE INTO users (nickname, phone, avatar, created_at) VALUES (?, ?, ?, ?)"
        )
        .bind(&nickname)
        .bind(&session.phone)
        .bind(&avatar)
        .bind(chrono::Local::now().to_rfc3339())
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let user = crate::model::User {
            id: chrono::Local::now().timestamp(), // 这里之后可以查下插入后的 ID
            nickname,
            phone: session.phone.clone(),
            avatar,
            created_at: chrono::Local::now().to_rfc3339(),
        };

        Ok(user)
    } else {
        Err("No active login session found".to_string())
    }
}

#[tauri::command]
pub async fn get_users() -> Result<Vec<crate::model::User>, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT id, nickname, phone, avatar, created_at FROM users")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let users = rows
        .into_iter()
        .map(|row| crate::model::User {
            id: row.get(0),
            nickname: row.get(1),
            phone: row.get(2),
            avatar: row.get(3),
            created_at: row.get(4),
        })
        .collect();

    Ok(users)
}

#[tauri::command]
pub async fn find_user(query: String) -> Result<Option<crate::model::User>, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, nickname, phone, avatar, created_at FROM users WHERE phone = ? OR nickname = ?",
    )
    .bind(&query)
    .bind(&query)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let user = row.map(|r| crate::model::User {
        id: r.get(0),
        nickname: r.get(1),
        phone: r.get(2),
        avatar: r.get(3),
        created_at: r.get(4),
    });

    Ok(user)
}

#[tauri::command]
pub async fn clear_browser_session(phone: String) -> Result<(), String> {
    let mut sessions = BROWSER_SESSIONS.lock().unwrap();
    sessions.remove(&phone);
    Ok(())
}

#[tauri::command]
pub async fn open_user_data_dir(phone: String) -> Result<(), String> {
    let data_dir = get_browser_data_dir(&phone);
    if data_dir.exists() {
        tauri_plugin_opener::open_path(data_dir.to_string_lossy().to_string(), None::<&str>)
            .map_err(|e| e.to_string())?;
    } else {
        return Err("数据目录不存在，请先登录".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn logout_user(phone: String) -> Result<(), String> {
    // 1. 清理内存会话
    {
        let mut sessions = BROWSER_SESSIONS.lock().unwrap();
        sessions.remove(&phone);
    }

    // 2. 删除文件数据
    let data_dir = get_browser_data_dir(&phone);
    if data_dir.exists() {
        std::fs::remove_dir_all(data_dir).map_err(|e| e.to_string())?;
    }

    // 2. 数据库操作
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    // 获取 user_id 以便删除关联数据
    let user_row = sqlx::query("SELECT id FROM users WHERE phone = ?")
        .bind(&phone)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = user_row {
        let user_id: i64 = row.get(0);

        // 删除该用户的所有帖子 (处理外键约束)
        sqlx::query("DELETE FROM posts WHERE user_id = ?")
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        // 删除用户记录
        sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(user_id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn save_post(
    user_id: i64,
    title: String,
    content: String,
    images: Vec<String>,
    cover_image: Option<String>,
) -> Result<i64, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let images_json = serde_json::to_string(&images).map_err(|e| e.to_string())?;

    let res = sqlx::query(
        "INSERT INTO posts (user_id, title, content, images, cover_image, status) VALUES (?, ?, ?, ?, ?, 'draft')",
    )
    .bind(user_id)
    .bind(title)
    .bind(content)
    .bind(images_json)
    .bind(cover_image)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}
#[tauri::command]
pub async fn get_posts(user_id: i64) -> Result<Vec<serde_json::Value>, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT id, title, content, images, cover_image, status, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut posts = Vec::new();
    for row in rows {
        let images_str: String = row.get(3);
        let images: Vec<String> = serde_json::from_str(&images_str).unwrap_or_default();

        posts.push(serde_json::json!({
            "id": row.get::<i64, _>(0),
            "title": row.get::<String, _>(1),
            "content": row.get::<String, _>(2),
            "images": images,
            "coverImage": row.get::<Option<String>, _>(4),
            "status": row.get::<String, _>(5),
            "created_at": row.get::<String, _>(6),
        }));
    }

    Ok(posts)
}

#[tauri::command]
pub async fn delete_post(post_id: i64) -> Result<(), String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM posts WHERE id = ?")
        .bind(post_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
