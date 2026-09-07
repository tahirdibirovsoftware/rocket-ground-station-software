//! Binary RF protocol parser — new Teensy firmware framing.
//!
//! Frame layout (all multi-byte fields little-endian):
//! ```text
//! 0     0xAA  Sync byte 1
//! 1     0x55  Sync byte 2
//! 2     u8    Protocol version
//! 3     u8    Device ID (0xBB = payload, 0xCC = drone)
//! 4     u8    Packet type (1 = telemetry, 2 = status event)
//! 5-6   u16   Sequence number
//! 7-10  u32   Timestamp (millis since boot)
//! 11    u8    Payload length
//! 12..  ..    Payload
//! last  u16   CRC-16/CCITT-FALSE over all preceding bytes
//! ```
//!
//! Shared telemetry layout (offsets 0-66 identical for both devices):
//! ```text
//! 0-1   u16 flags: 0x01 BNO, 0x02 BME, 0x04 AHT, 0x08 GPS_FIX,
//!                  0x10 ARMED
//! 2     i16[9]  ax,ay,az (x100), gx,gy,gz (x1000), mx,my,mz (x10)
//! 20    i16     temp (x100 C), u16 pressure (x10 hPa),
//!               u16 humidity (x100 %), i32 altitude (x100 m)
//! 30    i16     aht_temp (x100 C), u16 aht_hum (x100 %)
//! 34    i32     lat (x1e7), i32 lon (x1e7), i32 gps_alt (x100 m),
//!               u16 speed (x100 m/s), u16 course (x100 deg), u8 sats
//! 51    i16[3]  roll, pitch, yaw (x100 deg)
//! 57    i32     rel_alt (x100 m), i16 vel (x100 m/s),
//!               u16 g_force (x1000), i16 dpdt (x1000)
//! ```
//!
//! Payload (BB) tail (payload total 71 bytes):
//! ```text
//! 67    u16     fast_g (x1000)
//! 69    u8      flight_phase (0/1/2), u8 ground (0/1)
//! flags extras: 0x20 CAL_SAVED, 0x40 GROUND
//! ```
//!
//! Drone (CC) tail (payload total 72 bytes):
//! ```text
//! 67    i16     accel_bias (x1000)
//! 69    u8      state_code (0=DISARMED, 1=ARMED_WAIT, 2=MOTORS_ON,
//!                            3=MOTORS_HOLD, 4=TOUCHDOWN)
//! 70    u16     throttle_us (1000..2000)
//! flags extras: 0x20 MOTORS_ON, 0x40 TOUCHDOWN, 0x80 DESCENDING
//! ```
//!
//! Status event payloads:
//! - Payload (2 bytes): `[ground (0/1), flight_phase (0/1/2)]`
//! - Drone (4 bytes): `[state_code, throttle u16, armed (0/1)]`

use crate::protocol::rocket_packet::FlightState;
use crate::protocol::telemetry_packet::TelemetryPacket;

pub const SYNC1: u8 = 0xAA;
pub const SYNC2: u8 = 0x55;

pub const DEVICE_PAYLOAD: u8 = 0xBB;
pub const DEVICE_DRONE: u8 = 0xCC;

pub const PKT_TELEMETRY: u8 = 0x01;
pub const PKT_STATUS: u8 = 0x02;

/// STM32 Rocket protocol constants
pub const ROCKET_HDR0: u8 = 0xAA;
pub const ROCKET_HDR1: u8 = 0x55;
pub const ROCKET_TYPE_TELEM: u8 = 0x01;
pub const ROCKET_PAYLOAD_LEN: usize = 55;
pub const ROCKET_FRAME_SIZE: usize = 4 + ROCKET_PAYLOAD_LEN + 2; // 61 bytes

pub const FLAG_BNO_OK: u16 = 0x0001;
pub const FLAG_BME_OK: u16 = 0x0002;
pub const FLAG_AHT_OK: u16 = 0x0004;
pub const FLAG_GPS_FIX: u16 = 0x0008;
pub const FLAG_ARMED: u16 = 0x0010;
/// Payload: calibration saved / Drone: motors running.
pub const FLAG_CAL_SAVED: u16 = 0x0020;
/// Drone only: motors running.
pub const FLAG_MOTORS_ON: u16 = 0x0020;
/// Payload: on ground / Drone: touchdown / Firmware: outputs active.
pub const FLAG_GROUND: u16 = 0x0040;
pub const FLAG_OUTPUT_ACTIVE: u16 = 0x0040;
/// Drone only: touchdown.
pub const FLAG_TOUCHDOWN: u16 = 0x0040;
/// Drone only: descending.
pub const FLAG_DESCENDING: u16 = 0x0080;

/// Maximum frame size (12 header + 96 payload + 2 CRC).
pub const MAX_FRAME_SIZE: usize = 160;

/// CRC-16/CCITT-FALSE: init 0xFFFF, poly 0x1021, MSB-first, no reflection.
pub fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

/// A parsed binary frame.
#[derive(Debug, Clone)]
pub struct BinaryFrame {
    pub version: u8,
    pub device_id: u8,
    pub packet_type: u8,
    pub sequence: u16,
    pub timestamp_ms: u32,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FrameError {
    /// Frame is too short to contain header + CRC.
    TooShort,
    /// Payload length exceeds the maximum allowed size.
    PayloadTooLarge,
    /// CRC mismatch (expected, actual).
    CrcMismatch { expected: u16, actual: u16 },
}

impl std::fmt::Display for FrameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooShort => write!(f, "binary frame too short"),
            Self::PayloadTooLarge => write!(f, "binary frame payload too large"),
            Self::CrcMismatch { expected, actual } => write!(
                f,
                "binary frame CRC mismatch (expected {expected:#06x}, got {actual:#06x})"
            ),
        }
    }
}

