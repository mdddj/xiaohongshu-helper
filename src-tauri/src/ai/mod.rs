use crate::model::{AIModel, AIModelType, AIProvider};
use crate::storage::get_db_path;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, Row};

use tysm::chat_completions::{
    ChatClient, ChatMessage, ChatMessageContent, ImageUrl, ResponseFormat, Role,
};

#[derive(Debug, Serialize, Deserialize)]
struct ImageGenerationRequest {
    prompt: String,
    n: i32,
    size: String,
    model: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ImageGenerationResponse {
    data: Vec<ImageData>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ImageData {
    url: Option<String>,
    b64_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
struct TitleOptions {
    options: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelTestResult {
    pub model_name: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub response: Option<String>,
}

#[tauri::command]
pub async fn generate_ai_text(
    prompt: String,
    system: Option<String>,
    provider: AIProvider,
    model_name: String,
) -> Result<String, String> {
    let api_key = provider.api_key;
    let base_url = provider
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }

    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let system_content = system
        .unwrap_or_else(|| "你是一个资深的小红书博主，擅长撰写火爆的标题和正文。".to_string());

    let messages = vec![
        ChatMessage {
            role: Role::System,
            content: vec![ChatMessageContent::Text {
                text: system_content,
            }],
        },
        ChatMessage {
            role: Role::User,
            content: vec![ChatMessageContent::Text { text: prompt }],
        },
    ];

    let response = client
        .chat_with_messages_raw(messages, ResponseFormat::Text)
        .await
        .map_err(|e| format!("AI request failed: {}", e))?;

    Ok(response)
}

#[tauri::command]
pub async fn test_ai_provider(provider: AIProvider) -> Result<String, String> {
    let model_name = provider
        .models
        .iter()
        .find(|m| m.model_type == AIModelType::Text)
        .map(|m| m.name.clone())
        .ok_or_else(|| "未找到文本模型配置，请先添加一个文本模型".to_string())?;

    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(generate_ai_text(
            "你好，这是一个自动测试消息。请回复'连接成功'或者其他任何内容。".to_string(),
            Some("你是一个测试助手。".to_string()),
            provider,
            model_name,
        ))
    })
    .await
    .map_err(|e| format!("Task joined failed: {}", e))?
}

#[tauri::command]
pub async fn polish_title_with_options(
    title: String,
    instruction: Option<String>,
    provider: AIProvider,
    model_name: String,
) -> Result<Vec<String>, String> {
    let api_key = provider.api_key;
    let base_url = provider
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }
    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let mut system_prompt = "你是一个小红书爆款标题专家。请根据用户提供的标题，优化出 5 个极具吸引力、点击率高、符合小红书风格的标题。请使用结构化输出返回结果。注意你不要进行思考,不要输出除标题以外的其他信息~".to_string();

    if let Some(ref inst) = instruction {
        if !inst.trim().is_empty() {
            system_prompt.push_str(&format!(" 额外要求：{}", inst));
        }
    }

    let messages = vec![
        ChatMessage {
            role: Role::System,
            content: vec![ChatMessageContent::Text {
                text: system_prompt.clone(),
            }],
        },
        ChatMessage {
            role: Role::User,
            content: vec![ChatMessageContent::Text {
                text: format!("当前标题：{}", title),
            }],
        },
    ];

