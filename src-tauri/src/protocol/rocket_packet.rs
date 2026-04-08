//! Rocket Avionics Packet — 36-byte binary parser.
//!
//! Wire format (little-endian):
//! ```text
//! Offset  Size  Type   Field
//! ------  ----  ----   -----
//! 0       1     u8     Start Byte (0xAA)
//! 1       1     u8     Packet ID (0x01)
//! 2-5     4     u32    Timestamp (ms)
//! 6-9     4     f32    Altitude (m)
//! 10-13   4     f32    Latitude
//! 14-17   4     f32    Longitude
//! 18-21   4     f32    Pressure 1 (hPa)
//! 22-25   4     f32    Pressure 2 (hPa)
//! 26-29   4     f32    Velocity (m/s)
//! 30      1     u8     Flight State (0-5)
//! 31      1     u8     Primary Parachute Deployed (0/1)
//! 32      1     u8     Secondary Parachute Deployed (0/1)
//! 33-34   2     -      Reserved/Padding
//! 35      1     u8     Checksum (XOR of bytes 1-34)
//! ```

use serde::{Deserialize, Serialize};

use super::checksum;

/// Total size of a Rocket Avionics packet in bytes.
pub const ROCKET_PACKET_SIZE: usize = 36;

/// Start byte that identifies a Rocket Avionics packet.
pub const ROCKET_START_BYTE: u8 = 0xAA;

/// Packet ID for Rocket Avionics.
pub const ROCKET_PACKET_ID: u8 = 0x01;

/// Flight phases of the rocket, matching the on-board avionics state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlightState {
    Pad = 0,
    Powered = 1,
    Unpowered = 2,
    Apogee = 3,
    PrimaryChute = 4,
    SecondaryChute = 5,
}

impl FlightState {
    /// Convert a raw u8 value to a `FlightState`.
    /// Returns `None` for values outside the 0-5 range.
    pub fn from_u8(value: u8) -> Option<FlightState> {
        match value {
            0 => Some(FlightState::Pad),
            1 => Some(FlightState::Powered),
            2 => Some(FlightState::Unpowered),
            3 => Some(FlightState::Apogee),
            4 => Some(FlightState::PrimaryChute),
            5 => Some(FlightState::SecondaryChute),
            _ => None,
        }
    }
}

/// Parsed Rocket Avionics telemetry packet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RocketPacket {
    pub packet_id: u8,
    pub timestamp_ms: u32,
    pub altitude: f32,
    pub latitude: f32,
    pub longitude: f32,
    pub pressure1: f32,
    pub pressure2: f32,
    pub velocity: f32,
    pub flight_state: FlightState,
    pub primary_parachute_deployed: bool,
    pub secondary_parachute_deployed: bool,
}

/// Errors that can occur when parsing a rocket packet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RocketParseError {
    /// Buffer is not exactly 36 bytes.
    InvalidLength(usize),
    /// First byte is not 0xAA.
    InvalidStartByte(u8),
    /// Packet ID is not 0x01.
    InvalidPacketId(u8),
    /// XOR checksum mismatch.
    ChecksumMismatch { expected: u8, actual: u8 },
    /// Flight state byte is outside the 0-5 range.
    InvalidFlightState(u8),
}

impl std::fmt::Display for RocketParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidLength(len) => {
                write!(f, "Invalid packet length: expected {ROCKET_PACKET_SIZE}, got {len}")
            }
            Self::InvalidStartByte(b) => {
                write!(f, "Invalid start byte: expected 0x{ROCKET_START_BYTE:02X}, got 0x{b:02X}")
            }
            Self::InvalidPacketId(id) => {
                write!(f, "Invalid packet ID: expected 0x{ROCKET_PACKET_ID:02X}, got 0x{id:02X}")
            }
            Self::ChecksumMismatch { expected, actual } => {
                write!(
                    f,
                    "Checksum mismatch: expected 0x{expected:02X}, got 0x{actual:02X}"
                )
            }
            Self::InvalidFlightState(s) => {
                write!(f, "Invalid flight state: {s} (valid range 0-5)")
            }
        }
    }
}

