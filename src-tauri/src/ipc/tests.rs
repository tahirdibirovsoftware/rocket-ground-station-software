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
    assert!(status.rfd_port.is_none());
    assert_eq!(status.rocket_packets_received, 0);
    assert_eq!(status.payload_packets_received, 0);
    assert_eq!(status.drone_packets_received, 0);
    assert_eq!(status.checksum_failures, 0);
    assert_eq!(status.uptime_ms, 0);
}

#[test]
fn connection_status_serialization() {
    let status = ConnectionStatus {
        mode: ConnectionMode::Serial,
        rfd_port: Some("/dev/ttyUSB0".to_string()),
        rocket_packets_received: 42,
        payload_packets_received: 210,
        drone_packets_received: 10,
        checksum_failures: 3,
        uptime_ms: 60000,
    };

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"serial\""));
    assert!(json.contains("ttyUSB0"));
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
    assert!(json.contains("\"rfd_port\":null"));
}

// ============================================================================
// AppState Tests
// ============================================================================

#[test]
fn app_state_initial_values() {
    let state = AppState::new();
    assert!(!state.mock_state.is_running());
    assert!(!state.rfd_cancel.load(std::sync::atomic::Ordering::Relaxed));
    assert!(!state.mock_cancel.load(std::sync::atomic::Ordering::Relaxed));

    let status = state.connection_status.lock().unwrap();
    assert_eq!(status.mode, ConnectionMode::Disconnected);
}

#[test]
fn app_state_sync_stats() {
    let state = AppState::new();

    // Feed some packets through the parser
    {
        let rocket_bytes = b"AA,1000,0.12,-0.05,25.0,0.01,-0.02,0.005,12.5,-8.2,42.1,24.5,950.0,45.0,500.0,24.2,46.5,38.0,34.0,500.0,100.0,180.0,12.0,5.0,90.0\n";
        let payload_bytes = b"BB,1000,-0.05,0.08,9.8,-0.01,0.01,0.02,10.4,-9.5,40.0,25.0,950.0,50.0,490.0,23.5,51.0,38.0,34.0,490.0,0.0,0.0,0.0,0.0,0.0\n";

        let mut parser = state.frame_parser.lock().unwrap();
        parser.feed(rocket_bytes);
        parser.feed(payload_bytes);
        parser.feed(payload_bytes);
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
    let token = state.rfd_cancel.clone();

    assert!(!token.load(std::sync::atomic::Ordering::Relaxed));
    state.rfd_cancel.store(true, std::sync::atomic::Ordering::Relaxed);
    assert!(token.load(std::sync::atomic::Ordering::Relaxed));
}
