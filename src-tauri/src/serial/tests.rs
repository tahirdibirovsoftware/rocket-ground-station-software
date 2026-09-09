//! Tests for the serial port reader module.

use super::config::*;
use super::reader::*;
use crate::protocol::rocket_packet::FlightState;

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

// ============================================================================
// Binary RF Protocol Tests
// ============================================================================

fn build_binary_telemetry_frame(device: u8, flags: u16, phase: u8, ground: u8) -> Vec<u8> {
    use crate::protocol::binary_packet::{crc16_ccitt, PKT_TELEMETRY, SYNC1, SYNC2};

    let mut frame = vec![
        SYNC1,
        SYNC2,
        0x01,
        device,
        PKT_TELEMETRY,
        0x34, 0x12,
        0x78, 0x56, 0x34, 0x12,
        71,
    ];

    let mut p: Vec<u8> = Vec::with_capacity(71);
    p.extend_from_slice(&flags.to_le_bytes());
    for v in [123i16, -456, 981, 500, -250, 125, 123, -456, 789] {
        p.extend_from_slice(&v.to_le_bytes());
    }
    p.extend_from_slice(&2345i16.to_le_bytes());
    p.extend_from_slice(&10132u16.to_le_bytes());
    p.extend_from_slice(&4550u16.to_le_bytes());
    p.extend_from_slice(&123456i32.to_le_bytes());
    p.extend_from_slice(&2234i16.to_le_bytes());
    p.extend_from_slice(&5120u16.to_le_bytes());
    let lat_e7 = (38.3687 * 10_000_000.0) as i32;
    let lon_e7 = (34.0370 * 10_000_000.0) as i32;
    p.extend_from_slice(&lat_e7.to_le_bytes());
    p.extend_from_slice(&lon_e7.to_le_bytes());
    p.extend_from_slice(&150025i32.to_le_bytes());
    p.extend_from_slice(&1250u16.to_le_bytes());
    p.extend_from_slice(&18000u16.to_le_bytes());
    p.push(8);
    for v in [550i16, -320, 9000] {
        p.extend_from_slice(&v.to_le_bytes());
    }
    p.extend_from_slice(&45678i32.to_le_bytes());
    p.extend_from_slice(&(-1234i16).to_le_bytes());
    p.extend_from_slice(&1234u16.to_le_bytes());
    p.extend_from_slice(&(-567i16).to_le_bytes());
    p.extend_from_slice(&1050u16.to_le_bytes());
    p.push(phase);
    p.push(ground);

    frame.extend_from_slice(&p);
    let crc = crc16_ccitt(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());
    frame
}

fn build_binary_status_frame(ground: u8, phase: u8) -> Vec<u8> {
    use crate::protocol::binary_packet::{crc16_ccitt, PKT_STATUS, SYNC1, SYNC2};

    let mut frame = vec![
        SYNC1,
        SYNC2,
        0x01,
        0xBB,
        PKT_STATUS,
        0x05, 0x00,
        0x78, 0x56, 0x34, 0x12,
        2,
        ground,
        phase,
    ];
    let crc = crc16_ccitt(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());
    frame
}

