//! AZST Ground Station — Tauri Backend
//!
//! Application entry point. Initializes the Tauri runtime with plugins and command handlers.
//! Serial port management and IPC events will be added in subsequent phases.

pub mod protocol;
pub mod mock;
pub mod serial;
pub mod logger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running AZST Ground Station");
}
