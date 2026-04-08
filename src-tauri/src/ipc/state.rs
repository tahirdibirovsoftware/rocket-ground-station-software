//! Shared application state managed by Tauri.
//!
//! This state is injected into the Tauri app builder and accessible
//! in all command handlers via `tauri::State<AppState>`.

use std::sync::{Arc, Mutex};

use crate::logger::csv_writer::CsvLogger;
use crate::mock::generator::MockState;
use crate::serial::reader::FrameParser;

use serde::{Deserialize, Serialize};

/// Connection mode — how the backend is receiving data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionMode {
    /// Not connected to anything.
    Disconnected,
    /// Connected to a real serial port.
    Serial,
    /// Using the mock data generator.
    Mock,
}

/// Connection status sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub mode: ConnectionMode,
    pub rocket_port: Option<String>,
    pub payload_port: Option<String>,
    pub rocket_packets_received: u64,
    pub payload_packets_received: u64,
    pub checksum_failures: u64,
    pub uptime_ms: u64,
}

impl Default for ConnectionStatus {
    fn default() -> Self {
        Self {
            mode: ConnectionMode::Disconnected,
            rocket_port: None,
            payload_port: None,
            rocket_packets_received: 0,
            payload_packets_received: 0,
            checksum_failures: 0,
            uptime_ms: 0,
        }
    }
}

/// Application state shared across all IPC handlers.
///
/// Uses `Arc<Mutex<T>>` for interior mutability behind Tauri's state system.
pub struct AppState {
    /// Mock generator controls.
    pub mock_state: Arc<MockState>,
    /// Frame parser for incoming serial data.
    pub frame_parser: Mutex<FrameParser>,
    /// CSV logger for packet persistence.
    pub csv_logger: Mutex<Option<CsvLogger>>,
    /// Current connection status.
    pub connection_status: Mutex<ConnectionStatus>,
    /// Flag indicating if a serial read loop is active.
    pub serial_active: Arc<std::sync::atomic::AtomicBool>,
    /// Handle to cancel the active data loop (mock or serial).
    pub cancel_token: Arc<std::sync::atomic::AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mock_state: Arc::new(MockState::new()),
            frame_parser: Mutex::new(FrameParser::new()),
            csv_logger: Mutex::new(None),
            connection_status: Mutex::new(ConnectionStatus::default()),
            serial_active: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            cancel_token: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Update stats from the frame parser into the connection status.
    pub fn sync_stats(&self) {
        let parser = self.frame_parser.lock().unwrap();
        let mut status = self.connection_status.lock().unwrap();
        status.rocket_packets_received = parser.stats.rocket_packets;
        status.payload_packets_received = parser.stats.payload_packets;
        status.checksum_failures = parser.stats.checksum_failures;
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