/// Build a drone-shaped telemetry frame (72-byte payload).
fn build_binary_drone_frame(flags: u16, state_code: u8, throttle_us: u16) -> Vec<u8> {
    use crate::protocol::binary_packet::{crc16_ccitt, PKT_TELEMETRY, SYNC1, SYNC2};

    let mut frame = vec![
        SYNC1,
        SYNC2,
        0x01,
        0xCC,
        PKT_TELEMETRY,
        0x78, 0x56,
        0x78, 0x56, 0x34, 0x12,
        72,
    ];

    let mut p: Vec<u8> = Vec::with_capacity(72);
    p.extend_from_slice(&flags.to_le_bytes());
    for v in [123i16, -456, 981, 500, -250, 125, 123, -456, 789] {
        p.extend_from_slice(&v.to_le_bytes());
    }
    p.extend_from_slice(&2345i16.to_le_bytes());
    p.extend_from_slice(&10132u16.to_le_bytes());
    p.extend_from_slice(&4550u16.to_le_bytes());
    p.extend_from_slice(&123456i32.to_le_bytes());
    p.extend_from_slice(&2234i16.to_le_bytes());
    p.extend_from_slice(&5120u16.to_le_bytes());
    let lat_e7 = (38.3687 * 10_000_000.0) as i32;
    let lon_e7 = (34.0370 * 10_000_000.0) as i32;
    p.extend_from_slice(&lat_e7.to_le_bytes());
    p.extend_from_slice(&lon_e7.to_le_bytes());
    p.extend_from_slice(&150025i32.to_le_bytes());
    p.extend_from_slice(&1250u16.to_le_bytes());
    p.extend_from_slice(&18000u16.to_le_bytes());
    p.push(8);
    for v in [550i16, -320, 9000] {
        p.extend_from_slice(&v.to_le_bytes());
    }
    p.extend_from_slice(&45678i32.to_le_bytes());
    p.extend_from_slice(&(-1234i16).to_le_bytes());
    p.extend_from_slice(&1234u16.to_le_bytes());
    p.extend_from_slice(&(-567i16).to_le_bytes());
    p.extend_from_slice(&25i16.to_le_bytes());
    p.push(state_code);
    p.extend_from_slice(&throttle_us.to_le_bytes());

    frame.extend_from_slice(&p);
    let crc = crc16_ccitt(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());
    frame
}

/// Build a drone status frame: [state_code, throttle u16, armed].
fn build_binary_drone_status_frame(state_code: u8, throttle_us: u16, armed: u8) -> Vec<u8> {
    use crate::protocol::binary_packet::{crc16_ccitt, PKT_STATUS, SYNC1, SYNC2};

    let mut frame = vec![
        SYNC1,
        SYNC2,
        0x01,
        0xCC,
        PKT_STATUS,
        0x06, 0x00,
        0x78, 0x56, 0x34, 0x12,
        4,
        state_code,
    ];
    frame.extend_from_slice(&throttle_us.to_le_bytes());
    frame.push(armed);
    let crc = crc16_ccitt(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());
    frame
}

#[test]
fn parse_binary_payload_telemetry_frame() {
    let mut parser = FrameParser::new();
    let frame = build_binary_telemetry_frame(0xBB, 0xFFFF, 1, 0);
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Payload(pkt) => {
            assert_eq!(pkt.header, "BB");
            assert_eq!(pkt.timestamp_ms, 0x12345678);
            assert!((pkt.altitude - 1234.56).abs() < 0.01);
            assert!((pkt.latitude - 38.3687).abs() < 1e-4);
            assert!((pkt.rel_alt - 456.78).abs() < 0.01);
            assert_eq!(pkt.flight_phase, 1);
            assert!(!pkt.on_ground);
        }
        other => panic!("expected payload packet, got {other:?}"),
    }
    assert_eq!(parser.stats.payload_packets, 1);
}

#[test]
fn parse_binary_drone_telemetry_frame() {
    let mut parser = FrameParser::new();
    let frame = build_binary_drone_frame(0xFFFF, 2, 1480);
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Drone(pkt) => {
            assert_eq!(pkt.header, "CC");
            assert_eq!(pkt.state_code, 2);
            assert_eq!(pkt.throttle_us, 1480);
        }
        other => panic!("expected drone packet, got {other:?}"),
    }
    assert_eq!(parser.stats.drone_packets, 1);
}

#[test]
fn parse_binary_drone_status_frame() {
    let mut parser = FrameParser::new();
    let frame = build_binary_drone_status_frame(3, 1234, 1);
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::DroneStatus {
            state_code,
            throttle_us,
            armed,
        } => {
            assert_eq!(*state_code, 3);
            assert_eq!(*throttle_us, 1234);
            assert!(*armed);
        }
        other => panic!("expected drone status, got {other:?}"),
    }
}