/// Validate and parse a complete binary frame (sync bytes included).
pub fn parse_frame(buf: &[u8]) -> Result<BinaryFrame, FrameError> {
    if buf.len() < 14 {
        return Err(FrameError::TooShort);
    }
    if buf[0] != SYNC1 || buf[1] != SYNC2 {
        return Err(FrameError::TooShort);
    }

    let payload_len = buf[11] as usize;
    let expected_total = 12 + payload_len + 2;
    if expected_total > MAX_FRAME_SIZE {
        return Err(FrameError::PayloadTooLarge);
    }
    if buf.len() < expected_total {
        return Err(FrameError::TooShort);
    }

    let expected_crc = u16::from_le_bytes([buf[expected_total - 2], buf[expected_total - 1]]);
    let actual_crc = crc16_ccitt(&buf[..expected_total - 2]);
    if expected_crc != actual_crc {
        return Err(FrameError::CrcMismatch {
            expected: expected_crc,
            actual: actual_crc,
        });
    }

    Ok(BinaryFrame {
        version: buf[2],
        device_id: buf[3],
        packet_type: buf[4],
        sequence: u16::from_le_bytes([buf[5], buf[6]]),
        timestamp_ms: u32::from_le_bytes([buf[7], buf[8], buf[9], buf[10]]),
        payload: buf[12..12 + payload_len].to_vec(),
    })
}

/// Decode an STM32 Rocket binary telemetry frame (61 bytes total).
///
/// Header: [0xAA, 0x55, 0x01, 55] (4 bytes)
/// Payload: 55 bytes
/// Checksum: CRC-16/CCITT-FALSE over bytes 4..59 (2 bytes LE)
pub fn parse_rocket_frame(buf: &[u8]) -> Result<TelemetryPacket, FrameError> {
    if buf.len() < ROCKET_FRAME_SIZE {
        return Err(FrameError::TooShort);
    }
    if buf[0] != ROCKET_HDR0 || buf[1] != ROCKET_HDR1 {
        return Err(FrameError::TooShort);
    }
    let payload_len = buf[3] as usize;
    if payload_len != ROCKET_PAYLOAD_LEN {
        return Err(FrameError::PayloadTooLarge);
    }

    let expected_crc = u16::from_le_bytes([buf[59], buf[60]]);
    let actual_crc = crc16_ccitt(&buf[4..59]);
    if expected_crc != actual_crc {
        return Err(FrameError::CrcMismatch {
            expected: expected_crc,
            actual: actual_crc,
        });
    }

    let p = &buf[4..59];
    let timestamp_ms = u32::from_le_bytes([p[0], p[1], p[2], p[3]]);

    // BNO055 SLERP-filtered quaternion (qw, qx, qy, qz)
    let _qw = rd_i16(p, 4) as f32 / 32767.0;
    let _qx = rd_i16(p, 6) as f32 / 32767.0;
    let _qy = rd_i16(p, 8) as f32 / 32767.0;
    let _qz = rd_i16(p, 10) as f32 / 32767.0;

    // Linear acceleration (accel_x, accel_y, accel_z) in m/s^2
    let accel_x = rd_i16(p, 12) as f32 / 100.0;
    let accel_y = rd_i16(p, 14) as f32 / 100.0;
    let accel_z = rd_i16(p, 16) as f32 / 100.0;

    // Euler angles (angle_x, angle_y, angle_z) in degrees
    let roll = rd_i16(p, 18) as f32 / 10.0;
    let pitch = rd_i16(p, 20) as f32 / 10.0;
    let yaw = rd_i16(p, 22) as f32 / 10.0;

    // BME280 barometric sensor
    let temp = rd_i16(p, 24) as f32 / 10.0;
    let pressure = rd_i16(p, 26) as f32 / 10.0;
    let humidity = rd_i16(p, 28) as f32 / 10.0;

    // Barometric altitude in meters
    let altitude = rd_i32(p, 30) as f32 / 100.0;

    // AHT20 ambient sensor
    let aht_temp = rd_i16(p, 34) as f32 / 10.0;
    let aht_hum = rd_i16(p, 36) as f32 / 10.0;

    // GPS coordinates & altitude
    let latitude = rd_i32(p, 38) as f32 / 1e7;
    let longitude = rd_i32(p, 42) as f32 / 1e7;
    let gps_altitude = rd_i16(p, 46) as f32;

    // Resultant dynamics
    let g_force = rd_i16(p, 48) as f32 / 100.0;
    let vertical_speed = rd_i16(p, 50) as f32 / 100.0;

    // Flight state & pyro chute triggers
    let raw_state = p[52];
    let (flight_state, primary_chute, secondary_chute) = match raw_state {
        0 => (FlightState::Pad, false, false),
        1 => (
            if vertical_speed > 0.0 {
                FlightState::Powered
            } else {
                FlightState::Unpowered
            },
            false,
            false,
        ),
        2 => (FlightState::PrimaryChute, true, false), // FS_APOGEE -> drogue parachute fired
        3 => (FlightState::SecondaryChute, true, true), // FS_MAIN -> main parachute fired
        4 => (FlightState::Pad, true, true), // FS_LANDED -> touchdown
        _ => (FlightState::Pad, false, false),
    };

    let flags = p[53];
    let bno_calib = p[54];

    Ok(TelemetryPacket {
        header: "AA".to_string(),
        timestamp_ms,
        accel_x,
        accel_y,
        accel_z,
        gyro_x: 0.0,
        gyro_y: 0.0,
        gyro_z: 0.0,
        mag_x: 0.0,
        mag_y: 0.0,
        mag_z: 0.0,
        temp,
        pressure,
        humidity,
        altitude,
        aht_temp,
        aht_hum,
        latitude,
        longitude,
        gps_altitude,
        gps_speed: vertical_speed.abs(),
        gps_course: yaw,
        roll,
        pitch,
        yaw,
        flight_state,
        primary_parachute_deployed: primary_chute,
        secondary_parachute_deployed: secondary_chute,
        rel_alt: altitude,
        vertical_velocity: vertical_speed,
        g_force,
        dpdt: 0.0,
        armed: false,
        state_code: raw_state,
        throttle_us: 0,
        on_ground: raw_state == 0 || raw_state == 4,
        flight_phase: raw_state,
        fast_g: g_force,
        outputs_active: primary_chute || secondary_chute,
        bno_calib,
        flags,
    })
}


