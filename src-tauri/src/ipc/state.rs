//! Shared application state managed by Tauri.

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
    pub rfd_port: Option<String>,
    pub rocket_packets_received: u64,
    pub payload_packets_received: u64,
    pub drone_packets_received: u64,
    pub checksum_failures: u64,
    pub uptime_ms: u64,
}

impl Default for ConnectionStatus {
    fn default() -> Self {
        Self {
            mode: ConnectionMode::Disconnected,
            rfd_port: None,
            rocket_packets_received: 0,
            payload_packets_received: 0,
            drone_packets_received: 0,
            checksum_failures: 0,
            uptime_ms: 0,
        }
    }
}

/// Application state shared across all IPC handlers.
pub struct AppState {
    /// Mock generator controls.
    pub mock_state: Arc<MockState>,
    /// Frame parser for incoming serial data.
    pub frame_parser: Mutex<FrameParser>,
    /// CSV logger for packet persistence.
    pub csv_logger: Mutex<Option<CsvLogger>>,
    /// Current connection status.
    pub connection_status: Mutex<ConnectionStatus>,
    /// Handle to cancel the RFD serial read loop.
    pub rfd_cancel: Arc<std::sync::atomic::AtomicBool>,
    /// Handle to cancel the Mock data loop.
    pub mock_cancel: Arc<std::sync::atomic::AtomicBool>,
    /// Native camera streaming state.
    pub camera_state: crate::camera::CameraState,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mock_state: Arc::new(MockState::new()),
            frame_parser: Mutex::new(FrameParser::new()),
            csv_logger: Mutex::new(None),
            connection_status: Mutex::new(ConnectionStatus::default()),
            rfd_cancel: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            mock_cancel: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            camera_state: crate::camera::CameraState::new(),
        }
    }

    /// Update stats from the frame parser into the connection status.
    pub fn sync_stats(&self) {
        let parser = self.frame_parser.lock().unwrap();
        let mut status = self.connection_status.lock().unwrap();
        status.rocket_packets_received = parser.stats.rocket_packets;
        status.payload_packets_received = parser.stats.payload_packets;
        status.drone_packets_received = parser.stats.drone_packets;
        status.checksum_failures = parser.stats.checksum_failures;
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
