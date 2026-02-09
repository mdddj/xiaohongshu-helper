use headless_chrome::browser::default_executable;
use headless_chrome::{Browser, LaunchOptions, Tab};
use std::error::Error;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::task;
use xiaohongshu_helper_lib::util::logging;

/// 获取持久化用户数据目录 (用于保存登录状态)
fn get_user_data_dir() -> PathBuf {
    let mut path = std::env::current_dir().unwrap();
    path.push("browser_data");
    if !path.exists() {
        std::fs::create_dir_all(&path).unwrap();
    }
    path
}

/// 检查是否已登录
fn check_if_logged_in(tab: &Arc<Tab>) -> bool {
    // 尝试寻找“发布笔记”按钮，如果能找到，说明已登录
    // 使用 find_element (非阻塞) 而不是 wait_for_element
    tab.find_element(".publish-video .btn-inner").is_ok()
        || tab
            .find_element("span[contains(text(), '发布笔记')]")
            .is_ok()
}

/// 执行登录流程 (如果尚未登录)
fn ensure_logged_in(tab: &Arc<Tab>, phone: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
    println!("正在检查登录状态...");
    tab.navigate_to("https://creator.xiaohongshu.com/")?;
    std::thread::sleep(Duration::from_secs(3)); // 给页面一点加载时间

    if check_if_logged_in(tab) {
        println!("检测到已登录状态，跳过登录流程。");
        return Ok(());
    }

    println!("未登录或登录已失效，开始执行登录流程...");


    // 1. 输入手机号
    let phone_input = tab.wait_for_element("input[placeholder='手机号']")?;
    phone_input.type_into(phone)?;
    println!("已输入手机号: {}", phone);


    // 2. 点击发送验证码
    let code_button = tab
        .wait_for_elements_by_xpath("//div[text()='发送验证码']")?
        .into_iter()
        .next()
        .ok_or("无法找到发送验证码按钮")?;
    code_button.click()?;
    println!("已点击发送验证码按钮");

    // 3. 手动输入验证码
    println!(">>> 请在控制台输入收到的验证码并按回车: ");
    let mut user_code = String::new();
    std::io::stdin()
        .read_line(&mut user_code)
        .map_err(|e| e.to_string())?;
    let user_code = user_code.trim();

    let code_input = tab.wait_for_element("input[placeholder='验证码']")?;
    code_input.type_into(user_code)?;
    println!("已填入验证码。");

    // 4. 点击登录
    let submit_button = tab
        .wait_for_elements_by_xpath("//button[contains(., '登 录')]")?
        .into_iter()
        .next()
        .ok_or("无法找到登录按钮")?;
    submit_button.click()?;
    println!("已点击登录按钮，等待状态同步...");

    // 等待登录成功跳转
    std::thread::sleep(Duration::from_secs(5));
    Ok(())
}

#[tokio::test]
async fn test_publish_page_navigation() -> Result<(), Box<dyn Error>> {
    logging::enable_logging();

    task::spawn_blocking(move || -> Result<(), Box<dyn Error + Send + Sync>> {
        // 使用持久化目录启动浏览器


        // let browser = Browser::default()?;
        let browser = Browser::new(LaunchOptions::default_builder()
        .path(Some(default_executable().unwrap()))
        .headless(false)
    
        .user_data_dir(Some(get_user_data_dir())).enable_logging(true)
        .build()?)?;
        let  tab = browser.new_tab()?;
        tab.set_default_timeout(std::time::Duration::from_secs(5));

        // 确保登录
        ensure_logged_in(&tab, "17520061863")?;

        println!("正在跳转到图文发布页面...");
        let publish_url =
            "https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image";
        tab.navigate_to(publish_url)?;
        tab.wait_until_navigated()?; // 确保导航完成
        
        println!("正在等待页面渲染...");
        std::thread::sleep(Duration::from_secs(5)); // 给 SPA 页面组件渲染留出时间

        // 验证是否成功到达发布页
        let upload_img_input = tab
            .wait_for_element(".upload-input")?;
        println!("跳转测试成功：已到达发布页面。");
        println!("正在测试图片上传功能...");
        let files = ["/Users/ldd/ai-projects/xiaohongshu-helper/src-tauri/创作页面.jpg"];
        upload_img_input.set_input_files(&files)?;
        std::thread::sleep(Duration::from_secs(5)); // 等待图片上传完成
        // 截图
        let sc = tab.capture_screenshot(
            headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Jpeg,
            None,
            None,
            true,
        )?;
        std::fs::write("创作页面.jpg", sc)?;

        println!("测试完成。浏览器将保持打开 10 秒。");
        std::thread::sleep(Duration::from_secs(10));
        Ok(())
    })
    .await?
    .map_err(|e| e.to_string())?;

    Ok(())
}
