//! Tests for the IPC module.
//!
//! Covers:
//! - AppState initialization and sync
//! - ConnectionStatus defaults and serialization
//! - ConnectionMode serialization
//! - Event name constants match frontend
//! - MockState integration with AppState

use super::state::*;
use super::events::*;

// ============================================================================
// ConnectionMode Tests
// ============================================================================

#[test]
fn connection_mode_serialization() {
    assert_eq!(
        serde_json::to_string(&ConnectionMode::Disconnected).unwrap(),
        "\"disconnected\""
    );
    assert_eq!(
        serde_json::to_string(&ConnectionMode::Serial).unwrap(),
        "\"serial\""
    );
    assert_eq!(
        serde_json::to_string(&ConnectionMode::Mock).unwrap(),
        "\"mock\""
    );
}

#[test]
fn connection_mode_deserialization() {
    let mode: ConnectionMode = serde_json::from_str("\"disconnected\"").unwrap();
    assert_eq!(mode, ConnectionMode::Disconnected);

    let mode: ConnectionMode = serde_json::from_str("\"serial\"").unwrap();
    assert_eq!(mode, ConnectionMode::Serial);

    let mode: ConnectionMode = serde_json::from_str("\"mock\"").unwrap();
    assert_eq!(mode, ConnectionMode::Mock);
}

// ============================================================================
// ConnectionStatus Tests
// ============================================================================

#[test]
fn connection_status_defaults() {
    let status = ConnectionStatus::default();
    assert_eq!(status.mode, ConnectionMode::Disconnected);
    assert!(status.rocket_port.is_none());
    assert!(status.payload_port.is_none());
    assert_eq!(status.rocket_packets_received, 0);
    assert_eq!(status.payload_packets_received, 0);
    assert_eq!(status.checksum_failures, 0);
    assert_eq!(status.uptime_ms, 0);
}

#[test]
fn connection_status_serialization() {
    let status = ConnectionStatus {
        mode: ConnectionMode::Serial,
        rocket_port: Some("/dev/ttyUSB0".to_string()),
        payload_port: Some("/dev/ttyUSB1".to_string()),
        rocket_packets_received: 42,
        payload_packets_received: 210,
        checksum_failures: 3,
        uptime_ms: 60000,
    };

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"serial\""));
    assert!(json.contains("ttyUSB0"));
    assert!(json.contains("ttyUSB1"));
    assert!(json.contains("42"));
    assert!(json.contains("210"));

    // Round-trip
    let parsed: ConnectionStatus = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.mode, ConnectionMode::Serial);
    assert_eq!(parsed.rocket_packets_received, 42);
}

#[test]
fn connection_status_null_ports() {
    let status = ConnectionStatus::default();
    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"rocket_port\":null"));
    assert!(json.contains("\"payload_port\":null"));
}

// ============================================================================
// AppState Tests
// ============================================================================

#[test]
fn app_state_initial_values() {
    let state = AppState::new();
    assert!(!state.mock_state.is_running());
    assert!(!state.serial_active.load(std::sync::atomic::Ordering::Relaxed));
    assert!(!state.cancel_token.load(std::sync::atomic::Ordering::Relaxed));

    let status = state.connection_status.lock().unwrap();
    assert_eq!(status.mode, ConnectionMode::Disconnected);
}

#[test]
fn app_state_sync_stats() {
    let state = AppState::new();

    // Feed some packets through the parser
    {
        use crate::protocol::rocket_packet::{build_rocket_packet, FlightState, RocketPacket, ROCKET_PACKET_ID};
        use crate::protocol::payload_packet::{build_payload_packet, PayloadPacket, PAYLOAD_PACKET_ID};

        let rocket = RocketPacket {
            packet_id: ROCKET_PACKET_ID,
            timestamp_ms: 1000,
            altitude: 500.0,
            latitude: 38.0,
            longitude: 34.0,
            pressure1: 950.0,
            pressure2: 949.0,
            velocity: 100.0,
            flight_state: FlightState::Powered,
            primary_parachute_deployed: false,
            secondary_parachute_deployed: false,
        };
        let rocket_bytes = build_rocket_packet(&rocket);

        let payload = PayloadPacket {
            packet_id: PAYLOAD_PACKET_ID,
            timestamp_ms: 1000,
            latitude: 38.0,
            longitude: 34.0,
            altitude: 490.0,
            scientific_data: 25.0,
        };
        let payload_bytes = build_payload_packet(&payload);

        let mut parser = state.frame_parser.lock().unwrap();
        parser.feed(&rocket_bytes);
        parser.feed(&payload_bytes);
        parser.feed(&payload_bytes);
    }

    // Sync and check
    state.sync_stats();
    let status = state.connection_status.lock().unwrap();
    assert_eq!(status.rocket_packets_received, 1);
    assert_eq!(status.payload_packets_received, 2);
    assert_eq!(status.checksum_failures, 0);
}

#[test]
fn app_state_mock_controls() {
    let state = AppState::new();

    state.mock_state.start();
    assert!(state.mock_state.is_running());

    state.mock_state.stop();
    assert!(!state.mock_state.is_running());

    state.mock_state.reset();
    assert_eq!(state.mock_state.get_elapsed_ms(), 0);
}

// ============================================================================
// Event Name Constants
// ============================================================================

#[test]
fn event_names_match_frontend_constants() {
    // These must match the IPC_EVENTS in src/shared/config/constants.ts
    assert_eq!(EVENT_ROCKET_TELEMETRY, "rocket-telemetry");
    assert_eq!(EVENT_PAYLOAD_TELEMETRY, "payload-telemetry");
    assert_eq!(EVENT_CONNECTION_STATUS, "connection-status");
}

// ============================================================================
// Cancel Token Tests
// ============================================================================

#[test]
fn cancel_token_cross_thread() {
    let state = AppState::new();
    let token = state.cancel_token.clone();

    assert!(!token.load(std::sync::atomic::Ordering::Relaxed));
    state.cancel_token.store(true, std::sync::atomic::Ordering::Relaxed);
    assert!(token.load(std::sync::atomic::Ordering::Relaxed));
}
