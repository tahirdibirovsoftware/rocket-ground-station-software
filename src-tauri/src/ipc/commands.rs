use std::sync::atomic::Ordering;
use std::time::Instant;
use tauri::{AppHandle, State, Manager};

use crate::mock::generator::{MockGenerator, MockPacket};

use crate::serial::config::{list_available_ports, PortInfo, SerialPortConfig};
use crate::serial::reader::{FrameParser, ParsedPacket};
use crate::logger::csv_writer::CsvLogger;

use super::events::*;
use super::state::*;

// ============================================================================
// Serial Port Commands
// ============================================================================

/// List all available serial ports on the system.
#[tauri::command]
pub fn list_serial_ports() -> Vec<PortInfo> {
    log::info!("Listing serial ports...");
    list_available_ports()
}

#[tauri::command]
pub async fn connect_rfd(
    app: AppHandle,
    state: State<'_, AppState>,
    port: String,
    baud_rate: Option<u32>,
) -> Result<String, String> {
    {
        let status = state.connection_status.lock().unwrap();
        if status.mode == ConnectionMode::Mock {
            return Err("Cannot connect while in Mock mode. Stop Mock first.".to_string());
        }
    }

    let baud = baud_rate.unwrap_or(crate::serial::config::DEFAULT_BAUD_RATE);
    let config = SerialPortConfig::new(&port).with_baud_rate(baud);

    match crate::serial::reader::open_serial_port(&config) {
        Ok(serial_port) => {
            {
                let mut status = state.connection_status.lock().unwrap();
                status.mode = ConnectionMode::Serial;
                status.rfd_port = Some(port.clone());
            }

            state.rfd_cancel.store(false, Ordering::Relaxed);
            let writer_port = serial_port
                .try_clone()
                .map_err(|e| format!("Failed to clone RFD port for downlink: {e}"))?;
            {
                let mut writer = state.rfd_writer.lock().unwrap();
                *writer = Some(writer_port);
            }
            spawn_serial_reader_loop(app.clone(), state.rfd_cancel.clone(), serial_port);

            let session_dir = {
                let mut logger = state.csv_logger.lock().unwrap();
                let l = CsvLogger::with_default_dir().map_err(|e| e.to_string())?;
                let dir = l.session_dir.clone();
                *logger = Some(l);
                dir
            };

            // Auto-start camera & video recording into session folder if USB camera is available
            let usb_dev = crate::camera::list_video_devices().into_iter().find(|dev| dev.is_usb);
            if let Some(cam) = usb_dev {
                let _ = crate::camera::start_stream(app.clone(), &state.camera_state, cam.id, Some(session_dir));
            }

            let status_clone = state.connection_status.lock().unwrap().clone();
            emit_connection_status(&app, &status_clone);

            log::info!("Connected RFD receiver to {port}");
            Ok("Connected".to_string())
        }
        Err(e) => Err(format!("Failed to open RFD port: {e}")),
    }
}

#[tauri::command]
pub fn disconnect_rfd(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.rfd_cancel.store(true, Ordering::Relaxed);
    state.camera_state.stop();

    {
        let mut status = state.connection_status.lock().unwrap();
        status.rfd_port = None;
        status.mode = ConnectionMode::Disconnected;
        state.frame_parser.lock().unwrap().reset();
        let mut logger = state.csv_logger.lock().unwrap();
        *logger = None;
        let mut writer = state.rfd_writer.lock().unwrap();
        *writer = None;
    }

    let status_clone = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status_clone);

    log::info!("Disconnected RFD receiver");
    Ok("Disconnected".to_string())
}

