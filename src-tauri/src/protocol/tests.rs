//! Exhaustive test suite for the protocol module.
//!
//! Covers:
//! - Checksum computation and validation
//! - Rocket packet: round-trip, invalid checksum, wrong start byte, wrong packet ID,
//!   wrong length, all flight states, boundary values, parachute flags
//! - Payload packet: round-trip, invalid checksum, wrong start byte, wrong packet ID,
//!   wrong length, boundary values

use super::checksum::{compute_xor_checksum, stamp_checksum, validate_checksum};
use super::rocket_packet::*;
use super::payload_packet::*;

// ============================================================================
// Checksum Tests
// ============================================================================

#[test]
fn checksum_basic_computation() {
    // bytes[1..3] = [0x01, 0x02], XOR = 0x03
    let data = [0xAA, 0x01, 0x02, 0x00];
    assert_eq!(compute_xor_checksum(&data), 0x01 ^ 0x02);
}

#[test]
fn checksum_single_inner_byte() {
    // Only one byte between start and checksum
    let data = [0xBB, 0x42, 0x00];
    assert_eq!(compute_xor_checksum(&data), 0x42);
}

#[test]
fn checksum_all_zeros() {
    let data = [0x00, 0x00, 0x00, 0x00, 0x00];
    assert_eq!(compute_xor_checksum(&data), 0x00);
}

#[test]
fn checksum_all_ff() {
    // XOR of N copies of 0xFF: even count = 0x00, odd count = 0xFF
    let data = [0xFF; 5]; // inner bytes: 3 copies of 0xFF => 0xFF
    assert_eq!(compute_xor_checksum(&data), 0xFF);
}

#[test]
fn validate_checksum_correct() {
    let mut data = [0xAA, 0x01, 0x02, 0x03, 0x00];
    stamp_checksum(&mut data);
    assert!(validate_checksum(&data));
}

#[test]
fn validate_checksum_incorrect() {
    let data = [0xAA, 0x01, 0x02, 0x03, 0xFF]; // wrong checksum
    assert!(!validate_checksum(&data));
}

#[test]
fn stamp_checksum_overwrites_last_byte() {
    let mut data = [0xAA, 0x05, 0x0A, 0xFF];
    stamp_checksum(&mut data);
    assert_eq!(data[3], 0x05 ^ 0x0A); // 0x0F
    assert!(validate_checksum(&data));
}

#[test]
#[should_panic(expected = "Packet too short")]
fn checksum_panics_on_too_short() {
    let data = [0xAA, 0x01]; // only 2 bytes
    compute_xor_checksum(&data);
}

// ============================================================================
// Rocket Packet — Round-trip Tests
// ============================================================================

/// Helper: build a reference RocketPacket for testing.
fn sample_rocket_packet() -> RocketPacket {
    RocketPacket {
        packet_id: ROCKET_PACKET_ID,
        timestamp_ms: 12345,
        altitude: 1500.5,
        latitude: 39.9075,
        longitude: 32.8564,
        pressure1: 1013.25,
        pressure2: 1012.80,
        velocity: 245.3,
        flight_state: FlightState::Powered,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
    }
}

#[test]
fn rocket_round_trip() {
    let original = sample_rocket_packet();
    let bytes = build_rocket_packet(&original);

    assert_eq!(bytes.len(), ROCKET_PACKET_SIZE);
    assert_eq!(bytes[0], ROCKET_START_BYTE);
    assert!(validate_checksum(&bytes));

    let parsed = parse_rocket_packet(&bytes).expect("Should parse successfully");
    assert_eq!(parsed, original);
}

#[test]
fn rocket_round_trip_all_flight_states() {
    let states = [
        FlightState::Pad,
        FlightState::Powered,
        FlightState::Unpowered,
        FlightState::Apogee,
        FlightState::PrimaryChute,
        FlightState::SecondaryChute,
    ];

    for (i, &state) in states.iter().enumerate() {
        let mut pkt = sample_rocket_packet();
        pkt.flight_state = state;
        let bytes = build_rocket_packet(&pkt);
        let parsed = parse_rocket_packet(&bytes).expect("Should parse");

        assert_eq!(parsed.flight_state, state);
        // Verify the raw byte matches the enum value
        assert_eq!(bytes[30], i as u8);
    }
}

