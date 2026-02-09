use anyhow::Result;
use scraper::{Html, Selector};

#[tokio::test]
async fn test_scrape_hot_info() -> Result<()> {
    let url = "https://agi.ylsap.com/";
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()?;

    println!("Fetching {}...", url);
    let html_content = client.get(url).send().await?.text().await?;
    let document = Html::parse_document(&html_content);

    // Selector for each hot list block (Zhihu, Bilibili, Weibo, etc.)
    // Based on the HTML provided: class="G_block hotItemView"
    let block_selector = Selector::parse(".hotItemView").unwrap();
    let source_name_selector = Selector::parse(".h1_title .name").unwrap();
    let item_selector = Selector::parse(".hotItem").unwrap();
    let item_title_selector = Selector::parse(".title a").unwrap();
    let heat_selector = Selector::parse(".heat").unwrap();

    let mut found_data = false;

    for block in document.select(&block_selector) {
        let source_name = block
            .select(&source_name_selector)
            .next()
            .map(|n| n.text().collect::<String>().trim().to_string())
            .unwrap_or_else(|| "Unknown Source".to_string());

        println!("\n🔥 来源: {}", source_name);

        for item in block.select(&item_selector) {
            let index = item
                .select(&Selector::parse(".index").unwrap())
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_default();

            let title = item
                .select(&item_title_selector)
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "无标题".to_string());

            let link = item
                .select(&item_title_selector)
                .next()
                .and_then(|n| n.value().attr("href"))
                .unwrap_or("");

            let heat = item
                .select(&heat_selector)
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "未知".to_string());

            println!("  [{}] {} (热度: {})", index, title, heat);
            println!("      链接: {}", link);
            found_data = true;
        }
    }

    if !found_data {
        println!("\n⚠️ 未获取到数据。这通常是因为页面是动态加载的 (SPA)。");
        println!("建议在真实环境中使用 headless_chrome 或探测 API 接口。");

        // 如果是 SPA，通常可以分析网络请求找到 API 接口
        // 比如：https://agi.ylsap.com/api/...
    } else {
        println!("\n✅ 抓取测试成功！");
    }

    Ok(())
}

#[tokio::test]
async fn test_scrape_hot_info_headless() -> Result<()> {
    use headless_chrome::{Browser, LaunchOptions};
    use std::time::Duration;

    let url = "https://agi.ylsap.com/";
    println!("Launching headless browser to {}...", url);

    // Launch browser
    let browser = Browser::new(
        LaunchOptions::default_builder()
            .headless(true)
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to launch browser: {}", e))?,
    )?;

    let tab = browser.new_tab()?;
    tab.navigate_to(url)?;

    // Wait for the hot list to be rendered
    tab.wait_for_element(".hotList_C")?;

    // Sometimes it takes a moment to fill the content
    tokio::time::sleep(Duration::from_secs(2)).await;

    let html_content = tab.get_content()?;
    let document = Html::parse_document(&html_content);

    let block_selector = Selector::parse(".hotItemView").unwrap();
    let source_name_selector = Selector::parse(".h1_title .name").unwrap();
    let item_selector = Selector::parse(".hotItem").unwrap();
    let item_title_selector = Selector::parse(".title a").unwrap();
    let heat_selector = Selector::parse(".heat").unwrap();

    let mut found_data = false;

    for block in document.select(&block_selector) {
        let source_name = block
            .select(&source_name_selector)
            .next()
            .map(|n| n.text().collect::<String>().trim().to_string())
            .unwrap_or_else(|| "Unknown Source".to_string());

        println!("\n✨ [Headless] 来源: {}", source_name);

        for item in block.select(&item_selector) {
            let index = item
                .select(&Selector::parse(".index").unwrap())
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_default();

            let title = item
                .select(&item_title_selector)
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "无标题".to_string());

            let link = item
                .select(&item_title_selector)
                .next()
                .and_then(|n| n.value().attr("href"))
                .unwrap_or("");

            let heat = item
                .select(&heat_selector)
                .next()
                .map(|n| n.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "未知".to_string());

            println!("  [{}] {} (热度: {})", index, title, heat);
            println!("      链接: {}", link);
            found_data = true;
        }
    }

    if found_data {
        println!("\n✅ Headless 抓取测试成功！");
    } else {
        println!("\n❌ Headless 抓取未发现数据。");
    }

    Ok(())
}

#[derive(Debug, serde::Deserialize)]
struct ApiResponse {
    code: i32,
    msg: String,
    data: std::collections::HashMap<String, Vec<serde_json::Value>>,
}

#[tokio::test]
async fn test_scrape_hot_info_api() -> anyhow::Result<()> {
    let url = "https://agi.ylsap.com/links/v1/getdata";
    let client = reqwest::Client::new();

    println!("Fetching API data from {}...", url);
    let resp = client.get(url).send().await?.json::<ApiResponse>().await?;

    if resp.code != 200 {
        anyhow::bail!("API Error: ({}): {}", resp.code, resp.msg);
    }

    println!(
        "✅ API 请求成功！共获取到 {} 个来源的数据。\n",
        resp.data.len()
    );

    for (source, items) in resp.data {
        println!("🚀 来源: {}", source);
        for item in items.iter().take(5) {
            // 每个来源打印前5条
            let title = item
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("无标题");
            let index = item.get("index").and_then(|v| v.as_i64()).unwrap_or(0);
            let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("");

            // 尝试获取热度/评分信息 (不同平台字段名可能不同)
            let sorting = item
                .get("sorting")
                .map(|v| v.to_string())
                .unwrap_or_else(|| "未知".to_string());

            println!("  [{}] {} (热度/评分: {})", index + 1, title, sorting);
            println!("      地址: {}", url);
        }
        if items.len() > 5 {
            println!("  ... 以及另外 {} 条信息", items.len() - 5);
        }
        println!();
    }

    Ok(())
}
