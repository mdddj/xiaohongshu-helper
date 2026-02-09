use std::path::PathBuf;

pub mod sqlite;

pub fn get_app_dir() -> PathBuf {
    // 优先使用用户目录下的 xiaohongshu-helper-data
    let mut path = dirs::home_dir().expect("Could not find home directory");
    path.push("xiaohongshu-helper-data");

    if !path.exists() {
        std::fs::create_dir_all(&path).expect("Could not create app directory");
    }
    path
}

pub fn get_browser_data_dir(user_id: &str) -> PathBuf {
    let mut path = get_app_dir();
    path.push("profiles");
    path.push(user_id);

    if !path.exists() {
        std::fs::create_dir_all(&path).expect("Could not create browser data directory");
    }
    path
}

pub fn get_db_path() -> String {
    let mut path = get_app_dir();
    path.push("app.db");
    format!("sqlite://{}?mode=rwc", path.to_str().expect("Invalid path"))
}

pub fn get_images_dir() -> PathBuf {
    let mut path = get_app_dir();
    path.push("images");
    if !path.exists() {
        std::fs::create_dir_all(&path).expect("Could not create images directory");
    }
    path
}

pub fn clear_browser_lock(user_id: &str) {
    let base_path = get_browser_data_dir(user_id);

    // 需要清理的锁文件和套接字列表
    let targets = vec![
        "SingletonLock",
        "SingletonCookie",
        "SingletonSocket",
        "DevToolsActivePort",
        "Default/DevToolsActivePort", // 有些版本在这里
    ];

    for target in targets {
        let mut path = base_path.clone();
        path.push(target);
        if path.exists() {
            // 对于符号链接和普通文件，remove_file 均有效
            let _ = std::fs::remove_file(&path);
        }
    }
}