#[test]
fn parse_binary_firmware_drone_status_2_bytes() {
    use crate::protocol::binary_packet::{crc16_ccitt, PKT_STATUS, SYNC1, SYNC2};

    let mut parser = FrameParser::new();
    let mut frame = vec![
        SYNC1,
        SYNC2,
        0x01,
        0xCC,
        PKT_STATUS,
        0x07, 0x00,
        0x78, 0x56, 0x34, 0x12,
        2,
        1, // armed = 1
        2, // flight state 2 (FS_DESCENDING - active descent)
    ];
    let crc = crc16_ccitt(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());

    let packets = parser.feed(&frame);
    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::DroneStatus {
            state_code,
            throttle_us,
            armed,
        } => {
            assert_eq!(*state_code, 2);
            assert_eq!(*throttle_us, 1650);
            assert!(*armed);
        }
        other => panic!("expected drone status, got {other:?}"),
    }
}

#[test]
fn parse_binary_firmware_drone_telemetry_71_bytes() {
    let mut parser = FrameParser::new();
    let frame = build_binary_telemetry_frame(0xCC, 0xFFFF, 1, 1);
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Drone(pkt) => {
            assert_eq!(pkt.header, "CC");
            assert_eq!(pkt.flight_phase, 1);
            assert!(pkt.outputs_active);
            assert_eq!(pkt.throttle_us, 1480);
            assert!((pkt.fast_g - 1.05).abs() < 0.01);
            assert!(!pkt.on_ground);
        }
        other => panic!("expected drone packet, got {other:?}"),
    }
    assert_eq!(parser.stats.drone_packets, 1);
}

#[test]
fn parse_binary_status_frame() {
    let mut parser = FrameParser::new();
    let frame = build_binary_status_frame(1, 2);
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::PayloadStatus {
            on_ground,
            flight_phase,
            outputs_active,
        } => {
            assert!(*on_ground);
            assert_eq!(*flight_phase, 2);
            assert!(*outputs_active);
        }
        other => panic!("expected payload status, got {other:?}"),
    }
}

#[test]
fn binary_frame_split_across_feeds() {
    let mut parser = FrameParser::new();
    let frame = build_binary_telemetry_frame(0xBB, 0xFFFF, 1, 0);

    // Feed byte-by-byte
    let mut all = Vec::new();
    for &b in &frame {
        all.extend(parser.feed(&[b]));
    }

    assert_eq!(all.len(), 1);
    assert!(matches!(all[0], ParsedPacket::Payload(_)));
}

#[test]
fn binary_frame_corrupt_crc_counts_failure() {
    let mut parser = FrameParser::new();
    let mut frame = build_binary_telemetry_frame(0xBB, 0xFFFF, 1, 0);
    let last = frame.len() - 1;
    frame[last] ^= 0xFF;

    let packets = parser.feed(&frame);
    assert!(packets.is_empty());
    assert_eq!(parser.stats.checksum_failures, 1);
    assert_eq!(parser.stats.payload_packets, 0);
}

#[test]
fn binary_and_csv_streams_interleaved() {
    let mut parser = FrameParser::new();
    let mut bytes = valid_rocket_bytes();
    bytes.extend_from_slice(&build_binary_telemetry_frame(0xBB, 0xFFFF, 1, 0));
    bytes.extend_from_slice(b"1\n");
    bytes.extend_from_slice(&build_binary_status_frame(0, 0));

    let packets = parser.feed(&bytes);

    assert_eq!(packets.len(), 3);
    assert!(matches!(packets[0], ParsedPacket::Rocket(_)));
    assert!(matches!(packets[1], ParsedPacket::Payload(_)));
    assert!(matches!(packets[2], ParsedPacket::PayloadStatus { .. }));
    assert_eq!(parser.stats.rocket_packets, 1);
    assert_eq!(parser.stats.payload_packets, 1);
    assert_eq!(parser.stats.uplink_acks, 1);
}

