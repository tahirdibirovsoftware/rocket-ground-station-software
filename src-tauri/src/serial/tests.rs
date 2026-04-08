//! Tests for the serial port reader module.
//!
//! Covers:
//! - FrameParser: single packets, interleaved, partial, corrupted, garbage
//! - Config: builder pattern, defaults
//! - Port enumeration: runs without panic
//! - Stats tracking

use crate::protocol::rocket_packet::{
    build_rocket_packet, FlightState, RocketPacket, ROCKET_PACKET_ID, ROCKET_PACKET_SIZE,
};
use crate::protocol::payload_packet::{
    build_payload_packet, PayloadPacket, PAYLOAD_PACKET_ID, PAYLOAD_PACKET_SIZE,
};

use super::config::*;
use super::reader::*;

/// Helper: build valid rocket bytes.
fn valid_rocket_bytes() -> Vec<u8> {
    let pkt = RocketPacket {
        packet_id: ROCKET_PACKET_ID,
        timestamp_ms: 5000,
        altitude: 1500.0,
        latitude: 38.3687,
        longitude: 34.0370,
        pressure1: 850.0,
        pressure2: 849.5,
        velocity: 200.0,
        flight_state: FlightState::Powered,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
    };
    build_rocket_packet(&pkt).to_vec()
}

/// Helper: build valid payload bytes.
fn valid_payload_bytes() -> Vec<u8> {
    let pkt = PayloadPacket {
        packet_id: PAYLOAD_PACKET_ID,
        timestamp_ms: 5000,
        latitude: 38.3700,
        longitude: 34.0380,
        altitude: 1470.0,
        scientific_data: 25.6,
    };
    build_payload_packet(&pkt).to_vec()
}

// ============================================================================
// FrameParser — Single Packet Tests
// ============================================================================

#[test]
fn parse_single_rocket_packet() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();
    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
    assert_eq!(parser.stats.rocket_packets, 1);
    assert_eq!(parser.stats.bytes_processed, ROCKET_PACKET_SIZE as u64);
}

#[test]
fn parse_single_payload_packet() {
    let mut parser = FrameParser::new();
    let bytes = valid_payload_bytes();
    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Payload(_)));
    assert_eq!(parser.stats.payload_packets, 1);
    assert_eq!(parser.stats.bytes_processed, PAYLOAD_PACKET_SIZE as u64);
}

// ============================================================================
// FrameParser — Multi-Packet Tests
// ============================================================================

#[test]
fn parse_two_consecutive_rocket_packets() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    bytes.extend_from_slice(&valid_rocket_bytes());

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 2);
    assert_eq!(parser.stats.rocket_packets, 2);
}

#[test]
fn parse_interleaved_rocket_and_payload() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    bytes.extend_from_slice(&valid_payload_bytes());
    bytes.extend_from_slice(&valid_rocket_bytes());

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 3);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
    assert!(matches!(packets[1], ParsedPacket::Payload(_)));
    assert!(matches!(packets[2], ParsedPacket::Rocket(_)));
    assert_eq!(parser.stats.rocket_packets, 2);
    assert_eq!(parser.stats.payload_packets, 1);
}

// ============================================================================
// FrameParser — Partial Read Tests
// ============================================================================

#[test]
fn parse_packet_split_across_two_feeds() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();

    // Feed first half
    let mid = ROCKET_PACKET_SIZE / 2;
    let packets1 = parser.feed(&bytes[..mid]);
    assert_eq!(packets1.len(), 0, "should not parse incomplete packet");

    // Feed second half
    let packets2 = parser.feed(&bytes[mid..]);
    assert_eq!(packets2.len(), 1, "should parse after receiving rest");
    assert!(matches!(packets2[0], ParsedPacket::Rocket(_)));
}

#[test]
fn parse_byte_by_byte() {
    let mut parser = FrameParser::new();
    let bytes = valid_payload_bytes();
    let mut all_packets = Vec::new();

    for &b in &bytes {
        let packets = parser.feed(&[b]);
        all_packets.extend(packets);
    }

    assert_eq!(all_packets.len(), 1);
    assert!(matches!(all_packets[0], ParsedPacket::Payload(_)));
}

// ============================================================================
// FrameParser — Garbage & Corruption Tests
// ============================================================================

#[test]
fn skip_garbage_before_valid_packet() {
    let mut parser = FrameParser::new();
    let mut bytes = vec![0x00, 0x55, 0xFF, 0x12, 0x34]; // 5 garbage bytes
    bytes.extend_from_slice(&valid_rocket_bytes());

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
}

#[test]
fn skip_garbage_between_packets() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    bytes.extend_from_slice(&[0x00, 0xFF, 0x55]); // garbage
    bytes.extend_from_slice(&valid_payload_bytes());

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 2);
}