/// Command the drone engine over the RFD downlink.
///
/// Sends a newline-terminated text command over the connected RFD serial port:
/// "ARM_ON" = ARM (engine ON), "ARM_OFF" = DISARM (engine OFF).
/// In Mock mode the command is applied to the simulated drone instead.
#[tauri::command]
pub async fn set_drone_engine(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<String, String> {
    use std::io::Write;

    let mode = state.connection_status.lock().unwrap().mode.clone();

    match mode {
        ConnectionMode::Serial => {
            let mut writer = state.rfd_writer.lock().unwrap();
            let port = writer
                .as_mut()
                .ok_or_else(|| "RFD serial writer unavailable".to_string())?;

            let cmd: &[u8] = if enabled { b"ARM_ON\n" } else { b"ARM_OFF\n" };
            port.write_all(cmd)
                .map_err(|e| format!("Failed to send drone command: {e}"))?;
            port.flush()
                .map_err(|e| format!("Failed to flush RFD serial: {e}"))?;
            drop(writer);

            log::info!(
                "Sent drone engine command: {}",
                if enabled { "ARM_ON" } else { "ARM_OFF" }
            );
            Ok(format!(
                "Drone engine {}",
                if enabled { "ARMED" } else { "DISARMED" }
            ))
        }
        ConnectionMode::Mock => {
            state.mock_state.set_drone_arm(enabled);
            log::info!(
                "Mock drone engine command: {}",
                if enabled { "ARM_ON" } else { "ARM_OFF" }
            );
            Ok(format!(
                "Mock drone engine {}",
                if enabled { "ARMED" } else { "DISARMED" }
            ))
        }
        ConnectionMode::Disconnected => {
            Err("RFD link is not connected. Connect RFD or start Mock first.".to_string())
        }
    }
}

fn spawn_serial_reader_loop(
    app_handle: AppHandle,
    cancel_token: std::sync::Arc<std::sync::atomic::AtomicBool>,
    mut port: Box<dyn serialport::SerialPort>,
) {
    use tauri::Manager;
    std::thread::spawn(move || {
        let mut parser = FrameParser::new();
        let mut buffer: [u8; 1024] = [0; 1024];

        log::info!("Hardware reader loop started");

        while !cancel_token.load(std::sync::atomic::Ordering::Relaxed) {
            let read_result = port.read(&mut buffer);

            match read_result {
                Ok(n) if n > 0 => {
                    let parsed = parser.feed(&buffer[0..n]);

                    // Propagate uplink command ACK stats from the parser
                    let state: State<'_, AppState> = app_handle.state();
                    {
                        let mut status = state.connection_status.lock().unwrap();
                        status.uplink_acks = parser.stats.uplink_acks;
                        status.last_uplink_ack = parser.stats.last_uplink_ack;
                    }

                    if !parsed.is_empty() {
                        for p in parsed {
                            let mut logger = state.csv_logger.lock().unwrap();
                            match p {
                                ParsedPacket::Rocket(ref rkt) => {
                                    emit_rocket_telemetry(&app_handle, rkt);
                                    let mut status = state.connection_status.lock().unwrap();
                                    status.rocket_packets_received += 1;
                                    if let Some(ref mut l) = *logger {
                                        if let Err(e) = l.write_rocket(rkt) {
                                            log::error!("Failed to write rocket log: {e}");
                                        }
                                    }
                                }
                                ParsedPacket::Payload(ref pld) => {
                                    emit_payload_telemetry(&app_handle, pld);
                                    let mut status = state.connection_status.lock().unwrap();
                                    status.payload_packets_received += 1;
                                    if let Some(ref mut l) = *logger {
                                        if let Err(e) = l.write_payload(pld) {
                                            log::error!("Failed to write payload log: {e}");
                                        }
                                    }
                                }
                                ParsedPacket::Drone(ref drn) => {
                                    emit_drone_telemetry(&app_handle, drn);
                                    let mut status = state.connection_status.lock().unwrap();
                                    status.drone_packets_received += 1;
                                    if let Some(ref mut l) = *logger {
                                        if let Err(e) = l.write_drone(drn) {
                                            log::error!("Failed to write drone log: {e}");
                                        }
                                    }
                                }
                                ParsedPacket::PayloadStatus {
                                    on_ground,
                                    flight_phase,
                                    outputs_active,
                                } => {
                                    emit_payload_status(
                                        &app_handle,
                                        on_ground,
                                        flight_phase,
                                        outputs_active,
                                    );
                                }
                                ParsedPacket::DroneStatus {
                                    state_code,
                                    throttle_us,
                                    armed,
                                } => {
                                    emit_drone_status(&app_handle, state_code, throttle_us, armed);
                                }
                            }
                        }
                    }
                }
                Ok(_) => {
                    std::thread::sleep(std::time::Duration::from_millis(5));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(e) => {
                    log::error!("Serial read error: {}", e);
                    break;
                }
            }
        }
        log::info!("Hardware reader loop stopped");
    });
}

// ============================================================================
// Mock Data Commands
// ============================================================================

/// Start the mock data generator.
#[tauri::command]
pub async fn start_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    {
        let status = state.connection_status.lock().unwrap();
        if status.mode != ConnectionMode::Disconnected {
            return Err("Already connected. Disconnect first.".to_string());
        }
    }

    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Mock;
    }

    state.mock_state.start();
    state.mock_cancel.store(false, Ordering::Relaxed);

    let session_dir = {
        let mut logger = state.csv_logger.lock().unwrap();
        let l = CsvLogger::with_default_dir().map_err(|e| e.to_string())?;
        let dir = l.session_dir.clone();
        *logger = Some(l);
        dir
    };

    // Auto-start camera & video recording into session folder if USB camera is available
    let usb_dev = crate::camera::list_video_devices().into_iter().find(|dev| dev.is_usb);
    if let Some(cam) = usb_dev {
        let _ = crate::camera::start_stream(app.clone(), &state.camera_state, cam.id, Some(session_dir));
    }

    let mock_state = state.mock_state.clone();
    let cancel_token = state.mock_cancel.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let generator = MockGenerator::with_defaults();
        let mut tick: u64 = 0;
        let start_time = Instant::now();
        let mut frame_parser = FrameParser::new();

        log::info!("Mock data generator started");

        loop {
            if cancel_token.load(Ordering::Relaxed) || !mock_state.is_running() {
                break;
            }

            let elapsed_ms = start_time.elapsed().as_millis() as u64;
            mock_state.set_elapsed_ms(elapsed_ms);

            let packets = generator.generate_tick_with_arm(tick, mock_state.drone_arm_command());

            if packets.is_empty() {
                log::info!("Mock flight simulation complete at tick {tick}");
                mock_state.stop();
                break;
            }

            for mock_pkt in &packets {
                let bytes = match mock_pkt {
                    MockPacket::Rocket(b) => b.as_slice(),
                    MockPacket::Payload(b) => b.as_slice(),
                    MockPacket::Drone(b) => b.as_slice(),
                };

                let parsed = frame_parser.feed(bytes);
                let state: State<'_, AppState> = app_handle.state();
                {
                    let mut status = state.connection_status.lock().unwrap();
                    status.uplink_acks = frame_parser.stats.uplink_acks;
                    status.last_uplink_ack = frame_parser.stats.last_uplink_ack;
                }
                for p in parsed {
                    let mut logger = state.csv_logger.lock().unwrap();
                    match p {
                        ParsedPacket::Rocket(ref rkt) => {
                            emit_rocket_telemetry(&app_handle, rkt);
                            let mut status = state.connection_status.lock().unwrap();
                            status.rocket_packets_received += 1;
                            if let Some(ref mut l) = *logger {
                                if let Err(e) = l.write_rocket(rkt) {
                                    log::error!("Failed to write rocket log: {e}");
                                }
                            }
                        }
                        ParsedPacket::Payload(ref pld) => {
                            emit_payload_telemetry(&app_handle, pld);
                            let mut status = state.connection_status.lock().unwrap();
                            status.payload_packets_received += 1;
                            if let Some(ref mut l) = *logger {
                                if let Err(e) = l.write_payload(pld) {
                                    log::error!("Failed to write payload log: {e}");
                                }
                            }
                        }
                        ParsedPacket::Drone(ref drn) => {
                            emit_drone_telemetry(&app_handle, drn);
                            let mut status = state.connection_status.lock().unwrap();
                            status.drone_packets_received += 1;
                            if let Some(ref mut l) = *logger {
                                if let Err(e) = l.write_drone(drn) {
                                    log::error!("Failed to write drone log: {e}");
                                }
                            }
                        }
                        ParsedPacket::PayloadStatus {
                            on_ground,
                            flight_phase,
                            outputs_active,
                        } => {
                            emit_payload_status(
                                &app_handle,
                                on_ground,
                                flight_phase,
                                outputs_active,
                            );
                        }
                        ParsedPacket::DroneStatus {
                            state_code,
                            throttle_us,
                            armed,
                        } => {
                            emit_drone_status(&app_handle, state_code, throttle_us, armed);
                        }
                    }
                }
            }

            tick += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(66)).await; // 15 Hz RF rate
        }

        log::info!("Mock data generator stopped");
    });

    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    Ok("Mock data generator started".to_string())
}

