use crate::storage::get_browser_data_dir;
use headless_chrome::browser::default_executable;
use headless_chrome::{Browser, LaunchOptions, Tab};
use sqlx::Row;
use std::fs;
use std::path::Path;
use std::time::Duration;

pub fn take_screenshot(tab: &Tab, name: &str) {
    let mut dir = dirs::home_dir().unwrap_or_else(|| Path::new(".").to_path_buf());
    dir.push("xiaohongshu-helper-debug");

    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    let filepath = dir.join(format!("{}.png", name));
    match tab.capture_screenshot(
        headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
        None,
        None,
        true,
    ) {
        Ok(data) => {
            if let Err(e) = fs::write(&filepath, data) {
                println!("Failed to write screenshot {}: {}", name, e);
            } else {
                println!("Screenshot saved: {:?}", filepath);
            }
        }
        Err(e) => println!("Failed to take screenshot {}: {}", name, e),
    }
}

#[tauri::command]
pub async fn publish_post(
    phone: String,
    title: String,
    content: String,
    images: Vec<String>,
    cover_image: Option<String>,
) -> Result<(), String> {
    println!("Starting publish_post task for phone: {}", phone);

    // 优先尝试获取活跃会话
    let active_session = crate::auth::get_active_session(&phone);
    let browser = if let Some(session) = active_session {
        println!("Reusing active browser session for {}", phone);
        session.browser
    } else {
        println!("No active session, starting new browser for {}", phone);

        // 启动前清理可能的 SingletonLock 锁文件
        crate::storage::clear_browser_lock(&phone);

        // 获取无头模式设置
        let headless = crate::ai::get_headless_mode().await;

        let data_dir = get_browser_data_dir(&phone);
        Browser::new(
            LaunchOptions::default_builder()
                .headless(headless)
                .user_data_dir(Some(data_dir))
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
                .map_err(|e| format!("Browser build failed: {}", e))?,
        )
        .map_err(|e| format!("Browser init failed: {}", e))?
    };

    let tab = browser
        .new_tab()
        .map_err(|e| format!("New tab failed: {}", e))?;

    // 1. 跳转到发布页面
    println!("Navigating to publish page...");
    tab.navigate_to("https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image")
        .map_err(|e| format!("Navigation failed: {}", e))?;

    take_screenshot(&tab, "1_navigated");

    // 2. 等待封面上传 Input
    println!("Waiting for upload input selector: .upload-input");
    let upload_input = tab.wait_for_element(".upload-input").map_err(|e| {
        take_screenshot(&tab, "error_wait_upload_input");
        format!(
            "Error waiting for .upload-input: {}. See error_wait_upload_input.png",
            e
        )
    })?;

    // 确定封面图
    let cover = if let Some(c) = &cover_image {
        c.clone()
    } else if let Some(first) = images.first() {
        first.clone()
    } else {
        return Err("必须至少包含一张图片作为封面".to_string());
    };

    println!("Uploading cover image: {}", cover);
    upload_input
        .set_input_files(&[&cover])
        .map_err(|e| format!("Failed to set cover image: {}", e))?;

    // 给一点时间让上传触发
    tokio::time::sleep(Duration::from_secs(2)).await;
    take_screenshot(&tab, "2_cover_uploaded");

    // 3. 等待编辑页面加载
    // 这里容易超时，如果上传慢的话
    println!("Waiting for editor container: .edit-container");
    tab.wait_for_element(".edit-container")
        .map_err(|e| {
             take_screenshot(&tab, "error_wait_edit_container");
             format!("Error waiting for .edit-container: {}. Check if cover upload worked. See error_wait_edit_container.png", e)
        })?;

    take_screenshot(&tab, "3_editor_loaded");

    // 4. 填写标题
    println!("Filling title...");
    let title_input = tab
        .wait_for_element(".d-input-wrapper .d-text")
        .map_err(|e| {
            take_screenshot(&tab, "error_wait_title");
            format!("Error waiting for title input: {}", e)
        })?;

    title_input
        .click()
        .map_err(|e| format!("Click title failed: {}", e))?;
    title_input
        .type_into(&title)
        .map_err(|e| format!("Type title failed: {}", e))?;

    // 5. 填写正文
    println!("Filling content...");
    let content_editor = tab.wait_for_element(".tiptap.ProseMirror").map_err(|e| {
        take_screenshot(&tab, "error_wait_content");
        format!("Error waiting for content editor: {}", e)
    })?;

    content_editor
        .click()
        .map_err(|e| format!("Click content failed: {}", e))?;
    content_editor
        .type_into(&content)
        .map_err(|e| format!("Type content failed: {}", e))?;

    take_screenshot(&tab, "4_content_filled");

    // 6. 上传剩余图片
    let remaining_images: Vec<String> = images
        .iter()
        .filter(|&img| img != &cover)
        .cloned()
        .collect();

    if !remaining_images.is_empty() {
        println!("Uploading remaining {} images...", remaining_images.len());
        // 尝试寻找编辑页内的添加图片按钮
        if let Ok(file_input) = tab.wait_for_element("input[type='file']") {
            let image_refs: Vec<&str> = remaining_images.iter().map(|s| s.as_str()).collect();
            if let Err(e) = file_input.set_input_files(&image_refs) {
                println!("Warning: Failed to upload remaining images: {}", e);
            } else {
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        } else {
            println!("Warning: Could not find input[type='file'] for remaining images");
        }
    }

    take_screenshot(&tab, "5_ready_to_publish");
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 尝试滚动到底部
    println!("Scrolling to bottom...");
    let _ = tab.evaluate("window.scrollTo(0, document.body.scrollHeight)", true);
    tokio::time::sleep(Duration::from_millis(500)).await;

    // 7. 点击发布
    println!("Finding publish button...");

    // 灵活的 XPath：支持 button 或 role="button" 的 div，排除侧边栏的“发布笔记”，通过包含“发布”二字定位
    let xpath = "//*[(name()='button' or @role='button') and contains(., '发布') and not(contains(., '笔记'))]";

    let publish_btn = tab
        .wait_for_elements_by_xpath(xpath)
        .map_err(|e| {
            take_screenshot(&tab, "error_find_publish_btn");
            format!(
                "Wait for publish btn failed: {}. See error_find_publish_btn.png",
                e
            )
        })?
        .into_iter()
        .next()
        .ok_or_else(|| {
            take_screenshot(&tab, "error_no_publish_btn");
            "Cannot find publish element (No match found). See error_no_publish_btn.png".to_string()
        })?;

    println!("Publish button found. Clicking...");
    publish_btn
        .click()
        .map_err(|e| format!("Click publish failed: {}", e))?;

    println!("Publish command sent. Waiting 3s...");
    tokio::time::sleep(Duration::from_secs(3)).await;
    take_screenshot(&tab, "6_publish_clicked");

    Ok(())
}

#[tauri::command]
pub async fn validate_login_status(phone: String) -> Result<crate::model::User, String> {
    println!("Validating login status for phone: {}", phone);

    // 清理可能的 SingletonLock 锁文件
    crate::storage::clear_browser_lock(&phone);

    // 获取无头模式设置
    let headless = crate::ai::get_headless_mode().await;

    let data_dir = get_browser_data_dir(&phone);
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
            .map_err(|e| format!("Browser build failed: {}", e))?,
    )
    .map_err(|e| format!("Browser init failed: {}", e))?;

    let tab = browser
        .new_tab()
        .map_err(|e| format!("New tab failed: {}", e))?;

    // 跳转到发布页以检查登录状态
    println!("Navigating to publish page to check status...");
    tab.navigate_to("https://creator.xiaohongshu.com/publish/publish")
        .map_err(|e| format!("Navigation failed: {}", e))?;

    // 等待用户信息元素或登录重定向
    // 这里的选择器是用户提供的 .user-info 或里面的 .user_avatar / .name-box
    let user_info_selector = ".user-info";

    // 给一点时间加载
    tokio::time::sleep(Duration::from_secs(2)).await;

    let _user_info_el = match tab.wait_for_element(user_info_selector) {
        Ok(el) => el,
        Err(_) => {
            take_screenshot(&tab, "validate_login_failed");
            return Err("未检测到登录状态或已过期".to_string());
        }
    };

    // 提取昵称和头像
    let nickname = tab
        .wait_for_element(".name-box")
        .and_then(|el| el.get_inner_text())
        .unwrap_or_else(|_| "未知用户".to_string());

    let avatar = tab
        .wait_for_element(".user_avatar")
        .and_then(|el| el.get_attributes())
        .ok()
        .flatten()
        .and_then(|attrs| {
            let mut iter = attrs.iter();
            while let Some(name) = iter.next() {
                if name == "src" {
                    return iter.next().cloned();
                }
                iter.next();
            }
            None
        });

    println!("Detected user: {} (Avatar: {:?})", nickname, avatar);

    // 更新或插入数据库中的用户信息
    let db_url = crate::storage::get_db_path();
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    // 检查用户是否已存在
    let existing_user = sqlx::query("SELECT id, created_at FROM users WHERE phone = ?")
        .bind(&phone)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let (user_id, created_at) = if let Some(row) = existing_user {
        // 用户已存在，更新信息
        let id: i64 = row.get(0);
        let created: String = row.get(1);

        println!("用户已存在，更新昵称和头像");
        sqlx::query("UPDATE users SET nickname = ?, avatar = ? WHERE phone = ?")
            .bind(&nickname)
            .bind(&avatar)
            .bind(&phone)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        (id, created)
    } else {
        // 用户不存在，插入新记录
        println!("用户不存在，插入新记录");
        let now = chrono::Local::now().to_rfc3339();

        let result = sqlx::query(
            "INSERT INTO users (nickname, phone, avatar, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(&nickname)
        .bind(&phone)
        .bind(&avatar)
        .bind(&now)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        (result.last_insert_rowid(), now)
    };

    let user = crate::model::User {
        id: user_id,
        nickname,
        phone,
        avatar,
        created_at,
    };

    take_screenshot(&tab, "validate_login_success");

    Ok(user)
}