#[test]
fn rocket_parachute_flags() {
    // Both deployed
    let mut pkt = sample_rocket_packet();
    pkt.primary_parachute_deployed = true;
    pkt.secondary_parachute_deployed = true;
    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert!(parsed.primary_parachute_deployed);
    assert!(parsed.secondary_parachute_deployed);

    // Only primary
    pkt.primary_parachute_deployed = true;
    pkt.secondary_parachute_deployed = false;
    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert!(parsed.primary_parachute_deployed);
    assert!(!parsed.secondary_parachute_deployed);

    // Neither
    pkt.primary_parachute_deployed = false;
    pkt.secondary_parachute_deployed = false;
    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert!(!parsed.primary_parachute_deployed);
    assert!(!parsed.secondary_parachute_deployed);
}

#[test]
fn rocket_boundary_max_timestamp() {
    let mut pkt = sample_rocket_packet();
    pkt.timestamp_ms = u32::MAX;
    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert_eq!(parsed.timestamp_ms, u32::MAX);
}

#[test]
fn rocket_boundary_zero_timestamp() {
    let mut pkt = sample_rocket_packet();
    pkt.timestamp_ms = 0;
    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert_eq!(parsed.timestamp_ms, 0);
}

#[test]
fn rocket_boundary_extreme_floats() {
    let mut pkt = sample_rocket_packet();
    pkt.altitude = f32::MAX;
    pkt.velocity = f32::MIN;
    pkt.pressure1 = 0.0;
    pkt.pressure2 = -0.0;
    pkt.latitude = f32::MIN_POSITIVE; // smallest positive f32

    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert_eq!(parsed.altitude, f32::MAX);
    assert_eq!(parsed.velocity, f32::MIN);
    assert_eq!(parsed.pressure1, 0.0);
    assert_eq!(parsed.latitude, f32::MIN_POSITIVE);
}

#[test]
fn rocket_negative_coordinates() {
    let mut pkt = sample_rocket_packet();
    pkt.latitude = -33.8688;  // Sydney
    pkt.longitude = -151.2093;

    let bytes = build_rocket_packet(&pkt);
    let parsed = parse_rocket_packet(&bytes).unwrap();
    assert!((parsed.latitude - (-33.8688)).abs() < 1e-3);
    assert!((parsed.longitude - (-151.2093)).abs() < 1e-3);
}

// ============================================================================
// Rocket Packet — Error Tests
// ============================================================================

#[test]
fn rocket_invalid_length_too_short() {
    let data = [0xAA; 10];
    let err = parse_rocket_packet(&data).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidLength(10));
}

#[test]
fn rocket_invalid_length_too_long() {
    let data = [0xAA; 40];
    let err = parse_rocket_packet(&data).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidLength(40));
}

#[test]
fn rocket_invalid_length_empty() {
    let data: [u8; 0] = [];
    let err = parse_rocket_packet(&data).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidLength(0));
}

#[test]
fn rocket_wrong_start_byte() {
    let pkt = sample_rocket_packet();
    let mut bytes = build_rocket_packet(&pkt);
    bytes[0] = 0xBB; // payload start byte instead of rocket
    let err = parse_rocket_packet(&bytes).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidStartByte(0xBB));
}

#[test]
fn rocket_wrong_packet_id() {
    let pkt = sample_rocket_packet();
    let mut bytes = build_rocket_packet(&pkt);
    bytes[1] = 0x02; // payload packet ID
    // Must re-stamp checksum since bytes[1] changed
    stamp_checksum(&mut bytes);
    let err = parse_rocket_packet(&bytes).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidPacketId(0x02));
}

#[test]
fn rocket_invalid_checksum() {
    let pkt = sample_rocket_packet();
    let mut bytes = build_rocket_packet(&pkt);
    // Corrupt a data byte without updating checksum
    bytes[10] ^= 0xFF;
    let err = parse_rocket_packet(&bytes).unwrap_err();
    match err {
        RocketParseError::ChecksumMismatch { .. } => {} // expected
        other => panic!("Expected ChecksumMismatch, got: {other:?}"),
    }
}

#[test]
fn rocket_invalid_flight_state() {
    let pkt = sample_rocket_packet();
    let mut bytes = build_rocket_packet(&pkt);
    bytes[30] = 6; // invalid state (valid range 0-5)
    stamp_checksum(&mut bytes);
    let err = parse_rocket_packet(&bytes).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidFlightState(6));
}

#[test]
fn rocket_invalid_flight_state_max() {
    let pkt = sample_rocket_packet();
    let mut bytes = build_rocket_packet(&pkt);
    bytes[30] = 255;
    stamp_checksum(&mut bytes);
    let err = parse_rocket_packet(&bytes).unwrap_err();
    assert_eq!(err, RocketParseError::InvalidFlightState(255));
}

// ============================================================================
// Rocket Packet — Serialization Tests
// ============================================================================

