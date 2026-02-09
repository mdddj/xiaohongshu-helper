use crate::ai::get_headless_mode;
use crate::automation::take_screenshot;
use crate::model::AIProvider;
use crate::storage::get_browser_data_dir;
use crate::util::utils::kill_browser_process;
use anyhow::anyhow;
use anyhow::Result;
use headless_chrome::browser::default_executable;
use headless_chrome::{Browser, LaunchOptions, Tab};
use serde::{Deserialize, Serialize};
use tysm::chat_completions::{ChatClient, ChatMessage, ChatMessageContent, Role};
#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
pub struct UserAnalytics {
    // 基础数据
    pub following_count: i32,
    pub followers_count: i32,
    pub likes_and_collections: i32,

    // 笔记数据总览 (近30日)
    pub exposure_count: i32,
    pub view_count: i32,
    pub cover_click_rate: f32,
    pub video_completion_rate: f32,

    // 互动数据
    pub like_count: i32,
    pub comment_count: i32,
    pub collection_count: i32,
    pub share_count: i32,

    // 粉丝数据
    pub net_follower_growth: i32,
    pub new_followers: i32,
    pub unfollowers: i32,
    pub profile_visitors: i32,

    // 统计周期
    pub period: String,
}

pub fn fetch_text_only(tab: &Tab) -> Result<String> {
    let remote_object = tab.evaluate("document.body.innerText", false)?;

    match remote_object.value {
        Some(val) => {
            let text = serde_json::from_value(val)?;
            Ok(text)
        }
        None => Err(anyhow!("Empty value from browser")),
    }
}
#[tauri::command]
pub async fn fetch_user_analytics(phone: String) -> Result<UserAnalytics, String> {
    println!("Fetching user analytics for phone: {}", phone);

    // 清理可能的 SingletonLock 锁文件
    crate::storage::clear_browser_lock(&phone);

    // 获取无头模式设置
    let headless = get_headless_mode().await;

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

    // 跳转到创作者主页
    println!("Navigating to creator home page...");
    tab.navigate_to("https://creator.xiaohongshu.com/new/home")
        .map_err(|e| format!("Navigation failed: {}", e))?;

    // 等待页面加载
    println!("等待页面加载完成");

    std::thread::sleep(std::time::Duration::from_secs(5));

    take_screenshot(&tab, "数据分析");
    // 获取页面 HTML
    let html = fetch_text_only(&tab).map_err(|e| format!("Failed to get page content: {}", e))?;

    kill_browser_process(&browser);

    //关掉进程

    println!("Page HTML length: {}", html.len());

    // 检查是否配置了数据分析 AI
    let analytics_ai_config = crate::ai::get_config_value("analytics_ai_model".to_string())
        .await
        .map_err(|e| format!("Failed to get analytics AI config: {}", e))?;

    let analytics_ai_config =
        analytics_ai_config.ok_or_else(|| "未配置数据分析 AI，请在设置中配置".to_string())?;

    let config: serde_json::Value = serde_json::from_str(&analytics_ai_config)
        .map_err(|e| format!("Failed to parse analytics AI config: {}", e))?;

    let provider_id = config["providerId"]
        .as_i64()
        .ok_or_else(|| "Invalid provider ID".to_string())?;
    let model_name = config["modelName"]
        .as_str()
        .ok_or_else(|| "Invalid model name".to_string())?
        .to_string();

    // 获取 AI Provider
    let providers = crate::ai::get_ai_providers().await?;
    let provider = providers
        .into_iter()
        .find(|p| p.id == Some(provider_id))
        .ok_or_else(|| "未找到配置的 AI Provider".to_string())?;

    // 使用 AI 分析 HTML 并提取结构化数据
    let analytics = analyze_html_with_ai(html, provider, model_name).await?;

    Ok(analytics)
}

async fn analyze_html_with_ai(
    html: String,
    provider: AIProvider,
    model_name: String,
) -> Result<UserAnalytics, String> {
    let api_key = provider.api_key;
    let base_url = provider
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }

    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let system_prompt = r#"你是一个专业的数据提取助手。请从小红书创作者主页的 HTML 中提取数据，并按照以下格式输出，每行一个数据项：

关注数=数字
粉丝数=数字
获赞与收藏=数字
曝光数=数字
观看数=数字
封面点击率=数字（不带%符号，如16.1）
视频完播率=数字（不带%符号）
点赞数=数字
评论数=数字
收藏数=数字
分享数=数字
净涨粉=数字
新增关注=数字
取消关注=数字
主页访客=数字
统计周期=文本（如：01-08 至 02-06）

注意：
1. 每行格式必须是：字段名=值
2. 如果找不到数据或显示为"-"，数字字段请填0
3. 不要添加任何其他说明文字
4. 按照上面的顺序输出"#;

    let user_prompt = format!("请从以下 HTML 中提取数据：\n\n{}", html);

    let messages = vec![
        ChatMessage {
            role: Role::System,
            content: vec![ChatMessageContent::Text {
                text: system_prompt.to_string(),
            }],
        },
        ChatMessage {
            role: Role::User,
            content: vec![ChatMessageContent::Text { text: user_prompt }],
        },
    ];

    println!("Sending HTML to AI for analysis...");
    let response = client
        .chat_with_messages_raw(messages, tysm::chat_completions::ResponseFormat::Text)
        .await
        .map_err(|e| format!("AI analysis failed: {}", e))?;

    println!("AI response: {}", response);

    // 解析AI返回的文本
    let analytics = parse_analytics_text(&response)?;

    println!("AI analysis completed successfully");
    Ok(analytics)
}

fn parse_analytics_text(text: &str) -> Result<UserAnalytics, String> {
    let mut analytics = UserAnalytics {
        following_count: 0,
        followers_count: 0,
        likes_and_collections: 0,
        exposure_count: 0,
        view_count: 0,
        cover_click_rate: 0.0,
        video_completion_rate: 0.0,
        like_count: 0,
        comment_count: 0,
        collection_count: 0,
        share_count: 0,
        net_follower_growth: 0,
        new_followers: 0,
        unfollowers: 0,
        profile_visitors: 0,
        period: "未知".to_string(),
    };

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();

            match key {
                "关注数" => analytics.following_count = value.parse().unwrap_or(0),
                "粉丝数" => analytics.followers_count = value.parse().unwrap_or(0),
                "获赞与收藏" => analytics.likes_and_collections = value.parse().unwrap_or(0),
                "曝光数" => analytics.exposure_count = value.parse().unwrap_or(0),
                "观看数" => analytics.view_count = value.parse().unwrap_or(0),
                "封面点击率" => analytics.cover_click_rate = value.parse().unwrap_or(0.0),
                "视频完播率" => analytics.video_completion_rate = value.parse().unwrap_or(0.0),
                "点赞数" => analytics.like_count = value.parse().unwrap_or(0),
                "评论数" => analytics.comment_count = value.parse().unwrap_or(0),
                "收藏数" => analytics.collection_count = value.parse().unwrap_or(0),
                "分享数" => analytics.share_count = value.parse().unwrap_or(0),
                "净涨粉" => analytics.net_follower_growth = value.parse().unwrap_or(0),
                "新增关注" => analytics.new_followers = value.parse().unwrap_or(0),
                "取消关注" => analytics.unfollowers = value.parse().unwrap_or(0),
                "主页访客" => analytics.profile_visitors = value.parse().unwrap_or(0),
                "统计周期" => analytics.period = value.to_string(),
                _ => {}
            }
        }
    }

    Ok(analytics)
}