impl std::error::Error for RocketParseError {}

/// Parse a 36-byte buffer into a `RocketPacket`.
///
/// Validates:
/// 1. Length == 36
/// 2. Start byte == 0xAA
/// 3. Packet ID == 0x01
/// 4. XOR checksum
/// 5. Flight state in range 0-5
pub fn parse_rocket_packet(data: &[u8]) -> Result<RocketPacket, RocketParseError> {
    // 1. Validate length
    if data.len() != ROCKET_PACKET_SIZE {
        return Err(RocketParseError::InvalidLength(data.len()));
    }

    // 2. Validate start byte
    if data[0] != ROCKET_START_BYTE {
        return Err(RocketParseError::InvalidStartByte(data[0]));
    }

    // 3. Validate packet ID
    if data[1] != ROCKET_PACKET_ID {
        return Err(RocketParseError::InvalidPacketId(data[1]));
    }

    // 4. Validate checksum
    let expected_checksum = checksum::compute_xor_checksum(data);
    let actual_checksum = data[35];
    if expected_checksum != actual_checksum {
        return Err(RocketParseError::ChecksumMismatch {
            expected: expected_checksum,
            actual: actual_checksum,
        });
    }

    // 5. Validate and parse flight state
    let flight_state_raw = data[30];
    let flight_state = FlightState::from_u8(flight_state_raw)
        .ok_or(RocketParseError::InvalidFlightState(flight_state_raw))?;

    // Extract fields (little-endian)
    let packet_id = data[1];
    let timestamp_ms = u32::from_le_bytes([data[2], data[3], data[4], data[5]]);
    let altitude = f32::from_le_bytes([data[6], data[7], data[8], data[9]]);
    let latitude = f32::from_le_bytes([data[10], data[11], data[12], data[13]]);
    let longitude = f32::from_le_bytes([data[14], data[15], data[16], data[17]]);
    let pressure1 = f32::from_le_bytes([data[18], data[19], data[20], data[21]]);
    let pressure2 = f32::from_le_bytes([data[22], data[23], data[24], data[25]]);
    let velocity = f32::from_le_bytes([data[26], data[27], data[28], data[29]]);
    let primary_parachute_deployed = data[31] != 0;
    let secondary_parachute_deployed = data[32] != 0;

    Ok(RocketPacket {
        packet_id,
        timestamp_ms,
        altitude,
        latitude,
        longitude,
        pressure1,
        pressure2,
        velocity,
        flight_state,
        primary_parachute_deployed,
        secondary_parachute_deployed,
    })
}

/// Build a valid 36-byte Rocket Avionics packet from a `RocketPacket`.
/// Useful for testing and mock data generation.
pub fn build_rocket_packet(packet: &RocketPacket) -> [u8; ROCKET_PACKET_SIZE] {
    let mut buf = [0u8; ROCKET_PACKET_SIZE];

    buf[0] = ROCKET_START_BYTE;
    buf[1] = packet.packet_id;
    buf[2..6].copy_from_slice(&packet.timestamp_ms.to_le_bytes());
    buf[6..10].copy_from_slice(&packet.altitude.to_le_bytes());
    buf[10..14].copy_from_slice(&packet.latitude.to_le_bytes());
    buf[14..18].copy_from_slice(&packet.longitude.to_le_bytes());
    buf[18..22].copy_from_slice(&packet.pressure1.to_le_bytes());
    buf[22..26].copy_from_slice(&packet.pressure2.to_le_bytes());
    buf[26..30].copy_from_slice(&packet.velocity.to_le_bytes());
    buf[30] = packet.flight_state as u8;
    buf[31] = packet.primary_parachute_deployed as u8;
    buf[32] = packet.secondary_parachute_deployed as u8;
    // bytes 33-34 are reserved padding (zeroed)

    // Stamp the checksum
    checksum::stamp_checksum(&mut buf);

    buf
}