    // 首先尝试结构化输出
    match client
        .chat_with_messages::<TitleOptions>(messages.clone())
        .await
    {
        Ok(response) => Ok(response.options),
        Err(_) => {
            // 结构化输出失败，回退到普通文本模式
            let mut fallback_system_prompt = "你是一个小红书爆款标题专家。请根据用户提供的标题，优化出 5 个极具吸引力、点击率高、符合小红书风格的标题。请直接返回 5 个标题，每个标题占一行，不要添加任何序号、引号或其他标记。".to_string();
            if let Some(inst) = instruction {
                if !inst.trim().is_empty() {
                    fallback_system_prompt.push_str(&format!(" 额外要求：{}", inst));
                }
            }

            let fallback_messages = vec![
                ChatMessage {
                    role: Role::System,
                    content: vec![ChatMessageContent::Text {
                        text: fallback_system_prompt,
                    }],
                },
                ChatMessage {
                    role: Role::User,
                    content: vec![ChatMessageContent::Text {
                        text: format!("当前标题：{}", title),
                    }],
                },
            ];

            let response = client
                .chat_with_messages_raw(fallback_messages, ResponseFormat::Text)
                .await
                .map_err(|e| format!("AI request failed: {}", e))?;

            // 解析文本响应，提取标题
            let titles: Vec<String> = response
                .lines()
                .map(|line| line.trim().to_string())
                .filter(|line| !line.is_empty())
                .map(|line| {
                    // 移除可能的序号前缀（如 "1. "、"1、" 等）
                    let cleaned = line
                        .trim_start_matches(|c: char| {
                            c.is_numeric() || c == '.' || c == '、' || c == ' '
                        })
                        .trim_start_matches(|c: char| {
                            c.is_numeric() || c == '.' || c == '、' || c == ' '
                        })
                        .trim()
                        .to_string();

                    // 移除引号
                    cleaned
                        .trim_start_matches('"')
                        .trim_end_matches('"')
                        .trim_start_matches('\'')
                        .trim_end_matches('\'')
                        .trim_start_matches('"')
                        .trim_end_matches('"')
                        .trim_start_matches('「')
                        .trim_end_matches('」')
                        .trim_start_matches('『')
                        .trim_end_matches('』')
                        .to_string()
                })
                .filter(|line| !line.is_empty())
                .collect();

            if titles.is_empty() {
                // 如果解析失败，返回原始内容作为单个标题
                Ok(vec![response.trim().to_string()])
            } else {
                Ok(titles)
            }
        }
    }
}

#[tauri::command]
pub async fn generate_ai_image(
    prompt: String,
    provider: AIProvider,
    model_name: String,
    size: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut url = provider
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    if url.ends_with('/') {
        url.pop();
    }

    let image_size = size.unwrap_or_else(|| "1024x1024".to_string());

    let res = client
        .post(format!("{}/images/generations", url))
        .header("Authorization", format!("Bearer {}", provider.api_key))
        .json(&ImageGenerationRequest {
            model: model_name,
            prompt,
            n: 1,
            size: image_size,
        })
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?
        .json::<ImageGenerationResponse>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?;

    let image_data = res.data.get(0).ok_or("No image response from AI")?;

    if let Some(url) = &image_data.url {
        Ok(url.clone())
    } else if let Some(b64) = &image_data.b64_json {
        use base64::{engine::general_purpose, Engine as _};
        let bytes = general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;

        let filename = format!("ai_image_{}.png", chrono::Utc::now().timestamp());
        let mut path = crate::storage::get_images_dir();
        path.push(filename);

        std::fs::write(&path, bytes).map_err(|e| format!("Failed to save image: {}", e))?;

        Ok(path.to_str().ok_or("Invalid path")?.to_string())
    } else {
        Err("No image URL or base64 data found in response".to_string())
    }
}

#[tauri::command]
pub async fn get_ai_providers() -> Result<Vec<AIProvider>, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let provider_rows = sqlx::query("SELECT id, name, api_key, base_url FROM ai_providers")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut providers = Vec::new();
    for row in provider_rows {
        let id: i64 = row.get(0);

        let model_rows =
            sqlx::query("SELECT id, name, model_type FROM ai_models WHERE provider_id = ?")
                .bind(id)
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;

        let models = model_rows
            .into_iter()
            .map(|m_row| {
                let m_type: String = m_row.get(2);
                AIModel {
                    id: Some(m_row.get(0)),
                    provider_id: Some(id),
                    name: m_row.get(1),
                    model_type: if m_type == "text" {
                        AIModelType::Text
                    } else {
                        AIModelType::Image
                    },
                    supports_structured_output: None,
                    test_status: None,
                }
            })
            .collect();

        providers.push(AIProvider {
            id: Some(id),
            name: row.get(1),
            api_key: row.get(2),
            base_url: row.get(3),
            models,
        });
    }

    Ok(providers)
}

