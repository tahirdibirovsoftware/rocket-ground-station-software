//! Tests for the CSV logger module.
//!
//! Uses temporary directories to avoid polluting the filesystem.

use std::fs;

use crate::protocol::rocket_packet::{FlightState, RocketPacket, ROCKET_PACKET_ID};
use crate::protocol::payload_packet::{PayloadPacket, PAYLOAD_PACKET_ID};

use super::csv_writer::CsvLogger;

/// Helper: create a logger with a temp directory.
fn temp_logger(name: &str) -> (CsvLogger, std::path::PathBuf) {
    let dir = std::env::temp_dir().join(format!("azst_test_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir); // clean up any previous run
    let logger = CsvLogger::with_session_id(&dir, "test_session").unwrap();
    (logger, dir)
}

fn sample_rocket() -> RocketPacket {
    RocketPacket {
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
    }
}

fn sample_payload() -> PayloadPacket {
    PayloadPacket {
        packet_id: PAYLOAD_PACKET_ID,
        timestamp_ms: 5000,
        latitude: 38.3700,
        longitude: 34.0380,
        altitude: 1470.0,
        scientific_data: 25.6,
    }
}

// ============================================================================
// Basic Write Tests
// ============================================================================

#[test]
fn write_single_rocket_packet() {
    let (mut logger, dir) = temp_logger("write_rocket");
    logger.write_rocket(&sample_rocket()).unwrap();

    assert_eq!(logger.rocket_count, 1);
    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    assert!(content.contains("timestamp_ms")); // header
    assert!(content.contains("5000")); // data
    assert!(content.contains("1500.0")); // altitude
    assert!(content.contains("powered")); // flight state

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn write_single_payload_packet() {
    let (mut logger, dir) = temp_logger("write_payload");
    logger.write_payload(&sample_payload()).unwrap();

    assert_eq!(logger.payload_count, 1);
    let content = fs::read_to_string(logger.payload_file_path()).unwrap();
    assert!(content.contains("timestamp_ms")); // header
    assert!(content.contains("5000")); // data
    assert!(content.contains("25.6")); // scientific data

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// Multi-Write Tests
// ============================================================================

#[test]
fn write_100_rocket_packets() {
    let (mut logger, dir) = temp_logger("write_100_rocket");

    for i in 0..100 {
        let mut pkt = sample_rocket();
        pkt.timestamp_ms = i * 1000;
        pkt.altitude = 100.0 + i as f32 * 10.0;
        logger.write_rocket(&pkt).unwrap();
    }

    assert_eq!(logger.rocket_count, 100);

    // Read back and verify line count (1 header + 100 data rows)
    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let lines: Vec<&str> = content.trim().lines().collect();
    assert_eq!(lines.len(), 101); // header + 100 rows

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn write_100_payload_packets() {
    let (mut logger, dir) = temp_logger("write_100_payload");

    for i in 0..100 {
        let mut pkt = sample_payload();
        pkt.timestamp_ms = i * 200;
        pkt.scientific_data = 20.0 + (i as f32 * 0.1).sin();
        logger.write_payload(&pkt).unwrap();
    }

    assert_eq!(logger.payload_count, 100);

    let content = fs::read_to_string(logger.payload_file_path()).unwrap();
    let lines: Vec<&str> = content.trim().lines().collect();
    assert_eq!(lines.len(), 101); // header + 100 rows

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// CSV Header Tests
// ============================================================================

#[test]
fn rocket_csv_has_correct_headers() {
    let (mut logger, dir) = temp_logger("rocket_headers");
    logger.write_rocket(&sample_rocket()).unwrap();

    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let header = content.lines().next().unwrap();
    assert!(header.contains("timestamp_ms"));
    assert!(header.contains("altitude_m"));
    assert!(header.contains("latitude"));
    assert!(header.contains("longitude"));
    assert!(header.contains("pressure1_hpa"));
    assert!(header.contains("pressure2_hpa"));
    assert!(header.contains("velocity_ms"));
    assert!(header.contains("flight_state"));
    assert!(header.contains("primary_parachute"));
    assert!(header.contains("secondary_parachute"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn payload_csv_has_correct_headers() {
    let (mut logger, dir) = temp_logger("payload_headers");
    logger.write_payload(&sample_payload()).unwrap();

    let content = fs::read_to_string(logger.payload_file_path()).unwrap();
    let header = content.lines().next().unwrap();
    assert!(header.contains("timestamp_ms"));
    assert!(header.contains("latitude"));
    assert!(header.contains("longitude"));
    assert!(header.contains("altitude_m"));
    assert!(header.contains("scientific_data"));

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// File Naming Tests
// ============================================================================

#[test]
fn file_names_contain_session_id() {
    let (logger, dir) = temp_logger("file_names");
    let rocket_path = logger.rocket_file_path();
    let payload_path = logger.payload_file_path();

    assert!(rocket_path.to_str().unwrap().contains("rocket_avionics_test_session.csv"));
    assert!(payload_path.to_str().unwrap().contains("payload_scientific_test_session.csv"));

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// Directory Creation Tests
// ============================================================================

#[test]
fn creates_log_directory_if_missing() {
    let dir = std::env::temp_dir().join(format!("azst_test_mkdir_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);

    assert!(!dir.exists());
    let _logger = CsvLogger::with_session_id(&dir, "test").unwrap();
    assert!(dir.exists());

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// CSV Read-Back Verification
// ============================================================================

#[test]
fn rocket_csv_data_integrity() {
    let (mut logger, dir) = temp_logger("data_integrity");

    let pkt = RocketPacket {
        packet_id: ROCKET_PACKET_ID,
        timestamp_ms: 12345,
        altitude: 2500.75,
        latitude: 38.12345,
        longitude: 34.67890,
        pressure1: 750.50,
        pressure2: 749.25,
        velocity: -15.00,
        flight_state: FlightState::PrimaryChute,
        primary_parachute_deployed: true,
        secondary_parachute_deployed: false,
    };

    logger.write_rocket(&pkt).unwrap();

    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let data_line = content.lines().nth(1).unwrap(); // second line = first data row
    let fields: Vec<&str> = data_line.split(',').collect();

    assert_eq!(fields[0], "12345");      // timestamp
    assert!(fields[1].starts_with("2500")); // altitude
    assert_eq!(fields[7], "primary_chute");  // flight state
    assert_eq!(fields[8], "1");          // primary parachute deployed
    assert_eq!(fields[9], "0");          // secondary not deployed

    let _ = fs::remove_dir_all(dir);
}

// ============================================================================
// Integration: Mock → Parse → Log
// ============================================================================

#[test]
fn mock_to_parser_to_csv_pipeline() {
    use crate::mock::generator::MockGenerator;
    use crate::serial::reader::{FrameParser, ParsedPacket};

    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();
    let (mut logger, dir) = temp_logger("pipeline");

    // Simulate 5 seconds of flight (25 ticks)
    for tick in 0..25 {
        for mock_pkt in gen.generate_tick(tick) {
            let bytes = match mock_pkt {
                crate::mock::generator::MockPacket::Rocket(b) => b,
                crate::mock::generator::MockPacket::Payload(b) => b,
            };
            for parsed in parser.feed(&bytes) {
                match parsed {
                    ParsedPacket::Rocket(r) => logger.write_rocket(&r).unwrap(),
                    ParsedPacket::Payload(p) => logger.write_payload(&p).unwrap(),
                }
            }
        }
    }

    // 5 seconds: 5 rocket + 25 payload packets
    assert_eq!(logger.rocket_count, 5);
    assert_eq!(logger.payload_count, 25);

    // Verify files exist and have content
    let rocket_content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let payload_content = fs::read_to_string(logger.payload_file_path()).unwrap();

    assert_eq!(rocket_content.lines().count(), 6);  // header + 5 rows
    assert_eq!(payload_content.lines().count(), 26); // header + 25 rows

    let _ = fs::remove_dir_all(dir);
}