#[test]
fn binary_sync_garbage_resyncs() {
    let mut parser = FrameParser::new();
    // Stray 0xAA followed by non-0x55, then a valid frame
    let mut bytes = vec![0xAA, 0x01, 0x02, b'\n'];
    bytes.extend_from_slice(&build_binary_telemetry_frame(0xBB, 0xFFFF, 1, 0));

    let packets = parser.feed(&bytes);
    assert_eq!(packets.len(), 1);
    assert!(matches!(packets[0], ParsedPacket::Payload(_)));
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

#[test]
fn parse_payload_packet_with_flight_phase_extension() {
    // BB payload with 32 fields: shared rel_alt/vel/g/dpdt + on_ground/flight_phase
    let line = "BB,15000,-0.05,0.08,9.8,-0.01,0.01,0.02,10.4,-9.5,40.0,25.0,960.0,50.0,1200.0,23.5,51.0,38.3700,34.0380,1200.0,12.5,180.0,2.0,3.0,4.0,1198.50,-14.80,1.02,-1.77,0,1,0\n";
    let mut parser = FrameParser::new();
    let packets = parser.feed(line.as_bytes());

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Payload(pkt) => {
            assert_eq!(pkt.header, "BB");
            assert!((pkt.rel_alt - 1198.50).abs() < 0.01);
            assert!((pkt.vertical_velocity - -14.80).abs() < 0.01);
            assert!((pkt.g_force - 1.02).abs() < 0.01);
            assert!((pkt.dpdt - -1.77).abs() < 0.01);
            assert!(!pkt.on_ground, "payload should be in sky");
            assert_eq!(pkt.flight_phase, 1, "phase should be IN_AIR");
            assert!(!pkt.armed);
        }
        other => panic!("expected payload packet, got {other:?}"),
    }
    assert_eq!(parser.stats.payload_packets, 1);
}

#[test]
fn parse_payload_packet_landed_on_ground() {
    // BB payload landed: on_ground=1, flight_phase=2 (ON_GROUND)
    let line = "BB,15000,-0.05,0.08,9.8,-0.01,0.01,0.02,10.4,-9.5,40.0,25.0,960.0,50.0,2.0,23.5,51.0,38.3700,34.0380,2.0,0.0,0.0,2.0,3.0,4.0,0.05,0.00,1.00,0.01,1,2,0\n";
    let mut parser = FrameParser::new();
    let packets = parser.feed(line.as_bytes());

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Payload(pkt) => {
            assert!(pkt.on_ground, "payload should be on ground");
            assert_eq!(pkt.flight_phase, 2, "phase should be ON_GROUND");
        }
        other => panic!("expected payload packet, got {other:?}"),
    }
}

#[test]
fn parse_payload_packet_with_sensor_off_placeholders() {
    // IMU/GPS off → "N" placeholders; payload status extension still present
    let line = "BB,15000,N,N,N,N,N,N,N,N,N,25.0,960.0,50.0,2.0,23.5,51.0,N,N,N,N,N,0.0,0.0,0.0,0.05,0.00,1.00,0.01,1,2,0\n";
    let mut parser = FrameParser::new();
    let packets = parser.feed(line.as_bytes());

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Payload(pkt) => {
            assert_eq!(pkt.accel_x, 0.0);
            assert_eq!(pkt.latitude, 0.0);
            assert!(pkt.on_ground);
            assert_eq!(pkt.flight_phase, 2);
        }
        other => panic!("expected payload packet, got {other:?}"),
    }
}