#[test]
fn corrupted_checksum_is_rejected() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    // Corrupt a data byte (not the checksum itself)
    bytes[10] ^= 0xFF;

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 0);
    assert_eq!(parser.stats.checksum_failures, 1);
    assert_eq!(parser.stats.rocket_packets, 0);
}

#[test]
fn corrupted_packet_does_not_affect_next() {
    let mut parser = FrameParser::new();

    // Corrupted rocket packet
    let mut bad = valid_rocket_bytes();
    bad[15] ^= 0xFF;

    // Valid payload packet
    let good = valid_payload_bytes();

    let mut data = bad;
    data.extend_from_slice(&good);

    let packets = parser.feed(&data);
    assert_eq!(packets.len(), 1, "should parse the valid packet after the corrupt one");
    assert!(matches!(packets[0], ParsedPacket::Payload(_)));
    assert_eq!(parser.stats.checksum_failures, 1);
}

#[test]
fn empty_feed_returns_nothing() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(&[]);
    assert_eq!(packets.len(), 0);
    assert_eq!(parser.stats.bytes_processed, 0);
}

#[test]
fn all_garbage_returns_nothing() {
    let mut parser = FrameParser::new();
    let garbage = vec![0x00, 0x55, 0xFF, 0x12, 0x34, 0x99, 0x01, 0x02];
    let packets = parser.feed(&garbage);
    assert_eq!(packets.len(), 0);
}

// ============================================================================
// FrameParser — Reset Tests
// ============================================================================

#[test]
fn reset_clears_partial_state() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();

    // Feed partial
    parser.feed(&bytes[..10]);
    parser.reset();

    // Feed the full packet fresh
    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 1);
}

#[test]
fn reset_all_clears_stats() {
    let mut parser = FrameParser::new();
    parser.feed(&valid_rocket_bytes());
    assert_eq!(parser.stats.rocket_packets, 1);

    parser.reset_all();
    assert_eq!(parser.stats.rocket_packets, 0);
    assert_eq!(parser.stats.bytes_processed, 0);
}

// ============================================================================
// Config Tests
// ============================================================================

#[test]
fn config_defaults() {
    let config = SerialPortConfig::new("/dev/ttyUSB0");
    assert_eq!(config.path, "/dev/ttyUSB0");
    assert_eq!(config.baud_rate, DEFAULT_BAUD_RATE);
    assert_eq!(config.timeout_ms, DEFAULT_TIMEOUT_MS);
}

#[test]
fn config_builder() {
    let config = SerialPortConfig::new("/dev/ttyUSB1")
        .with_baud_rate(9600)
        .with_timeout_ms(500);
    assert_eq!(config.path, "/dev/ttyUSB1");
    assert_eq!(config.baud_rate, 9600);
    assert_eq!(config.timeout_ms, 500);
}

#[test]
fn config_serialization() {
    let config = SerialPortConfig::new("/dev/ttyUSB0");
    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("ttyUSB0"));
    assert!(json.contains("115200"));

    let parsed: SerialPortConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.path, config.path);
    assert_eq!(parsed.baud_rate, config.baud_rate);
}

// ============================================================================
// Port Enumeration Tests
// ============================================================================

#[test]
fn list_ports_does_not_panic() {
    // We can't assert specific ports in CI, but enumeration must not crash
    let ports = list_available_ports();
    // Just verify it returns a valid Vec (may be empty)
    let _ = ports.len();
}

// ============================================================================
// PortInfo Serialization
// ============================================================================

#[test]
fn port_info_serialization() {
    let info = PortInfo {
        path: "/dev/ttyUSB0".to_string(),
        manufacturer: Some("FTDI".to_string()),
        product: Some("FT232R".to_string()),
        serial_number: None,
    };
    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("ttyUSB0"));
    assert!(json.contains("FTDI"));
}

// ============================================================================
// Integration: Mock Generator → FrameParser round-trip
// ============================================================================

#[test]
fn mock_generated_packets_parse_through_frame_parser() {
    use crate::mock::generator::MockGenerator;

    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();

    // Simulate 10 seconds of flight (50 ticks at 5 Hz)
    let mut total_parsed = 0;
    for tick in 0..50 {
        for mock_pkt in gen.generate_tick(tick) {
            let bytes = match mock_pkt {
                crate::mock::generator::MockPacket::Rocket(b) => b,
                crate::mock::generator::MockPacket::Payload(b) => b,
            };
            let parsed = parser.feed(&bytes);
            total_parsed += parsed.len();
        }
    }

    // 10 rocket + 50 payload = 60 packets
    assert_eq!(total_parsed, 60);
    assert_eq!(parser.stats.rocket_packets, 10);
    assert_eq!(parser.stats.payload_packets, 50);
    assert_eq!(parser.stats.checksum_failures, 0);
}