#[tauri::command]
pub fn stop_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.mock_state.stop();
    state.mock_cancel.store(true, Ordering::Relaxed);
    state.camera_state.stop();

    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Disconnected;
        let mut logger = state.csv_logger.lock().unwrap();
        *logger = None;
    }

    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    log::info!("Mock data generator stopped");
    Ok("Mock data generator stopped".to_string())
}

#[tauri::command]
pub fn reset_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.mock_state.reset();
    state.mock_cancel.store(true, Ordering::Relaxed);

    state.frame_parser.lock().unwrap().reset_all();

    {
        let mut status = state.connection_status.lock().unwrap();
        *status = ConnectionStatus::default();
    }

    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    Ok("Mock data generator reset".to_string())
}

// ============================================================================
// Status Command
// ============================================================================

#[tauri::command]
pub fn get_connection_status(state: State<'_, AppState>) -> ConnectionStatus {
    state.sync_stats();
    state.connection_status.lock().unwrap().clone()
}

// ============================================================================
// Native Camera Commands
// ============================================================================

#[tauri::command]
pub fn list_cameras() -> Vec<crate::camera::CameraDeviceInfo> {
    crate::camera::list_video_devices()
}

#[tauri::command]
pub fn start_camera(
    app: AppHandle,
    state: State<'_, AppState>,
    device: Option<String>,
) -> Result<crate::camera::CameraDeviceInfo, String> {
    let devices = crate::camera::list_video_devices();
    if devices.is_empty() {
        return Err("No video devices detected on host system".to_string());
    }

    let target_device = match device {
        Some(ref d) if !d.is_empty() => devices.into_iter().find(|dev| &dev.id == d),
        _ => devices.into_iter().find(|dev| dev.is_usb),
    }
    .ok_or_else(|| "No external USB camera device found".to_string())?;

    let session_dir = state
        .csv_logger
        .lock()
        .unwrap()
        .as_ref()
        .map(|l| l.session_dir.clone());

    crate::camera::start_stream(
        app,
        &state.camera_state,
        target_device.id.clone(),
        session_dir,
    )?;
    Ok(target_device)
}

