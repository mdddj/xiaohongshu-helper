use crate::storage::get_db_path;
use sqlx::sqlite::SqlitePoolOptions;
use tauri_plugin_sql::{Migration, MigrationKind};

pub async fn initialize_database() -> Result<(), String> {
    let db_url = get_db_path();
    let pool = SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            images TEXT, -- JSON array
            cover_image TEXT,
            status TEXT DEFAULT 'draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS ai_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            api_key TEXT NOT NULL,
            base_url TEXT
        );
        CREATE TABLE IF NOT EXISTS ai_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            model_type TEXT NOT NULL, -- 'text' or 'image'
            FOREIGN KEY(provider_id) REFERENCES ai_providers(id)
        );
    ",
    )
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL,
                    phone TEXT NOT NULL UNIQUE,
                    avatar TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT,
                    images TEXT, -- JSON array
                    status TEXT DEFAULT 'draft',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            ",
        kind: MigrationKind::Up,
    }]
}