#[test]
fn rocket_json_serialization() {
    let pkt = sample_rocket_packet();
    let json = serde_json::to_string(&pkt).expect("Should serialize");
    assert!(json.contains("\"altitude\""));
    assert!(json.contains("\"flight_state\":\"powered\""));
    assert!(json.contains("\"primary_parachute_deployed\":false"));

    let deserialized: RocketPacket =
        serde_json::from_str(&json).expect("Should deserialize");
    assert_eq!(deserialized, pkt);
}

#[test]
fn flight_state_json_values() {
    // Verify serde_json produces snake_case strings
    assert_eq!(serde_json::to_string(&FlightState::Pad).unwrap(), "\"pad\"");
    assert_eq!(serde_json::to_string(&FlightState::Powered).unwrap(), "\"powered\"");
    assert_eq!(serde_json::to_string(&FlightState::Unpowered).unwrap(), "\"unpowered\"");
    assert_eq!(serde_json::to_string(&FlightState::Apogee).unwrap(), "\"apogee\"");
    assert_eq!(
        serde_json::to_string(&FlightState::PrimaryChute).unwrap(),
        "\"primary_chute\""
    );
    assert_eq!(
        serde_json::to_string(&FlightState::SecondaryChute).unwrap(),
        "\"secondary_chute\""
    );
}

// ============================================================================
// Payload Packet — Round-trip Tests
// ============================================================================

/// Helper: build a reference PayloadPacket for testing.
fn sample_payload_packet() -> PayloadPacket {
    PayloadPacket {
        packet_id: PAYLOAD_PACKET_ID,
        timestamp_ms: 67890,
        latitude: 39.9100,
        longitude: 32.8600,
        altitude: 850.25,
        scientific_data: 23.456,
    }
}

#[test]
fn payload_round_trip() {
    let original = sample_payload_packet();
    let bytes = build_payload_packet(&original);

    assert_eq!(bytes.len(), PAYLOAD_PACKET_SIZE);
    assert_eq!(bytes[0], PAYLOAD_START_BYTE);
    assert!(validate_checksum(&bytes));

    let parsed = parse_payload_packet(&bytes).expect("Should parse successfully");
    assert_eq!(parsed, original);
}

#[test]
fn payload_boundary_max_timestamp() {
    let mut pkt = sample_payload_packet();
    pkt.timestamp_ms = u32::MAX;
    let bytes = build_payload_packet(&pkt);
    let parsed = parse_payload_packet(&bytes).unwrap();
    assert_eq!(parsed.timestamp_ms, u32::MAX);
}

#[test]
fn payload_boundary_zero_values() {
    let pkt = PayloadPacket {
        packet_id: PAYLOAD_PACKET_ID,
        timestamp_ms: 0,
        latitude: 0.0,
        longitude: 0.0,
        altitude: 0.0,
        scientific_data: 0.0,
    };
    let bytes = build_payload_packet(&pkt);
    let parsed = parse_payload_packet(&bytes).unwrap();
    assert_eq!(parsed.timestamp_ms, 0);
    assert_eq!(parsed.altitude, 0.0);
}

#[test]
fn payload_negative_scientific_data() {
    let mut pkt = sample_payload_packet();
    pkt.scientific_data = -99.99;
    let bytes = build_payload_packet(&pkt);
    let parsed = parse_payload_packet(&bytes).unwrap();
    assert!((parsed.scientific_data - (-99.99)).abs() < 1e-2);
}

#[test]
fn payload_extreme_floats() {
    let mut pkt = sample_payload_packet();
    pkt.altitude = f32::MAX;
    pkt.scientific_data = f32::MIN;
    let bytes = build_payload_packet(&pkt);
    let parsed = parse_payload_packet(&bytes).unwrap();
    assert_eq!(parsed.altitude, f32::MAX);
    assert_eq!(parsed.scientific_data, f32::MIN);
}

// ============================================================================
// Payload Packet — Error Tests
// ============================================================================

#[test]
fn payload_invalid_length_too_short() {
    let data = [0xBB; 10];
    let err = parse_payload_packet(&data).unwrap_err();
    assert_eq!(err, PayloadParseError::InvalidLength(10));
}

#[test]
fn payload_invalid_length_too_long() {
    let data = [0xBB; 30];
    let err = parse_payload_packet(&data).unwrap_err();
    assert_eq!(err, PayloadParseError::InvalidLength(30));
}

#[test]
fn payload_invalid_length_empty() {
    let data: [u8; 0] = [];
    let err = parse_payload_packet(&data).unwrap_err();
    assert_eq!(err, PayloadParseError::InvalidLength(0));
}

