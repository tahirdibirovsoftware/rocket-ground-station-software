//! Tauri command handlers — invoked from the frontend via `invoke("command_name")`.
//!
//! Each function is a `#[tauri::command]` that accesses shared `AppState`
//! and performs the requested operation.

use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, State};

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
pub async fn connect_rocket(
    app: AppHandle,
    state: State<'_, AppState>,
    port: String,
    baud_rate: Option<u32>,
) -> Result<String, String> {
    // Cannot connect if in Mock mode
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
            // Update status
            {
                let mut status = state.connection_status.lock().unwrap();
                status.mode = ConnectionMode::Serial;
                status.rocket_port = Some(port.clone());
            }

            // Start thread
            state.rocket_cancel.store(false, Ordering::Relaxed);
            spawn_serial_reader_loop(app.clone(), state.rocket_cancel.clone(), serial_port);

            // Ensure logger is active
            {
                let mut logger = state.csv_logger.lock().unwrap();
                if logger.is_none() {
                    if let Ok(l) = CsvLogger::with_default_dir() {
                        *logger = Some(l);
                    }
                }
            }

            let status_clone = state.connection_status.lock().unwrap().clone();
            emit_connection_status(&app, &status_clone);

            log::info!("Connected Rocket to {port}");
            Ok("Connected".to_string())
        }
        Err(e) => Err(format!("Failed to open rocket port: {e}")),
    }
}

#[tauri::command]
pub fn disconnect_rocket(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.rocket_cancel.store(true, Ordering::Relaxed);

    {
        let mut status = state.connection_status.lock().unwrap();
        status.rocket_port = None;
        if status.payload_port.is_none() {
            status.mode = ConnectionMode::Disconnected;
            state.frame_parser.lock().unwrap().reset();
        }
    }

    let status_clone = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status_clone);

    log::info!("Disconnected Rocket");
    Ok("Disconnected".to_string())
}

#[tauri::command]
pub async fn connect_payload(
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
                status.payload_port = Some(port.clone());
            }

            state.payload_cancel.store(false, Ordering::Relaxed);
            spawn_serial_reader_loop(app.clone(), state.payload_cancel.clone(), serial_port);

            {
                let mut logger = state.csv_logger.lock().unwrap();
                if logger.is_none() {
                    if let Ok(l) = CsvLogger::with_default_dir() {
                        *logger = Some(l);
                    }
                }
            }

            let status_clone = state.connection_status.lock().unwrap().clone();
            emit_connection_status(&app, &status_clone);

            log::info!("Connected Payload to {port}");
            Ok("Connected".to_string())
        }
        Err(e) => Err(format!("Failed to open payload port: {e}")),
    }
}

#[tauri::command]
pub fn disconnect_payload(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.payload_cancel.store(true, Ordering::Relaxed);

    {
        let mut status = state.connection_status.lock().unwrap();
        status.payload_port = None;
        if status.rocket_port.is_none() {
            status.mode = ConnectionMode::Disconnected;
            state.frame_parser.lock().unwrap().reset();
        }
    }

    let status_clone = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status_clone);

    log::info!("Disconnected Payload");
    Ok("Disconnected".to_string())
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
            match port.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let parsed = parser.feed(&buffer[0..n]);
                    
                    if !parsed.is_empty() {
                        let state = app_handle.state::<AppState>();
                        for p in parsed {
                            match p {
                                ParsedPacket::Rocket(ref rkt) => {
                                    emit_rocket_telemetry(&app_handle, rkt);
                                    let mut status = state.connection_status.lock().unwrap();
                                    status.rocket_packets_received += 1;
                                }
                                ParsedPacket::Payload(ref pld) => {
                                    emit_payload_telemetry(&app_handle, pld);
                                    let mut status = state.connection_status.lock().unwrap();
                                    status.payload_packets_received += 1;
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

    {
        let mut logger = state.csv_logger.lock().unwrap();
        if let Ok(l) = CsvLogger::with_default_dir() {
            *logger = Some(l);
        }
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

            let packets = generator.generate_tick(tick);

            if packets.is_empty() {
                log::info!("Mock flight simulation complete at tick {tick}");
                mock_state.stop();
                break;
            }

            for mock_pkt in &packets {
                let bytes = match mock_pkt {
                    MockPacket::Rocket(b) => b.as_slice(),
                    MockPacket::Payload(b) => b.as_slice(),
                };

                let parsed = frame_parser.feed(bytes);
                for p in parsed {
                    match p {
                        ParsedPacket::Rocket(ref rkt) => emit_rocket_telemetry(&app_handle, rkt),
                        ParsedPacket::Payload(ref pld) => emit_payload_telemetry(&app_handle, pld),
                    }
                }
            }

            tick += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
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

    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Disconnected;
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
