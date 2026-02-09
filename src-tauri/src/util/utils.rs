use headless_chrome::Browser;
use sysinfo::{Pid, ProcessesToUpdate, System};

pub fn kill_process_by_pid(pid: u32) -> bool {
    let mut s = System::new_all();
    s.refresh_processes(ProcessesToUpdate::All, true);

    if let Some(process) = s.process(Pid::from(pid as usize)) {
        println!("正在关闭进程: {:?} (ID: {})", process.name(), pid);
        return process.kill();
    }
    println!("未找到 PID 为 {} 的进程", pid);
    false
}

// 杀掉浏览器进程
pub fn kill_browser_process(browser: &Browser) {
    match browser.get_process_id() {
        Some(pid) => kill_process_by_pid(pid),
        None => false,
    };
}
