//! Tauri event emission — pushes telemetry data to the frontend.
//!
//! Events are emitted to the frontend webview using Tauri's event system.
//! The frontend listens with `listen("event-name", callback)`.

use tauri::{AppHandle, Emitter};

use crate::protocol::rocket_packet::RocketPacket;
use crate::protocol::payload_packet::PayloadPacket;
use super::state::ConnectionStatus;

/// Event name for rocket avionics telemetry.
pub const EVENT_ROCKET_TELEMETRY: &str = "rocket-telemetry";

/// Event name for payload scientific telemetry.
pub const EVENT_PAYLOAD_TELEMETRY: &str = "payload-telemetry";

/// Event name for connection status updates.
pub const EVENT_CONNECTION_STATUS: &str = "connection-status";

/// Emit a rocket telemetry packet to the frontend.
pub fn emit_rocket_telemetry(app: &AppHandle, packet: &RocketPacket) {
    if let Err(e) = app.emit(EVENT_ROCKET_TELEMETRY, packet) {
        log::error!("Failed to emit rocket telemetry: {e}");
    }
}

/// Emit a payload telemetry packet to the frontend.
pub fn emit_payload_telemetry(app: &AppHandle, packet: &PayloadPacket) {
    if let Err(e) = app.emit(EVENT_PAYLOAD_TELEMETRY, packet) {
        log::error!("Failed to emit payload telemetry: {e}");
    }
}

/// Emit a connection status update to the frontend.
pub fn emit_connection_status(app: &AppHandle, status: &ConnectionStatus) {
    if let Err(e) = app.emit(EVENT_CONNECTION_STATUS, status) {
        log::error!("Failed to emit connection status: {e}");
    }
}