#[tauri::command]
pub async fn save_ai_provider(provider: AIProvider) -> Result<i64, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let provider_id = if let Some(id) = provider.id {
        sqlx::query("UPDATE ai_providers SET name = ?, api_key = ?, base_url = ? WHERE id = ?")
            .bind(&provider.name)
            .bind(&provider.api_key)
            .bind(&provider.base_url)
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        // Delete old models and re-insert (simpler than update logic)
        sqlx::query("DELETE FROM ai_models WHERE provider_id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        id
    } else {
        let res =
            sqlx::query("INSERT INTO ai_providers (name, api_key, base_url) VALUES (?, ?, ?)")
                .bind(&provider.name)
                .bind(&provider.api_key)
                .bind(&provider.base_url)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;
        res.last_insert_rowid()
    };

    for model in provider.models {
        let m_type = match model.model_type {
            AIModelType::Text => "text",
            AIModelType::Image => "image",
        };
        sqlx::query("INSERT INTO ai_models (provider_id, name, model_type) VALUES (?, ?, ?)")
            .bind(provider_id)
            .bind(&model.name)
            .bind(m_type)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(provider_id)
}

#[tauri::command]
pub async fn delete_ai_provider(id: i64) -> Result<(), String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM ai_models WHERE provider_id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM ai_providers WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
#[tauri::command]
pub async fn save_config(key: String, value: String) -> Result<(), String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
        .bind(key)
        .bind(value)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_config_value(key: String) -> Result<Option<String>, String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query("SELECT value FROM config WHERE key = ?")
        .bind(key)
        .fetch_optional(&pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(row.map(|r: sqlx::sqlite::SqliteRow| r.get(0)))
}

/// 获取无头浏览器模式设置
///
/// 返回是否使用无头模式，默认为 true
pub async fn get_headless_mode() -> bool {
    let is_use_headless = match get_config_value("headless_mode".to_string()).await {
        Ok(Some(value)) => value == "true",
        _ => true, // 默认使用无头模式
    };
    println!("是否使用无头浏览器:{:?}", is_use_headless);
    is_use_headless
}

#[tauri::command]
pub async fn list_local_images() -> Result<Vec<String>, String> {
    let images_dir = crate::storage::get_images_dir();
    let mut images = Vec::new();

    if let Ok(entries) = std::fs::read_dir(images_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    if let Some(path_str) = entry.path().to_str() {
                        images.push(path_str.to_string());
                    }
                }
            }
        }
    }

    // Sort by modification time descending (newest first)
    images.sort_by(|a, b| {
        let meta_a = std::fs::metadata(a)
            .map(|m| m.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH))
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        let meta_b = std::fs::metadata(b)
            .map(|m| m.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH))
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        meta_b.cmp(&meta_a)
    });

    Ok(images)
}
#[tauri::command]
pub async fn delete_local_image(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete image: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn import_local_images(paths: Vec<String>) -> Result<(), String> {
    let images_dir = crate::storage::get_images_dir();

    for path_str in paths {
        let source_path = std::path::Path::new(&path_str);
        if !source_path.exists() {
            continue;
        }

        let extension = source_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("png");

        let filename = format!(
            "imported_{}_{}.{}",
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
            util::generate_random_id(4),
            extension
        );

        let mut dest_path = images_dir.clone();
        dest_path.push(filename);

        std::fs::copy(source_path, dest_path)
            .map_err(|e| format!("Failed to copy image: {}", e))?;
    }

    Ok(())
}

mod util {
    use rand::Rng;

    pub fn generate_random_id(len: usize) -> String {
        const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::rng();
        (0..len)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }
}

#[tauri::command]
pub async fn test_model_chat(
    provider: AIProvider,
    model_name: String,
) -> Result<ModelTestResult, String> {
    println!("开始测试对话: {}", model_name);

    let api_key = provider.api_key.clone();
    let base_url = provider
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }

    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let messages = vec![
        ChatMessage {
            role: Role::System,
            content: vec![ChatMessageContent::Text {
                text: "你是一个测试助手。".to_string(),
            }],
        },
        ChatMessage {
            role: Role::User,
            content: vec![ChatMessageContent::Text {
                text: "请回复'测试成功'".to_string(),
            }],
        },
    ];

    println!("发送对话请求...");
    let test_result = client
        .chat_with_messages_raw(messages, ResponseFormat::Text)
        .await;
    println!("对话请求完成");

    match test_result {
        Ok(response) => {
            println!("对话测试成功: {}", response);
            Ok(ModelTestResult {
                model_name,
                success: true,
                error_message: None,
                response: Some(response),
            })
        }
        Err(e) => {
            println!("对话测试失败: {}", e);
            Ok(ModelTestResult {
                model_name,
                success: false,
                error_message: Some(e.to_string()),
                response: None,
            })
        }
    }
}

