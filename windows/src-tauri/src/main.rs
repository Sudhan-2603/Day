// Day runs without a console window: Day is the whole UI.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let path = std::env::var("LOCALAPPDATA")
            .map(|l| std::path::PathBuf::from(l).join("Day").join("panic.log"))
            .unwrap_or_else(|_| std::path::PathBuf::from("panic.log"));
        let _ = std::fs::write(path, format!("PANIC: {info:?}\n"));
    }));
    Day_lib::run()
}
