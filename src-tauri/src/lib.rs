//! AZST Ground Station — Tauri Backend
//!
//! Application entry point. Initializes the Tauri runtime with plugins,
//! managed state, and IPC command handlers.

pub mod protocol;
pub mod mock;
pub mod serial;
pub mod logger;
pub mod ipc;
pub mod camera;

use ipc::state::AppState;
use ipc::commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::list_serial_ports,
            commands::connect_rfd,
            commands::disconnect_rfd,
            commands::set_drone_engine,
            commands::start_mock,
            commands::stop_mock,
            commands::reset_mock,
            commands::get_connection_status,
            commands::list_cameras,
            commands::start_camera,
            commands::stop_camera,
            commands::list_flight_artifacts,
            commands::open_artifact_folder,
            commands::delete_artifact_folder,
            commands::open_artifact_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AZST Ground Station");
}