#[test]
fn payload_wrong_start_byte() {
    let pkt = sample_payload_packet();
    let mut bytes = build_payload_packet(&pkt);
    bytes[0] = 0xAA; // rocket start byte instead of payload
    let err = parse_payload_packet(&bytes).unwrap_err();
    assert_eq!(err, PayloadParseError::InvalidStartByte(0xAA));
}

#[test]
fn payload_wrong_packet_id() {
    let pkt = sample_payload_packet();
    let mut bytes = build_payload_packet(&pkt);
    bytes[1] = 0x01; // rocket packet ID
    stamp_checksum(&mut bytes);
    let err = parse_payload_packet(&bytes).unwrap_err();
    assert_eq!(err, PayloadParseError::InvalidPacketId(0x01));
}

#[test]
fn payload_invalid_checksum() {
    let pkt = sample_payload_packet();
    let mut bytes = build_payload_packet(&pkt);
    bytes[10] ^= 0xFF; // corrupt without re-stamping
    let err = parse_payload_packet(&bytes).unwrap_err();
    match err {
        PayloadParseError::ChecksumMismatch { .. } => {}
        other => panic!("Expected ChecksumMismatch, got: {other:?}"),
    }
}

// ============================================================================
// Payload Packet — Serialization Tests
// ============================================================================

#[test]
fn payload_json_serialization() {
    let pkt = sample_payload_packet();
    let json = serde_json::to_string(&pkt).expect("Should serialize");
    assert!(json.contains("\"altitude\""));
    assert!(json.contains("\"scientific_data\""));

    let deserialized: PayloadPacket =
        serde_json::from_str(&json).expect("Should deserialize");
    assert_eq!(deserialized, pkt);
}

// ============================================================================
// Cross-protocol Tests
// ============================================================================

#[test]
fn rocket_and_payload_start_bytes_are_distinct() {
    assert_ne!(ROCKET_START_BYTE, PAYLOAD_START_BYTE);
}

#[test]
fn rocket_and_payload_packet_ids_are_distinct() {
    assert_ne!(ROCKET_PACKET_ID, PAYLOAD_PACKET_ID);
}

#[test]
fn rocket_bytes_rejected_by_payload_parser() {
    let pkt = sample_rocket_packet();
    let bytes = build_rocket_packet(&pkt);
    // Rocket packet is 36 bytes, payload expects 24
    assert!(parse_payload_packet(&bytes).is_err());
}

#[test]
fn payload_bytes_rejected_by_rocket_parser() {
    let pkt = sample_payload_packet();
    let bytes = build_payload_packet(&pkt);
    // Payload packet is 24 bytes, rocket expects 36
    assert!(parse_rocket_packet(&bytes).is_err());
}

// ============================================================================
// FlightState Edge Cases
// ============================================================================

#[test]
fn flight_state_from_u8_all_valid() {
    assert_eq!(FlightState::from_u8(0), Some(FlightState::Pad));
    assert_eq!(FlightState::from_u8(1), Some(FlightState::Powered));
    assert_eq!(FlightState::from_u8(2), Some(FlightState::Unpowered));
    assert_eq!(FlightState::from_u8(3), Some(FlightState::Apogee));
    assert_eq!(FlightState::from_u8(4), Some(FlightState::PrimaryChute));
    assert_eq!(FlightState::from_u8(5), Some(FlightState::SecondaryChute));
}

#[test]
fn flight_state_from_u8_invalid_values() {
    assert_eq!(FlightState::from_u8(6), None);
    assert_eq!(FlightState::from_u8(100), None);
    assert_eq!(FlightState::from_u8(255), None);
}

// ============================================================================
// Error Display Tests
// ============================================================================

#[test]
fn rocket_error_display_messages() {
    let err = RocketParseError::InvalidLength(10);
    assert!(err.to_string().contains("36"));
    assert!(err.to_string().contains("10"));

    let err = RocketParseError::InvalidStartByte(0xBB);
    assert!(err.to_string().contains("0xAA"));
    assert!(err.to_string().contains("0xBB"));

    let err = RocketParseError::ChecksumMismatch {
        expected: 0x42,
        actual: 0xFF,
    };
    assert!(err.to_string().contains("0x42"));
    assert!(err.to_string().contains("0xFF"));
}

#[test]
fn payload_error_display_messages() {
    let err = PayloadParseError::InvalidLength(5);
    assert!(err.to_string().contains("24"));
    assert!(err.to_string().contains("5"));

    let err = PayloadParseError::InvalidStartByte(0xAA);
    assert!(err.to_string().contains("0xBB"));
    assert!(err.to_string().contains("0xAA"));
}
