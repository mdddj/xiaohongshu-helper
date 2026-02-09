use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
pub struct User {
    pub id: i64,
    pub nickname: String,
    pub phone: String,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, schemars::JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum AIModelType {
    Text,
    Image,
}

#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
pub struct AIModel {
    pub id: Option<i64>,
    pub provider_id: Option<i64>,
    pub name: String,
    pub model_type: AIModelType,
    #[serde(default)]
    pub supports_structured_output: Option<bool>,
    #[serde(default)]
    pub test_status: Option<String>, // "success", "failed", "testing"
}

#[derive(Debug, Serialize, Deserialize, Clone, schemars::JsonSchema)]
pub struct AIProvider {
    pub id: Option<i64>,
    pub name: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub models: Vec<AIModel>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Post {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    pub content: String,
    pub images: Vec<String>,
    pub status: String, // draft, publishing, published, failed
    pub created_at: String,
}
