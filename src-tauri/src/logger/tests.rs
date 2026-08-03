//! Tests for the CSV logger module.

use std::fs;

use crate::protocol::rocket_packet::FlightState;
use crate::protocol::telemetry_packet::TelemetryPacket;

use super::csv_writer::CsvLogger;

fn temp_logger(name: &str) -> (CsvLogger, std::path::PathBuf) {
    let dir = std::env::temp_dir().join(format!("azst_test_{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    let logger = CsvLogger::with_session_dir(&dir).unwrap();
    (logger, dir)
}

fn sample_packet(header: &str) -> TelemetryPacket {
    TelemetryPacket {
        header: header.to_string(),
        timestamp_ms: 5000,
        accel_x: 0.12,
        accel_y: -0.05,
        accel_z: 9.8,
        gyro_x: 0.01,
        gyro_y: -0.02,
        gyro_z: 0.005,
        mag_x: 12.5,
        mag_y: -8.2,
        mag_z: 42.1,
        temp: 24.5,
        pressure: 1013.2,
        humidity: 45.0,
        altitude: 1500.0,
        aht_temp: 24.2,
        aht_hum: 46.5,
        latitude: 38.3687,
        longitude: 34.0370,
        gps_altitude: 1500.0,
        gps_speed: 200.0,
        gps_course: 180.0,
        roll: 12.0,
        pitch: 5.0,
        yaw: 90.0,
        flight_state: FlightState::Powered,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
    }
}

#[test]
fn write_single_rocket_packet() {
    let (mut logger, dir) = temp_logger("write_rocket");
    logger.write_rocket(&sample_packet("AA")).unwrap();

    assert_eq!(logger.rocket_count, 1);
    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    assert!(content.contains("timestamp_ms"));
    assert!(content.contains("5000"));
    assert!(content.contains("1500.00"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn write_single_payload_packet() {
    let (mut logger, dir) = temp_logger("write_payload");
    logger.write_payload(&sample_packet("BB")).unwrap();

    assert_eq!(logger.payload_count, 1);
    let content = fs::read_to_string(logger.payload_file_path()).unwrap();
    assert!(content.contains("timestamp_ms"));
    assert!(content.contains("5000"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn write_single_drone_packet() {
    let (mut logger, dir) = temp_logger("write_drone");
    logger.write_drone(&sample_packet("CC")).unwrap();

    assert_eq!(logger.drone_count, 1);
    let content = fs::read_to_string(logger.drone_file_path()).unwrap();
    assert!(content.contains("timestamp_ms"));
    assert!(content.contains("5000"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn write_100_rocket_packets() {
    let (mut logger, dir) = temp_logger("write_100_rocket");

    for i in 0..100 {
        let mut pkt = sample_packet("AA");
        pkt.timestamp_ms = i * 1000;
        pkt.altitude = 100.0 + i as f32 * 10.0;
        logger.write_rocket(&pkt).unwrap();
    }

    assert_eq!(logger.rocket_count, 100);

    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let lines: Vec<&str> = content.trim().lines().collect();
    assert_eq!(lines.len(), 101);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rocket_csv_has_correct_headers() {
    let (mut logger, dir) = temp_logger("rocket_headers");
    logger.write_rocket(&sample_packet("AA")).unwrap();

    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let header = content.lines().next().unwrap();
    assert!(header.contains("timestamp_ms"));
    assert!(header.contains("date_time_iso"));
    assert!(header.contains("flight_state"));
    assert!(header.contains("altitude_m"));
    assert!(header.contains("latitude"));
    assert!(header.contains("longitude"));
    assert!(header.contains("velocity_m_s"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn file_names_contain_session_dir() {
    let (logger, dir) = temp_logger("file_names");
    let rocket_path = logger.rocket_file_path();
    let payload_path = logger.payload_file_path();
    let drone_path = logger.drone_file_path();
    let unified_path = logger.unified_file_path();

    assert!(rocket_path.to_str().unwrap().contains("telemetry_rocket.csv"));
    assert!(payload_path.to_str().unwrap().contains("telemetry_payload.csv"));
    assert!(drone_path.to_str().unwrap().contains("telemetry_drone.csv"));
    assert!(unified_path.to_str().unwrap().contains("telemetry_unified.csv"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn creates_log_directory_if_missing() {
    let dir = std::env::temp_dir().join(format!("azst_test_mkdir_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);

    assert!(!dir.exists());
    let _logger = CsvLogger::with_session_dir(&dir).unwrap();
    assert!(dir.exists());

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn rocket_csv_data_integrity() {
    let (mut logger, dir) = temp_logger("data_integrity");

    let pkt = TelemetryPacket {
        header: "AA".to_string(),
        timestamp_ms: 12345,
        accel_x: 0.12,
        accel_y: -0.05,
        accel_z: 9.8,
        gyro_x: 0.01,
        gyro_y: -0.02,
        gyro_z: 0.005,
        mag_x: 12.5,
        mag_y: -8.2,
        mag_z: 42.1,
        temp: 24.5,
        pressure: 1013.2,
        humidity: 45.0,
        altitude: 2500.7,
        aht_temp: 24.2,
        aht_hum: 46.5,
        latitude: 38.12345,
        longitude: 34.67890,
        gps_altitude: 2500.0,
        gps_speed: 15.0,
        gps_course: 180.0,
        roll: 12.0,
        pitch: 5.0,
        yaw: 90.0,
        flight_state: FlightState::PrimaryChute,
        primary_parachute_deployed: true,
        secondary_parachute_deployed: false,
    };

    logger.write_rocket(&pkt).unwrap();

    let content = fs::read_to_string(logger.rocket_file_path()).unwrap();
    let data_line = content.lines().nth(1).unwrap();
    let fields: Vec<&str> = data_line.split(',').collect();

    assert_eq!(fields[0], "12345");
    assert_eq!(fields[2], "primary_chute");
    assert!(fields[3].starts_with("2500"));

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn mock_to_parser_to_csv_pipeline() {
    use crate::mock::generator::MockGenerator;
    use crate::serial::reader::{FrameParser, ParsedPacket};

    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();
    let (mut logger, dir) = temp_logger("pipeline");

    for tick in 0..25 {
        for mock_pkt in gen.generate_tick(tick) {
            let bytes = match mock_pkt {
                crate::mock::generator::MockPacket::Rocket(b) => b,
                crate::mock::generator::MockPacket::Payload(b) => b,
                crate::mock::generator::MockPacket::Drone(b) => b,
            };
            for parsed in parser.feed(&bytes) {
                match parsed {
                    ParsedPacket::Rocket(r) => logger.write_rocket(&r).unwrap(),
                    ParsedPacket::Payload(p) => logger.write_payload(&p).unwrap(),
                    ParsedPacket::Drone(d) => logger.write_drone(&d).unwrap(),
                }
            }
        }
    }

    assert_eq!(logger.rocket_count, 5);
    assert_eq!(logger.payload_count, 25);
    assert_eq!(logger.drone_count, 25);

    let _ = fs::remove_dir_all(dir);
}
