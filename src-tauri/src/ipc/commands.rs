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

/// Connect to serial ports for rocket and/or payload telemetry.
///
/// Starts an async read loop that reads from the serial port(s),
/// parses packets, logs to CSV, and emits to the frontend.
#[tauri::command]
pub async fn connect_serial(
    _app: AppHandle,
    state: State<'_, AppState>,
    rocket_port: Option<String>,
    payload_port: Option<String>,
    baud_rate: Option<u32>,
) -> Result<String, String> {
    // Check if already connected
    {
        let status = state.connection_status.lock().unwrap();
        if status.mode != ConnectionMode::Disconnected {
            return Err("Already connected. Disconnect first.".to_string());
        }
    }

    let baud = baud_rate.unwrap_or(crate::serial::config::DEFAULT_BAUD_RATE);

    // Validate at least one port is specified
    if rocket_port.is_none() && payload_port.is_none() {
        return Err("At least one port must be specified.".to_string());
    }

    // Open ports
    let mut ports_opened = Vec::new();

    if let Some(ref path) = rocket_port {
        let config = SerialPortConfig::new(path).with_baud_rate(baud);
        match crate::serial::reader::open_serial_port(&config) {
            Ok(_port) => {
                ports_opened.push(format!("rocket:{path}"));
                log::info!("Opened rocket port: {path} @ {baud} baud");
            }
            Err(e) => return Err(format!("Failed to open rocket port: {e}")),
        }
    }

    if let Some(ref path) = payload_port {
        let config = SerialPortConfig::new(path).with_baud_rate(baud);
        match crate::serial::reader::open_serial_port(&config) {
            Ok(_port) => {
                ports_opened.push(format!("payload:{path}"));
                log::info!("Opened payload port: {path} @ {baud} baud");
            }
            Err(e) => return Err(format!("Failed to open payload port: {e}")),
        }
    }

    // Initialize CSV logger
    {
        let mut logger = state.csv_logger.lock().unwrap();
        match CsvLogger::with_default_dir() {
            Ok(l) => *logger = Some(l),
            Err(e) => log::warn!("Failed to initialize CSV logger: {e}"),
        }
    }

    // Update connection status
    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Serial;
        status.rocket_port = rocket_port;
        status.payload_port = payload_port;
    }

    state.serial_active.store(true, Ordering::Relaxed);
    state.cancel_token.store(false, Ordering::Relaxed);

    let msg = format!("Connected: {}", ports_opened.join(", "));
    log::info!("{msg}");
    Ok(msg)
}

/// Disconnect from serial ports.
#[tauri::command]
pub fn disconnect_serial(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Signal the read loop to stop
    state.cancel_token.store(true, Ordering::Relaxed);
    state.serial_active.store(false, Ordering::Relaxed);

    // Reset parser
    state.frame_parser.lock().unwrap().reset();

    // Update status
    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Disconnected;
        status.rocket_port = None;
        status.payload_port = None;
    }

    // Emit disconnected status
    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    log::info!("Serial disconnected");
    Ok("Disconnected".to_string())
}

// ============================================================================
// Mock Data Commands
// ============================================================================

/// Start the mock data generator.
///
/// Spawns an async task that generates and emits telemetry at realistic rates:
/// - Rocket avionics: 1 Hz
/// - Payload scientific: 5 Hz
#[tauri::command]
pub async fn start_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Check current state
    {
        let status = state.connection_status.lock().unwrap();
        if status.mode != ConnectionMode::Disconnected {
            return Err("Already connected. Disconnect first.".to_string());
        }
    }

    // Update status to mock mode
    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Mock;
    }

    state.mock_state.start();
    state.cancel_token.store(false, Ordering::Relaxed);

    // Initialize CSV logger
    {
        let mut logger = state.csv_logger.lock().unwrap();
        match CsvLogger::with_default_dir() {
            Ok(l) => *logger = Some(l),
            Err(e) => log::warn!("Failed to initialize CSV logger: {e}"),
        }
    }

    // Clone what we need for the async task
    let mock_state = state.mock_state.clone();
    let cancel_token = state.cancel_token.clone();
    let app_handle = app.clone();

    // Spawn the mock data loop
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

            // Generate packets for this tick
            let packets = generator.generate_tick(tick);

            if packets.is_empty() {
                // Flight ended
                log::info!("Mock flight simulation complete at tick {tick}");
                mock_state.stop();
                break;
            }

            for mock_pkt in &packets {
                let bytes = match mock_pkt {
                    MockPacket::Rocket(b) => b.as_slice(),
                    MockPacket::Payload(b) => b.as_slice(),
                };

                // Parse through FrameParser (validates checksum)
                let parsed = frame_parser.feed(bytes);
                for p in parsed {
                    match p {
                        ParsedPacket::Rocket(ref rkt) => {
                            emit_rocket_telemetry(&app_handle, rkt);
                        }
                        ParsedPacket::Payload(ref pld) => {
                            emit_payload_telemetry(&app_handle, pld);
                        }
                    }
                }
            }

            tick += 1;

            // Sleep 200ms (5 Hz tick rate)
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }

        log::info!("Mock data generator stopped");
    });

    // Emit initial status
    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    Ok("Mock data generator started".to_string())
}

/// Stop the mock data generator.
#[tauri::command]
pub fn stop_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.mock_state.stop();
    state.cancel_token.store(true, Ordering::Relaxed);

    // Update status
    {
        let mut status = state.connection_status.lock().unwrap();
        status.mode = ConnectionMode::Disconnected;
    }

    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    log::info!("Mock data generator stopped");
    Ok("Mock data generator stopped".to_string())
}

/// Reset the mock data generator (stop + reset elapsed time).
#[tauri::command]
pub fn reset_mock(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.mock_state.reset();
    state.cancel_token.store(true, Ordering::Relaxed);

    // Reset parser
    state.frame_parser.lock().unwrap().reset_all();

    // Update status
    {
        let mut status = state.connection_status.lock().unwrap();
        *status = ConnectionStatus::default();
    }

    let status = state.connection_status.lock().unwrap().clone();
    emit_connection_status(&app, &status);

    log::info!("Mock data generator reset");
    Ok("Mock data generator reset".to_string())
}

// ============================================================================
// Status Command
// ============================================================================

/// Get the current connection status.
#[tauri::command]
pub fn get_connection_status(state: State<'_, AppState>) -> ConnectionStatus {
    state.sync_stats();
    state.connection_status.lock().unwrap().clone()
}