#[test]
fn parse_binary_rocket_telemetry_frame() {
    use crate::protocol::binary_packet::{
        crc16_ccitt, ROCKET_FRAME_SIZE, ROCKET_HDR0, ROCKET_HDR1, ROCKET_PAYLOAD_LEN,
        ROCKET_TYPE_TELEM,
    };

    let mut frame = Vec::with_capacity(ROCKET_FRAME_SIZE);
    frame.push(ROCKET_HDR0);
    frame.push(ROCKET_HDR1);
    frame.push(ROCKET_TYPE_TELEM);
    frame.push(ROCKET_PAYLOAD_LEN as u8);

    // ms: 154000
    frame.extend_from_slice(&154000u32.to_le_bytes());
    // qw, qx, qy, qz
    frame.extend_from_slice(&((0.95 * 32767.0) as i16).to_le_bytes());
    frame.extend_from_slice(&0i16.to_le_bytes());
    frame.extend_from_slice(&0i16.to_le_bytes());
    frame.extend_from_slice(&0i16.to_le_bytes());
    // accel_x, y, z (x100)
    frame.extend_from_slice(&(250i16).to_le_bytes());
    frame.extend_from_slice(&(10i16).to_le_bytes());
    frame.extend_from_slice(&(980i16).to_le_bytes());
    // angles: roll 15.0 deg, pitch -2.0 deg, yaw 90.0 deg (x10)
    frame.extend_from_slice(&(150i16).to_le_bytes());
    frame.extend_from_slice(&(-20i16).to_le_bytes());
    frame.extend_from_slice(&(900i16).to_le_bytes());
    // bme: temp 28.5 C, pres 965.0 hPa, hum 42.0 % (x10)
    frame.extend_from_slice(&(285i16).to_le_bytes());
    frame.extend_from_slice(&(9650i16).to_le_bytes());
    frame.extend_from_slice(&(420i16).to_le_bytes());
    // altitude: 512.34 m (x100)
    frame.extend_from_slice(&(51234i32).to_le_bytes());
    // aht: 28.0 C, 43.0 % (x10)
    frame.extend_from_slice(&(280i16).to_le_bytes());
    frame.extend_from_slice(&(430i16).to_le_bytes());
    // gps: lat 38.3687, lon 34.0370 (x1e7)
    frame.extend_from_slice(&((38.3687 * 1e7) as i32).to_le_bytes());
    frame.extend_from_slice(&((34.0370 * 1e7) as i32).to_le_bytes());
    // gps_alt: 1200 m
    frame.extend_from_slice(&(1200i16).to_le_bytes());
    // total_g: 1.15 g (x100)
    frame.extend_from_slice(&(115i16).to_le_bytes());
    // vertical_speed: 12.5 m/s (x100)
    frame.extend_from_slice(&(1250i16).to_le_bytes());
    // state: 1 (FS_LAUNCHED -> Powered), flags: 0x0F, bno_calib: 3
    frame.push(1);
    frame.push(0x0F);
    frame.push(3);

    let crc = crc16_ccitt(&frame[4..59]);
    frame.extend_from_slice(&crc.to_le_bytes());

    let mut parser = FrameParser::new();
    let packets = parser.feed(&frame);

    assert_eq!(packets.len(), 1);
    match &packets[0] {
        ParsedPacket::Rocket(pkt) => {
            assert_eq!(pkt.header, "AA");
            assert_eq!(pkt.timestamp_ms, 154000);
            assert!((pkt.altitude - 512.34).abs() < 0.05);
            assert!((pkt.vertical_velocity - 12.5).abs() < 0.05);
            assert!((pkt.latitude - 38.3687).abs() < 0.0001);
            assert_eq!(pkt.flight_state, FlightState::Powered);
            assert_eq!(pkt.bno_calib, 3);
            assert_eq!(pkt.flags, 0x0F);
        }
        other => panic!("expected rocket packet, got {other:?}"),
    }
    assert_eq!(parser.stats.rocket_packets, 1);
}

