//! Tauri event emission — pushes telemetry data to the frontend.

use tauri::{AppHandle, Emitter};

use crate::protocol::telemetry_packet::TelemetryPacket;
use super::state::ConnectionStatus;

/// Event name for rocket avionics telemetry.
pub const EVENT_ROCKET_TELEMETRY: &str = "rocket-telemetry";

/// Event name for payload scientific telemetry.
pub const EVENT_PAYLOAD_TELEMETRY: &str = "payload-telemetry";

/// Event name for drone telemetry.
pub const EVENT_DRONE_TELEMETRY: &str = "drone-telemetry";

/// Event name for connection status updates.
pub const EVENT_CONNECTION_STATUS: &str = "connection-status";

/// Emit a rocket telemetry packet to the frontend.
pub fn emit_rocket_telemetry(app: &AppHandle, packet: &TelemetryPacket) {
    if let Err(e) = app.emit(EVENT_ROCKET_TELEMETRY, packet) {
        log::error!("Failed to emit rocket telemetry: {e}");
    }
}

/// Emit a payload telemetry packet to the frontend.
pub fn emit_payload_telemetry(app: &AppHandle, packet: &TelemetryPacket) {
    if let Err(e) = app.emit(EVENT_PAYLOAD_TELEMETRY, packet) {
        log::error!("Failed to emit payload telemetry: {e}");
    }
}

/// Emit a drone telemetry packet to the frontend.
pub fn emit_drone_telemetry(app: &AppHandle, packet: &TelemetryPacket) {
    if let Err(e) = app.emit(EVENT_DRONE_TELEMETRY, packet) {
        log::error!("Failed to emit drone telemetry: {e}");
    }
}

/// Emit a connection status update to the frontend.
pub fn emit_connection_status(app: &AppHandle, status: &ConnectionStatus) {
    if let Err(e) = app.emit(EVENT_CONNECTION_STATUS, status) {
        log::error!("Failed to emit connection status: {e}");
    }
}