#[tauri::command]
pub fn stop_camera(state: State<'_, AppState>) {
    state.camera_state.stop();
}

// ============================================================================
// Cross-Platform Flight Artifact Commands
// ============================================================================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ArtifactFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FlightArtifactInfo {
    pub folder_name: String,
    pub folder_path: String,
    pub created_at: String,
    pub files: Vec<ArtifactFileInfo>,
    pub has_video: bool,
    pub total_size_bytes: u64,
}

#[tauri::command]
pub fn list_flight_artifacts() -> Vec<FlightArtifactInfo> {
    use std::fs;
    use std::path::PathBuf;

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/tmp".to_string());
    let root_dir = PathBuf::from(home).join(crate::logger::csv_writer::DEFAULT_LOG_DIR);

    let mut artifacts = Vec::new();
    if !root_dir.exists() {
        return artifacts;
    }

    if let Ok(entries) = fs::read_dir(&root_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let folder_name = entry.file_name().to_string_lossy().to_string();
            if !folder_name.starts_with("flight_") {
                continue;
            }

            let mut files = Vec::new();
            let mut total_size_bytes = 0u64;
            let mut has_video = false;

            if let Ok(file_entries) = fs::read_dir(&path) {
                for file_entry in file_entries.flatten() {
                    let file_path = file_entry.path();
                    if file_path.is_file() {
                        let name = file_entry.file_name().to_string_lossy().to_string();
                        let meta = file_entry.metadata().ok();
                        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                        total_size_bytes += size_bytes;

                        if name.ends_with(".mp4") || name.ends_with(".mkv") || name.ends_with(".avi") {
                            has_video = true;
                        }

                        files.push(ArtifactFileInfo {
                            name,
                            path: file_path.to_string_lossy().to_string(),
                            size_bytes,
                        });
                    }
                }
            }

            let created_at = folder_name
                .strip_prefix("flight_")
                .map(|s| s.replace('_', " "))
                .unwrap_or_else(|| folder_name.clone());

            artifacts.push(FlightArtifactInfo {
                folder_name,
                folder_path: path.to_string_lossy().to_string(),
                created_at,
                files,
                has_video,
                total_size_bytes,
            });
        }
    }

    artifacts.sort_by(|a, b| b.folder_name.cmp(&a.folder_name));
    artifacts
}

#[tauri::command]
pub fn open_artifact_folder(folder_path: String) -> Result<(), String> {
    use std::path::Path;

    let path = Path::new(&folder_path);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_artifact_folder(folder_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&folder_path);
    if path.exists() && path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_artifact_file(file_path: String) -> Result<(), String> {
    use std::path::Path;

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