// ── little-endian readers ────────────────────────────────────────────────

fn rd_i16(p: &[u8], off: usize) -> i16 {
    i16::from_le_bytes([p[off], p[off + 1]])
}
fn rd_u16(p: &[u8], off: usize) -> u16 {
    u16::from_le_bytes([p[off], p[off + 1]])
}
fn rd_i32(p: &[u8], off: usize) -> i32 {
    i32::from_le_bytes([p[off], p[off + 1], p[off + 2], p[off + 3]])
}

fn to_f32_i16(v: i16, scale: f32) -> f32 {
    v as f32 / scale
}
fn to_f32_u16(v: u16, scale: f32) -> f32 {
    v as f32 / scale
}
fn to_f32_i32(v: i32, scale: f32) -> f32 {
    v as f32 / scale
}

/// Decode a telemetry payload into a `TelemetryPacket`.
///
/// Returns `None` if the payload is too short to be a valid telemetry payload
/// or the device ID is unknown.
pub fn parse_telemetry_payload(
    device_id: u8,
    timestamp_ms: u32,
    payload: &[u8],
) -> Option<TelemetryPacket> {
    // Both Payload and Drone frames in the Teensy firmware are 71 bytes;
    // legacy drone test frames can be 72 bytes.
    if payload.len() < 71 {
        return None;
    }

    let flags = rd_u16(payload, 0);

    let header = match device_id {
        DEVICE_PAYLOAD => "BB",
        DEVICE_DRONE => "CC",
        _ => return None,
    };

    // IMU: 9 i16 values (always present; zeroed when BNO off)
    let ax = to_f32_i16(rd_i16(payload, 2), 100.0);
    let ay = to_f32_i16(rd_i16(payload, 4), 100.0);
    let az = to_f32_i16(rd_i16(payload, 6), 100.0);
    let gx = to_f32_i16(rd_i16(payload, 8), 1000.0);
    let gy = to_f32_i16(rd_i16(payload, 10), 1000.0);
    let gz = to_f32_i16(rd_i16(payload, 12), 1000.0);
    let mx = to_f32_i16(rd_i16(payload, 14), 10.0);
    let my = to_f32_i16(rd_i16(payload, 16), 10.0);
    let mz = to_f32_i16(rd_i16(payload, 18), 10.0);

    // BME280: temp, pressure, humidity, altitude
    let temp = to_f32_i16(rd_i16(payload, 20), 100.0);
    let pressure = to_f32_u16(rd_u16(payload, 22), 10.0);
    let humidity = to_f32_u16(rd_u16(payload, 24), 100.0);
    let altitude = to_f32_i32(rd_i32(payload, 26), 100.0);

    // AHT20
    let aht_temp = to_f32_i16(rd_i16(payload, 30), 100.0);
    let aht_hum = to_f32_u16(rd_u16(payload, 32), 100.0);

    // GPS
    let latitude = rd_i32(payload, 34) as f32 / 10_000_000.0;
    let longitude = rd_i32(payload, 38) as f32 / 10_000_000.0;
    let gps_altitude = to_f32_i32(rd_i32(payload, 42), 100.0);
    let gps_speed = to_f32_u16(rd_u16(payload, 46), 100.0);
    let gps_course = to_f32_u16(rd_u16(payload, 48), 100.0);

    // Attitude
    let roll = to_f32_i16(rd_i16(payload, 51), 100.0);
    let pitch = to_f32_i16(rd_i16(payload, 53), 100.0);
    let yaw = to_f32_i16(rd_i16(payload, 55), 100.0);

    // Alt/vel filter (shared layout)
    let rel_alt = to_f32_i32(rd_i32(payload, 57), 100.0);
    let vertical_velocity = to_f32_i16(rd_i16(payload, 61), 100.0);
    let g_force = to_f32_u16(rd_u16(payload, 63), 1000.0);
    let dpdt = to_f32_i16(rd_i16(payload, 65), 1000.0);

    // Device-specific tail
    let (state_code, throttle_us, on_ground, flight_phase, fast_g, outputs_active) = match device_id {
        DEVICE_PAYLOAD => {
            // fast_g at 67-68 (u16 x1000), flight_phase at 69, outputs_active at 70
            let fast_g = to_f32_u16(rd_u16(payload, 67), 1000.0);
            let flight_phase = payload[69];
            let outputs_active = payload[70] == 1 || (flags & FLAG_OUTPUT_ACTIVE != 0);
            let on_ground = flight_phase == 2;
            let state_code = flight_phase;
            let throttle_us = if outputs_active { 1480 } else { 1000 };
            (state_code, throttle_us, on_ground, flight_phase, fast_g, outputs_active)
        }
        DEVICE_DRONE => {
            if payload.len() == 71 {
                // Teensy 4.1 flight controller installed on drone hardware (71-byte layout)
                let fast_g = to_f32_u16(rd_u16(payload, 67), 1000.0);
                let flight_phase = payload[69];
                let outputs_active = payload[70] == 1 || (flags & FLAG_OUTPUT_ACTIVE != 0);
                let on_ground = flight_phase == 2;
                let state_code = flight_phase;
                let throttle_us = if outputs_active { 1480 } else { 1000 };
                (state_code, throttle_us, on_ground, flight_phase, fast_g, outputs_active)
            } else {
                // Legacy drone frame layout (72 bytes: accel_bias, state_code, throttle_us)
                let accel_bias = to_f32_i16(rd_i16(payload, 67), 1000.0);
                let state_code = payload[69];
                let throttle_us = rd_u16(payload, 70);
                let on_ground = flags & FLAG_TOUCHDOWN != 0;
                let outputs_active = flags & FLAG_MOTORS_ON != 0 || throttle_us > 1000;
                let flight_phase = 0;
                (state_code, throttle_us, on_ground, flight_phase, accel_bias, outputs_active)
            }
        }
        _ => unreachable!(),
    };

    // Validity masks: zero out sensors flagged off
    let valid_bno = flags & FLAG_BNO_OK != 0;
    let valid_bme = flags & FLAG_BME_OK != 0;
    let valid_aht = flags & FLAG_AHT_OK != 0;
    let valid_gps = flags & FLAG_GPS_FIX != 0;

    Some(TelemetryPacket {
        header: header.to_string(),
        timestamp_ms,
        accel_x: if valid_bno { ax } else { 0.0 },
        accel_y: if valid_bno { ay } else { 0.0 },
        accel_z: if valid_bno { az } else { 0.0 },
        gyro_x: if valid_bno { gx } else { 0.0 },
        gyro_y: if valid_bno { gy } else { 0.0 },
        gyro_z: if valid_bno { gz } else { 0.0 },
        mag_x: if valid_bno { mx } else { 0.0 },
        mag_y: if valid_bno { my } else { 0.0 },
        mag_z: if valid_bno { mz } else { 0.0 },
        temp: if valid_bme { temp } else { 0.0 },
        pressure: if valid_bme { pressure } else { 0.0 },
        humidity: if valid_bme { humidity } else { 0.0 },
        altitude: if valid_bme { altitude } else { 0.0 },
        aht_temp: if valid_aht { aht_temp } else { 0.0 },
        aht_hum: if valid_aht { aht_hum } else { 0.0 },
        latitude: if valid_gps { latitude } else { 0.0 },
        longitude: if valid_gps { longitude } else { 0.0 },
        gps_altitude: if valid_gps { gps_altitude } else { 0.0 },
        gps_speed: if valid_gps { gps_speed } else { 0.0 },
        gps_course: if valid_gps { gps_course } else { 0.0 },
        roll,
        pitch,
        yaw,
        flight_state: FlightState::Pad,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
        rel_alt,
        vertical_velocity,
        g_force,
        dpdt,
        armed: flags & FLAG_ARMED != 0,
        state_code,
        throttle_us,
        on_ground,
        flight_phase,
        fast_g,
        outputs_active,
        bno_calib: 0,
        flags: (flags & 0xFF) as u8,
    })
}

