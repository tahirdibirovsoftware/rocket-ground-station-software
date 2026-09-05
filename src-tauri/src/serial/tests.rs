//! Tests for the serial port reader module.

use super::config::*;
use super::reader::*;

/// Helper: build valid rocket bytes.
fn valid_rocket_bytes() -> Vec<u8> {
    "AA,5000,0.12,-0.05,9.8,0.01,-0.02,0.005,12.5,-8.2,42.1,24.5,1013.2,45.0,1500.0,24.2,46.5,38.3687,34.0370,1500.0,200.0,180.0,12.0,5.0,90.0\n"
        .as_bytes()
        .to_vec()
}

/// Helper: build valid payload bytes.
fn valid_payload_bytes() -> Vec<u8> {
    "BB,5000,-0.05,0.08,9.8,-0.01,0.01,0.02,10.4,-9.5,40.0,25.6,1013.2,50.0,1470.0,23.5,51.0,38.3700,34.0380,1470.0,0.0,0.0,0.0,0.0,0.0\n"
        .as_bytes()
        .to_vec()
}

#[test]
fn parse_single_rocket_packet() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();
    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
    assert_eq!(parser.stats.rocket_packets, 1);
}

#[test]
fn parse_single_payload_packet() {
    let mut parser = FrameParser::new();
    let bytes = valid_payload_bytes();
    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Payload(_)));
    assert_eq!(parser.stats.payload_packets, 1);
}

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

#[test]
fn parse_packet_split_across_two_feeds() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();

    let mid = bytes.len() / 2;
    let packets1 = parser.feed(&bytes[..mid]);
    assert_eq!(packets1.len(), 0, "should not parse incomplete packet");

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

#[test]
fn skip_garbage_before_valid_packet() {
    let mut parser = FrameParser::new();
    let mut bytes = vec![0x00, 0x55, 0xFF, 0x12, 0x34];
    bytes.extend_from_slice(&valid_rocket_bytes());

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
}

#[test]
fn empty_feed_returns_nothing() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(&[]);
    assert_eq!(packets.len(), 0);
    assert_eq!(parser.stats.bytes_processed, 0);
}

#[test]
fn reset_clears_partial_state() {
    let mut parser = FrameParser::new();
    let bytes = valid_rocket_bytes();

    parser.feed(&bytes[..10]);
    parser.reset();

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
fn mock_generated_packets_parse_through_frame_parser() {
    use crate::mock::generator::MockGenerator;

    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();

    let mut total_parsed = 0;
    for tick in 0..50 {
        for mock_pkt in gen.generate_tick(tick) {
            let bytes = match mock_pkt {
                crate::mock::generator::MockPacket::Rocket(b) => b,
                crate::mock::generator::MockPacket::Payload(b) => b,
                crate::mock::generator::MockPacket::Drone(b) => b,
            };
            let parsed = parser.feed(&bytes);
            total_parsed += parsed.len();
        }
    }

    // 10 rocket + 50 payload + 50 drone = 110 packets
    assert_eq!(total_parsed, 110);
    assert_eq!(parser.stats.rocket_packets, 10);
    assert_eq!(parser.stats.payload_packets, 50);
    assert_eq!(parser.stats.drone_packets, 50);
}

/// Real Teensy drone (CC) line with the 7 flight-control extension fields.
fn valid_drone_bytes() -> Vec<u8> {
    "CC,66000,0.01,0.01,9.8,0.002,0.003,0.001,11.2,-8.9,41.5,25.1,960.0,42.0,48.5,24.8,43.5,38.3695,34.0362,48.5,3.5,90.0,1.2,-0.8,180.0,48.52,-3.02,1.03,0.36,1,2,2000\n"
        .as_bytes()
        .to_vec()
}

#[test]
fn parse_drone_packet_with_flight_control_fields() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(&valid_drone_bytes());

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Drone(pkt) => {
            assert_eq!(pkt.header, "CC");
            assert!((pkt.rel_alt - 48.52).abs() < 0.001);
            assert!((pkt.vertical_velocity - -3.02).abs() < 0.001);
            assert!((pkt.g_force - 1.03).abs() < 0.001);
            assert!((pkt.dpdt - 0.36).abs() < 0.001);
            assert!(pkt.armed);
            assert_eq!(pkt.state_code, 2);
            assert_eq!(pkt.throttle_us, 2000);
        }
        other => panic!("expected drone packet, got {other:?}"),
    }
    assert_eq!(parser.stats.drone_packets, 1);
}

#[test]
fn parse_drone_packet_with_sensor_off_placeholders() {
    // IMU/GPS off → "N" placeholders; flight-control fields still present
    let line = "CC,67000,N,N,N,N,N,N,N,N,N,25.1,960.0,42.0,48.5,24.8,43.5,N,N,N,N,N,0.0,0.0,0.0,48.50,0.00,1.00,0.00,0,0,1000\n";
    let mut parser = FrameParser::new();
    let packets = parser.feed(line.as_bytes());

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Drone(pkt) => {
            assert_eq!(pkt.accel_x, 0.0);
            assert_eq!(pkt.latitude, 0.0);
            assert!(!pkt.armed);
            assert_eq!(pkt.state_code, 0);
            assert_eq!(pkt.throttle_us, 1000);
        }
        other => panic!("expected drone packet, got {other:?}"),
    }
}

#[test]
fn parse_uplink_arm_ack_line() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(b"1\n");

    assert!(packets.is_empty());
    assert_eq!(parser.stats.uplink_acks, 1);
    assert_eq!(parser.stats.last_uplink_ack, Some(true));
}

#[test]
fn parse_uplink_disarm_ack_line() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(b"0\n");

    assert!(packets.is_empty());
    assert_eq!(parser.stats.uplink_acks, 1);
    assert_eq!(parser.stats.last_uplink_ack, Some(false));
}

#[test]
fn uplink_acks_interleaved_with_telemetry() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    bytes.extend_from_slice(b"1\n");
    bytes.extend_from_slice(&valid_drone_bytes());

    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 2);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
    assert!(matches!(packets[1], ParsedPacket::Drone(_)));
    assert_eq!(parser.stats.uplink_acks, 1);
    assert_eq!(parser.stats.last_uplink_ack, Some(true));
}

#[test]
fn non_ack_short_lines_not_counted() {
    let mut parser = FrameParser::new();
    let packets = parser.feed(b"2\nAB\n!\n");

    assert!(packets.is_empty());
    assert_eq!(parser.stats.uplink_acks, 0);
    assert_eq!(parser.stats.last_uplink_ack, None);
}