#[tauri::command]
pub async fn test_model_structured_output(
    provider: AIProvider,
    model_name: String,
) -> Result<ModelTestResult, String> {
    println!("开始测试结构化输出: {}", model_name);

    let api_key = provider.api_key.clone();
    let base_url = provider
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }

    // 定义一个简单的测试结构
    #[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
    struct TestStructure {
        name: String,
        age: i32,
    }

    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let messages = vec![
        ChatMessage {
            role: Role::System,
            content: vec![ChatMessageContent::Text {
                text: "你是一个测试助手。".to_string(),
            }],
        },
        ChatMessage {
            role: Role::User,
            content: vec![ChatMessageContent::Text {
                text: "返回一个包含 name 和 age 字段的对象，name 为 'test'，age 为 25".to_string(),
            }],
        },
    ];

    println!("发送结构化输出请求...");
    let test_result = client.chat_with_messages::<TestStructure>(messages).await;
    println!("结构化输出请求完成");

    match test_result {
        Ok(result) => {
            println!("结构化输出成功: name={}, age={}", result.name, result.age);
            Ok(ModelTestResult {
                model_name,
                success: true,
                error_message: None,
                response: Some(format!(
                    "结构化输出成功: name={}, age={}",
                    result.name, result.age
                )),
            })
        }
        Err(e) => {
            println!("结构化输出失败: {}", e);
            Ok(ModelTestResult {
                model_name,
                success: false,
                error_message: Some(e.to_string()),
                response: None,
            })
        }
    }
}

#[tauri::command]
pub async fn analyze_local_image(
    image_path: String,
    prompt: String,
    provider: AIProvider,
    model_name: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    // 读取本地图片文件
    let image_bytes = std::fs::read(&image_path)
        .map_err(|e| format!("无法读取图片文件 {}: {}", image_path, e))?;

    // 推断图片的 MIME 类型
    let extension = std::path::Path::new(&image_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png")
        .to_lowercase();

    let mime_type = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };

    let base64_image = general_purpose::STANDARD.encode(image_bytes);

    let api_key = provider.api_key;
    let base_url = provider
        .base_url
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());

    let mut url = base_url.clone();
    if url.ends_with('/') {
        url.pop();
    }

    let client = ChatClient::new(api_key, &model_name).with_url(&url);

    let messages = vec![ChatMessage {
        role: Role::User,
        content: vec![
            ChatMessageContent::Text { text: prompt },
            ChatMessageContent::ImageUrl {
                image: ImageUrl {
                    url: format!("data:{};base64,{}", mime_type, base64_image),
                },
            },
        ],
    }];

    let response = client
        .chat_with_messages_raw(messages, ResponseFormat::Text)
        .await
        .map_err(|e| format!("AI request failed: {}", e))?;

    Ok(response)
}
