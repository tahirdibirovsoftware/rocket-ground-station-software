//! Tauri event emission — pushes telemetry data to the frontend.

use tauri::{AppHandle, Emitter};

use serde::Serialize;

use crate::protocol::telemetry_packet::TelemetryPacket;
use super::state::ConnectionStatus;

/// Event name for rocket avionics telemetry.
pub const EVENT_ROCKET_TELEMETRY: &str = "rocket-telemetry";

/// Event name for payload scientific telemetry.
pub const EVENT_PAYLOAD_TELEMETRY: &str = "payload-telemetry";

/// Event name for drone telemetry.
pub const EVENT_DRONE_TELEMETRY: &str = "drone-telemetry";

/// Event name for payload status events (binary RF_PKT_STATUS).
pub const EVENT_PAYLOAD_STATUS: &str = "payload-status";

/// Event name for drone status events (binary RF_PKT_STATUS).
pub const EVENT_DRONE_STATUS: &str = "drone-status";

/// Event name for connection status updates.
pub const EVENT_CONNECTION_STATUS: &str = "connection-status";

/// Payload status event payload.
#[derive(Debug, Clone, Serialize)]
pub struct PayloadStatusEvent {
    /// true = payload landed, false = in sky.
    pub on_ground: bool,
    /// 0 = PRE_LAUNCH, 1 = IN_AIR, 2 = ON_GROUND.
    pub flight_phase: u8,
    /// Firmware output state (true=active / buzzer firing, false=cutoff on motion).
    pub outputs_active: bool,
}

/// Drone status event payload.
#[derive(Debug, Clone, Serialize)]
pub struct DroneStatusEvent {
    /// 0 = DISARMED, 1 = ARMED_WAIT, 2 = MOTORS_ON, 3 = MOTORS_HOLD, 4 = TOUCHDOWN, or flight_phase.
    pub state_code: u8,
    /// ESC throttle pulse width (µs).
    pub throttle_us: u16,
    /// RF arm state.
    pub armed: bool,
    /// Firmware flight phase (0=PRE_LAUNCH, 1=IN_AIR, 2=ON_GROUND).
    pub flight_phase: u8,
    /// Firmware output state (true=active / ESC/Buzzer firing, false=cutoff on motion).
    pub outputs_active: bool,
}

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

/// Emit a payload status event to the frontend.
pub fn emit_payload_status(
    app: &AppHandle,
    on_ground: bool,
    flight_phase: u8,
    outputs_active: bool,
) {
    let event = PayloadStatusEvent {
        on_ground,
        flight_phase,
        outputs_active,
    };
    if let Err(e) = app.emit(EVENT_PAYLOAD_STATUS, event) {
        log::error!("Failed to emit payload status: {e}");
    }
}

/// Emit a drone status event to the frontend.
pub fn emit_drone_status(app: &AppHandle, state_code: u8, throttle_us: u16, armed: bool) {
    let flight_phase = state_code;
    let outputs_active = throttle_us > 1000;
    let event = DroneStatusEvent {
        state_code,
        throttle_us,
        armed,
        flight_phase,
        outputs_active,
    };
    if let Err(e) = app.emit(EVENT_DRONE_STATUS, event) {
        log::error!("Failed to emit drone status: {e}");
    }
}

/// Emit a connection status update to the frontend.
pub fn emit_connection_status(app: &AppHandle, status: &ConnectionStatus) {
    if let Err(e) = app.emit(EVENT_CONNECTION_STATUS, status) {
        log::error!("Failed to emit connection status: {e}");
    }
}