/// Decode a payload status-event payload:
/// Accepts 2-byte Teensy firmware payload `[output_status (0/1), flight_phase (0/1/2)]`.
/// Returns `(on_ground, flight_phase, outputs_active)`.
pub fn parse_payload_status_payload(payload: &[u8]) -> Option<(bool, u8, bool)> {
    if payload.len() < 2 {
        return None;
    }
    let outputs_active = payload[0] == 1;
    let flight_phase = payload[1];
    let on_ground = flight_phase == 2;
    Some((on_ground, flight_phase, outputs_active))
}

/// Decode a drone status-event payload:
/// Accepts either 2-byte Teensy firmware payload `[output_status (0/1), flight_phase (0/1/2)]`
/// or legacy 4-byte payload `[state_code, throttle u16, armed (0/1)]`.
pub fn parse_drone_status_payload(payload: &[u8]) -> Option<(u8, u16, bool)> {
    if payload.len() == 2 && payload[0] <= 1 && payload[1] <= 2 {
        let output_active = payload[0] == 1;
        let flight_phase = payload[1];
        let throttle_us = if output_active { 1480 } else { 1000 };
        Some((flight_phase, throttle_us, true))
    } else if payload.len() >= 4 {
        Some((payload[0], rd_u16(payload, 1), payload[3] == 1))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Standard CRC-16/CCITT-FALSE check value.
    #[test]
    fn crc16_known_answer() {
        assert_eq!(crc16_ccitt(b"123456789"), 0x29B1);
    }

    /// Build a complete telemetry frame for testing.
    fn build_telemetry_frame(device: u8, flags: u16, phase: u8, ground: u8) -> Vec<u8> {
        let mut frame = vec![
            SYNC1,
            SYNC2,
            0x01,       // version
            device,     // device id
            PKT_TELEMETRY,
            0x34, 0x12, // seq 0x1234
            0x78, 0x56, 0x34, 0x12, // timestamp 0x12345678
            71,         // payload length
        ];

        let mut p: Vec<u8> = Vec::with_capacity(71);
        p.extend_from_slice(&flags.to_le_bytes());
        // IMU: ax=1.23 (123), ay=-4.56 (-456), az=9.81 (981), gx=0.5 (500),
        // gy=-0.25 (-250), gz=0.125 (125), mx=12.3 (123), my=-45.6 (-456), mz=78.9 (789)
        for v in [123i16, -456, 981, 500, -250, 125, 123, -456, 789] {
            p.extend_from_slice(&v.to_le_bytes());
        }
        // BME: temp 23.45 (2345), pressure 1013.2 (10132), humidity 45.5 (4550), altitude 1234.56 (123456)
        p.extend_from_slice(&2345i16.to_le_bytes());
        p.extend_from_slice(&10132u16.to_le_bytes());
        p.extend_from_slice(&4550u16.to_le_bytes());
        p.extend_from_slice(&123456i32.to_le_bytes());
        // AHT: temp 22.34 (2234), hum 51.2 (5120)
        p.extend_from_slice(&2234i16.to_le_bytes());
        p.extend_from_slice(&5120u16.to_le_bytes());
        // GPS: lat 38.3687, lon 34.0370, alt 1500.25 (150025), speed 12.5 (1250), course 180.0 (18000), sats 8
        let lat_e7 = (38.3687 * 10_000_000.0) as i32;
        let lon_e7 = (34.0370 * 10_000_000.0) as i32;
        p.extend_from_slice(&lat_e7.to_le_bytes());
        p.extend_from_slice(&lon_e7.to_le_bytes());
        p.extend_from_slice(&150025i32.to_le_bytes());
        p.extend_from_slice(&1250u16.to_le_bytes());
        p.extend_from_slice(&18000u16.to_le_bytes());
        p.push(8);
        // Attitude: roll 5.5 (550), pitch -3.2 (-320), yaw 90.0 (9000)
        for v in [550i16, -320, 9000] {
            p.extend_from_slice(&v.to_le_bytes());
        }
        // AltVel: rel_alt 456.78 (45678), vel -12.34 (-1234), g 1.234 (1234), dpdt -0.567 (-567), fast_g 1.05 (1050)
        p.extend_from_slice(&45678i32.to_le_bytes());
        p.extend_from_slice(&(-1234i16).to_le_bytes());
        p.extend_from_slice(&1234u16.to_le_bytes());
        p.extend_from_slice(&(-567i16).to_le_bytes());
        p.extend_from_slice(&1050u16.to_le_bytes());
        p.push(phase);
        p.push(ground);
        assert_eq!(p.len(), 71);

        frame.extend_from_slice(&p);
        let crc = crc16_ccitt(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        frame
    }

    /// Build a drone-shaped telemetry frame (72-byte payload, state/throttle tail).
    fn build_drone_telemetry_frame(flags: u16, state_code: u8, throttle_us: u16) -> Vec<u8> {
        let mut frame = vec![
            SYNC1,
            SYNC2,
            0x01,       // version
            DEVICE_DRONE,
            PKT_TELEMETRY,
            0x78, 0x56, // seq
            0x78, 0x56, 0x34, 0x12, // timestamp
            72,         // payload length
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
        // accel_bias (i16 x1000)
        p.extend_from_slice(&25i16.to_le_bytes());
        // state_code + throttle
        p.push(state_code);
        p.extend_from_slice(&throttle_us.to_le_bytes());
        assert_eq!(p.len(), 72);

        frame.extend_from_slice(&p);
        let crc = crc16_ccitt(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        frame
    }

    #[test]
    fn frame_parse_round_trip() {
        let frame = build_telemetry_frame(DEVICE_PAYLOAD, 0xFFFF, 1, 0);
        let parsed = parse_frame(&frame).expect("frame should parse");

        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.device_id, DEVICE_PAYLOAD);
        assert_eq!(parsed.packet_type, PKT_TELEMETRY);
        assert_eq!(parsed.sequence, 0x1234);
        assert_eq!(parsed.timestamp_ms, 0x12345678);
        assert_eq!(parsed.payload.len(), 71);
    }

    #[test]
    fn frame_crc_mismatch_rejected() {
        let mut frame = build_telemetry_frame(DEVICE_PAYLOAD, 0xFFFF, 1, 0);
        let last = frame.len() - 1;
        frame[last] ^= 0xFF;

        match parse_frame(&frame) {
            Err(FrameError::CrcMismatch { .. }) => {}
            other => panic!("expected CRC mismatch, got {other:?}"),
        }
    }

    #[test]
    fn frame_too_short_rejected() {
        assert!(matches!(
            parse_frame(&[SYNC1, SYNC2, 0x01]),
            Err(FrameError::TooShort)
        ));
    }

    #[test]
    fn telemetry_payload_decodes_scales() {
        let frame = build_telemetry_frame(DEVICE_PAYLOAD, 0xFFFF, 1, 0);
        let parsed = parse_frame(&frame).unwrap();
        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .expect("telemetry payload should decode");

        assert_eq!(pkt.header, "BB");
        assert_eq!(pkt.timestamp_ms, 0x12345678);
        assert!((pkt.accel_x - 1.23).abs() < 0.01);
        assert!((pkt.accel_y - -4.56).abs() < 0.01);
        assert!((pkt.accel_z - 9.81).abs() < 0.01);
        assert!((pkt.gyro_x - 0.5).abs() < 0.001);
        assert!((pkt.mag_z - 78.9).abs() < 0.1);
        assert!((pkt.temp - 23.45).abs() < 0.01);
        assert!((pkt.pressure - 1013.2).abs() < 0.01);
        assert!((pkt.humidity - 45.5).abs() < 0.01);
        assert!((pkt.altitude - 1234.56).abs() < 0.01);
        assert!((pkt.aht_temp - 22.34).abs() < 0.01);
        assert!((pkt.aht_hum - 51.2).abs() < 0.01);
        assert!((pkt.latitude - 38.3687).abs() < 1e-4);
        assert!((pkt.longitude - 34.0370).abs() < 1e-4);
        assert!((pkt.gps_altitude - 1500.25).abs() < 0.01);
        assert!((pkt.gps_speed - 12.5).abs() < 0.01);
        assert!((pkt.gps_course - 180.0).abs() < 0.01);
        assert!((pkt.roll - 5.5).abs() < 0.01);
        assert!((pkt.pitch - -3.2).abs() < 0.01);
        assert!((pkt.yaw - 90.0).abs() < 0.01);
        assert!((pkt.rel_alt - 456.78).abs() < 0.01);
        assert!((pkt.vertical_velocity - -12.34).abs() < 0.01);
        assert!((pkt.g_force - 1.234).abs() < 0.001);
        assert!((pkt.dpdt - -0.567).abs() < 0.001);
        assert_eq!(pkt.flight_phase, 1);
        assert!(!pkt.on_ground);
        assert!(pkt.armed, "flags with ARMED bit should map to armed");
    }

    #[test]
    fn telemetry_payload_respects_validity_flags() {
        // Only BME + GPS valid
        let flags = FLAG_BME_OK | FLAG_GPS_FIX;
        let frame = build_telemetry_frame(DEVICE_PAYLOAD, flags, 1, 0);
        let parsed = parse_frame(&frame).unwrap();
        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .expect("payload should decode");

        assert_eq!(pkt.accel_x, 0.0, "BNO off → IMU zeroed");
        assert_eq!(pkt.aht_temp, 0.0, "AHT off → zeroed");
        assert!((pkt.temp - 23.45).abs() < 0.01, "BME on → decoded");
        assert!((pkt.latitude - 38.3687).abs() < 1e-4, "GPS on → decoded");
        assert!(!pkt.armed);
    }

    #[test]
    fn ground_flag_maps_on_ground() {
        let frame = build_telemetry_frame(DEVICE_PAYLOAD, 0xFFFF | FLAG_GROUND, 2, 1);
        let parsed = parse_frame(&frame).unwrap();
        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .unwrap();
        assert!(pkt.on_ground);
        assert_eq!(pkt.flight_phase, 2);
    }

    #[test]
    fn drone_device_id_maps_header_cc() {
        let flags = FLAG_BNO_OK | FLAG_BME_OK | FLAG_AHT_OK | FLAG_GPS_FIX | FLAG_ARMED | FLAG_MOTORS_ON;
        let frame = build_drone_telemetry_frame(flags, 2, 1480);
        let parsed = parse_frame(&frame).unwrap();
        assert_eq!(parsed.payload.len(), 72);
        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .unwrap();
        assert_eq!(pkt.header, "CC");
        assert_eq!(pkt.state_code, 2, "state_code at offset 69");
        assert_eq!(pkt.throttle_us, 1480, "throttle at offset 70-71");
        assert_eq!(pkt.on_ground, false);
        assert_eq!(pkt.flight_phase, 0);
        assert!(pkt.armed);
    }

    #[test]
    fn drone_touchdown_flag_maps_on_ground() {
        let frame = build_drone_telemetry_frame(FLAG_ARMED | FLAG_TOUCHDOWN | FLAG_DESCENDING, 4, 1000);
        let parsed = parse_frame(&frame).unwrap();
        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .unwrap();
        assert!(pkt.on_ground, "TOUCHDOWN flag → on_ground");
        assert_eq!(pkt.state_code, 4);
        assert_eq!(pkt.throttle_us, 1000);
    }

    #[test]
    fn payload_status_payload_decodes() {
        assert_eq!(parse_payload_status_payload(&[1, 2]), Some((true, 2, true)));
        assert_eq!(parse_payload_status_payload(&[0, 0]), Some((false, 0, false)));
        assert_eq!(parse_payload_status_payload(&[1, 1]), Some((false, 1, true)));
        assert_eq!(parse_payload_status_payload(&[1]), None);
    }

    #[test]
    fn drone_status_payload_decodes() {
        // [state_code=3, throttle 0xD204 LE (1234), armed=1]
        assert_eq!(
            parse_drone_status_payload(&[3, 0xD2, 0x04, 1]),
            Some((3, 1234, true))
        );
        assert_eq!(
            parse_drone_status_payload(&[0, 0xE8, 0x03, 0]),
            Some((0, 1000, false))
        );
        assert_eq!(parse_drone_status_payload(&[1, 0xE8]), None);
    }

    #[test]
    fn drone_firmware_2_byte_status_decodes() {
        // Firmware format: [output_status (0/1), flight_phase (0/1/2)]
        // Active output (1) during IN_AIR (1)
        assert_eq!(
            parse_drone_status_payload(&[1, 1]),
            Some((1, 1480, true))
        );
        // Cutoff output (0) during ON_GROUND (2)
        assert_eq!(
            parse_drone_status_payload(&[0, 2]),
            Some((2, 1000, true))
        );
    }

    #[test]
    fn drone_firmware_71_byte_telemetry_decodes() {
        // Firmware packet with DEVICE_DRONE (0xCC) and 71-byte payload
        let flags = FLAG_BNO_OK | FLAG_BME_OK | FLAG_AHT_OK | FLAG_GPS_FIX | FLAG_ARMED | FLAG_OUTPUT_ACTIVE;
        let frame = build_telemetry_frame(DEVICE_DRONE, flags, 1, 1);
        let parsed = parse_frame(&frame).expect("frame parses successfully");
        assert_eq!(parsed.payload.len(), 71);

        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .expect("firmware drone telemetry decodes");

        assert_eq!(pkt.header, "CC");
        assert_eq!(pkt.flight_phase, 1);
        assert!(pkt.outputs_active);
        assert_eq!(pkt.throttle_us, 1480);
        assert!((pkt.fast_g - 1.05).abs() < 0.01);
        assert!(pkt.armed);
        assert!(!pkt.on_ground, "Phase 1 (IN_AIR) is not on ground");
    }

    #[test]
    fn payload_firmware_71_byte_telemetry_decodes() {
        // Firmware packet with DEVICE_PAYLOAD (0xBB) and 71-byte payload
        let flags = FLAG_BNO_OK | FLAG_BME_OK | FLAG_AHT_OK | FLAG_GPS_FIX | FLAG_ARMED | FLAG_OUTPUT_ACTIVE;
        let frame = build_telemetry_frame(DEVICE_PAYLOAD, flags, 2, 1);
        let parsed = parse_frame(&frame).expect("frame parses successfully");
        assert_eq!(parsed.payload.len(), 71);

        let pkt = parse_telemetry_payload(parsed.device_id, parsed.timestamp_ms, &parsed.payload)
            .expect("firmware payload telemetry decodes");

        assert_eq!(pkt.header, "BB");
        assert_eq!(pkt.flight_phase, 2);
        assert!(pkt.outputs_active);
        assert_eq!(pkt.throttle_us, 1480);
        assert!((pkt.fast_g - 1.05).abs() < 0.01);
        assert!(pkt.armed);
        assert!(pkt.on_ground, "Phase 2 (ON_GROUND) is on ground");
    }

    fn build_stm32_rocket_frame(
        ms: u32,
        alt_m: f32,
        vs_m_s: f32,
        state: u8,
        flags: u8,
        bno_calib: u8,
    ) -> Vec<u8> {
        let mut f = Vec::with_capacity(ROCKET_FRAME_SIZE);
        // Header: [0xAA, 0x55, 0x01, 55]
        f.push(ROCKET_HDR0);
        f.push(ROCKET_HDR1);
        f.push(ROCKET_TYPE_TELEM);
        f.push(ROCKET_PAYLOAD_LEN as u8);

        // Payload start at offset 4
        // ms (u32 LE)
        f.extend_from_slice(&ms.to_le_bytes());
        // qw, qx, qy, qz (4 * i16 LE)
        f.extend_from_slice(&((0.95 * 32767.0) as i16).to_le_bytes());
        f.extend_from_slice(&((0.01 * 32767.0) as i16).to_le_bytes());
        f.extend_from_slice(&((0.02 * 32767.0) as i16).to_le_bytes());
        f.extend_from_slice(&((0.03 * 32767.0) as i16).to_le_bytes());
        // accel_x, y, z (3 * i16 LE, x100)
        f.extend_from_slice(&(150i16).to_le_bytes()); // 1.50 m/s^2
        f.extend_from_slice(&(-20i16).to_le_bytes());
        f.extend_from_slice(&(980i16).to_le_bytes()); // 9.80 m/s^2
        // angle_x, y, z (roll, pitch, yaw x10)
        f.extend_from_slice(&(125i16).to_le_bytes()); // 12.5 deg
        f.extend_from_slice(&(-45i16).to_le_bytes()); // -4.5 deg
        f.extend_from_slice(&(1800i16).to_le_bytes()); // 180.0 deg
        // bme_temp, pres, hum (x10)
        f.extend_from_slice(&(265i16).to_le_bytes()); // 26.5 C
        f.extend_from_slice(&(9500i16).to_le_bytes()); // 950.0 hPa
        f.extend_from_slice(&(450i16).to_le_bytes()); // 45.0 %
        // altitude (i32 LE, x100)
        f.extend_from_slice(&((alt_m * 100.0) as i32).to_le_bytes());
        // aht_temp, hum (x10)
        f.extend_from_slice(&(258i16).to_le_bytes()); // 25.8 C
        f.extend_from_slice(&(462i16).to_le_bytes()); // 46.2 %
        // gps_lat, lon (i32 LE, x1e7)
        f.extend_from_slice(&((38.3687 * 1e7) as i32).to_le_bytes());
        f.extend_from_slice(&((34.0370 * 1e7) as i32).to_le_bytes());
        // gps_alt (i16)
        f.extend_from_slice(&(1250i16).to_le_bytes());
        // total_g (i16, x100)
        f.extend_from_slice(&(105i16).to_le_bytes()); // 1.05 g
        // vertical_speed (i16, x100)
        f.extend_from_slice(&((vs_m_s * 100.0) as i16).to_le_bytes());
        // state, flags, bno_calib
        f.push(state);
        f.push(flags);
        f.push(bno_calib);

        assert_eq!(f.len(), 4 + ROCKET_PAYLOAD_LEN);

        // CRC16 over payload bytes 4..59
        let crc = crc16_ccitt(&f[4..59]);
        f.extend_from_slice(&crc.to_le_bytes());

        assert_eq!(f.len(), ROCKET_FRAME_SIZE);
        f
    }

    #[test]
    fn rocket_stm32_valid_frame_decodes() {
        let frame = build_stm32_rocket_frame(125000, 345.67, 18.5, 1, 0x0F, 3);
        let pkt = parse_rocket_frame(&frame).expect("valid STM32 rocket frame decodes");

        assert_eq!(pkt.header, "AA");
        assert_eq!(pkt.timestamp_ms, 125000);
        assert!((pkt.altitude - 345.67).abs() < 0.05);
        assert!((pkt.vertical_velocity - 18.5).abs() < 0.05);
        assert!((pkt.latitude - 38.3687).abs() < 0.0001);
        assert!((pkt.longitude - 34.0370).abs() < 0.0001);
        assert!((pkt.temp - 26.5).abs() < 0.05);
        assert!((pkt.pressure - 950.0).abs() < 0.05);
        assert!((pkt.humidity - 45.0).abs() < 0.05);
        assert!((pkt.roll - 12.5).abs() < 0.05);
        assert!((pkt.pitch - (-4.5)).abs() < 0.05);
        assert!((pkt.yaw - 180.0).abs() < 0.05);
        assert_eq!(pkt.flight_state, FlightState::Powered);
        assert!(!pkt.primary_parachute_deployed);
        assert!(!pkt.secondary_parachute_deployed);
        assert_eq!(pkt.bno_calib, 3);
        assert_eq!(pkt.flags, 0x0F);
    }

    #[test]
    fn rocket_stm32_crc_mismatch_rejected() {
        let mut frame = build_stm32_rocket_frame(125000, 345.67, 18.5, 1, 0x0F, 3);
        // Corrupt a payload byte
        frame[10] ^= 0xFF;
        assert!(matches!(
            parse_rocket_frame(&frame),
            Err(FrameError::CrcMismatch { .. })
        ));
    }

    #[test]
    fn rocket_stm32_too_short_rejected() {
        let frame = build_stm32_rocket_frame(125000, 345.67, 18.5, 1, 0x0F, 3);
        assert_eq!(parse_rocket_frame(&frame[..30]), Err(FrameError::TooShort));
    }

    #[test]
    fn rocket_stm32_flight_states_and_parachutes() {
        // State 0: FS_STANDBY -> Pad
        let f0 = build_stm32_rocket_frame(100, 0.0, 0.0, 0, 0, 0);
        let p0 = parse_rocket_frame(&f0).unwrap();
        assert_eq!(p0.flight_state, FlightState::Pad);
        assert!(!p0.primary_parachute_deployed);
        assert!(!p0.secondary_parachute_deployed);

        // State 1: FS_LAUNCHED, vs > 0 -> Powered
        let f1_pow = build_stm32_rocket_frame(200, 100.0, 25.0, 1, 0, 0);
        let p1_pow = parse_rocket_frame(&f1_pow).unwrap();
        assert_eq!(p1_pow.flight_state, FlightState::Powered);
        assert!(!p1_pow.primary_parachute_deployed);

        // State 1: FS_LAUNCHED, vs <= 0 -> Unpowered
        let f1_unp = build_stm32_rocket_frame(300, 2000.0, -0.5, 1, 0, 0);
        let p1_unp = parse_rocket_frame(&f1_unp).unwrap();
        assert_eq!(p1_unp.flight_state, FlightState::Unpowered);

        // State 2: FS_APOGEE -> PrimaryChute (drogue fired)
        let f2 = build_stm32_rocket_frame(400, 3000.0, -5.0, 2, 0, 0);
        let p2 = parse_rocket_frame(&f2).unwrap();
        assert_eq!(p2.flight_state, FlightState::PrimaryChute);
        assert!(p2.primary_parachute_deployed);
        assert!(!p2.secondary_parachute_deployed);

        // State 3: FS_MAIN -> SecondaryChute (main fired)
        let f3 = build_stm32_rocket_frame(500, 450.0, -8.0, 3, 0, 0);
        let p3 = parse_rocket_frame(&f3).unwrap();
        assert_eq!(p3.flight_state, FlightState::SecondaryChute);
        assert!(p3.primary_parachute_deployed);
        assert!(p3.secondary_parachute_deployed);

        // State 4: FS_LANDED -> Pad / Landed with both chutes open
        let f4 = build_stm32_rocket_frame(600, 0.5, 0.0, 4, 0, 0);
        let p4 = parse_rocket_frame(&f4).unwrap();
        assert!(p4.on_ground);
        assert!(p4.primary_parachute_deployed);
        assert!(p4.secondary_parachute_deployed);
    }
}

