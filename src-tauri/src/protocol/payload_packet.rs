//! Payload Scientific Packet — 24-byte binary parser.
//!
//! Wire format (little-endian):
//! ```text
//! Offset  Size  Type   Field
//! ------  ----  ----   -----
//! 0       1     u8     Start Byte (0xBB)
//! 1       1     u8     Packet ID (0x02)
//! 2-5     4     u32    Timestamp (ms)
//! 6-9     4     f32    Payload Latitude
//! 10-13   4     f32    Payload Longitude
//! 14-17   4     f32    Payload Altitude (m)
//! 18-21   4     f32    Scientific Sensor Data
//! 22      1     -      Reserved/Padding
//! 23      1     u8     Checksum (XOR of bytes 1-22)
//! ```

use serde::{Deserialize, Serialize};

use super::checksum;

/// Total size of a Payload Scientific packet in bytes.
pub const PAYLOAD_PACKET_SIZE: usize = 24;

/// Start byte that identifies a Payload Scientific packet.
pub const PAYLOAD_START_BYTE: u8 = 0xBB;

/// Packet ID for Payload Scientific.
pub const PAYLOAD_PACKET_ID: u8 = 0x02;

/// Parsed Payload Scientific telemetry packet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PayloadPacket {
    pub packet_id: u8,
    pub timestamp_ms: u32,
    pub latitude: f32,
    pub longitude: f32,
    pub altitude: f32,
    pub scientific_data: f32,
}

/// Errors that can occur when parsing a payload packet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PayloadParseError {
    /// Buffer is not exactly 24 bytes.
    InvalidLength(usize),
    /// First byte is not 0xBB.
    InvalidStartByte(u8),
    /// Packet ID is not 0x02.
    InvalidPacketId(u8),
    /// XOR checksum mismatch.
    ChecksumMismatch { expected: u8, actual: u8 },
}

impl std::fmt::Display for PayloadParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidLength(len) => {
                write!(f, "Invalid packet length: expected {PAYLOAD_PACKET_SIZE}, got {len}")
            }
            Self::InvalidStartByte(b) => {
                write!(f, "Invalid start byte: expected 0x{PAYLOAD_START_BYTE:02X}, got 0x{b:02X}")
            }
            Self::InvalidPacketId(id) => {
                write!(f, "Invalid packet ID: expected 0x{PAYLOAD_PACKET_ID:02X}, got 0x{id:02X}")
            }
            Self::ChecksumMismatch { expected, actual } => {
                write!(
                    f,
                    "Checksum mismatch: expected 0x{expected:02X}, got 0x{actual:02X}"
                )
            }
        }
    }
}

impl std::error::Error for PayloadParseError {}

/// Parse a 24-byte buffer into a `PayloadPacket`.
///
/// Validates:
/// 1. Length == 24
/// 2. Start byte == 0xBB
/// 3. Packet ID == 0x02
/// 4. XOR checksum
pub fn parse_payload_packet(data: &[u8]) -> Result<PayloadPacket, PayloadParseError> {
    // 1. Validate length
    if data.len() != PAYLOAD_PACKET_SIZE {
        return Err(PayloadParseError::InvalidLength(data.len()));
    }

    // 2. Validate start byte
    if data[0] != PAYLOAD_START_BYTE {
        return Err(PayloadParseError::InvalidStartByte(data[0]));
    }

    // 3. Validate packet ID
    if data[1] != PAYLOAD_PACKET_ID {
        return Err(PayloadParseError::InvalidPacketId(data[1]));
    }

    // 4. Validate checksum
    let expected_checksum = checksum::compute_xor_checksum(data);
    let actual_checksum = data[23];
    if expected_checksum != actual_checksum {
        return Err(PayloadParseError::ChecksumMismatch {
            expected: expected_checksum,
            actual: actual_checksum,
        });
    }

    // Extract fields (little-endian)
    let packet_id = data[1];
    let timestamp_ms = u32::from_le_bytes([data[2], data[3], data[4], data[5]]);
    let latitude = f32::from_le_bytes([data[6], data[7], data[8], data[9]]);
    let longitude = f32::from_le_bytes([data[10], data[11], data[12], data[13]]);
    let altitude = f32::from_le_bytes([data[14], data[15], data[16], data[17]]);
    let scientific_data = f32::from_le_bytes([data[18], data[19], data[20], data[21]]);

    Ok(PayloadPacket {
        packet_id,
        timestamp_ms,
        latitude,
        longitude,
        altitude,
        scientific_data,
    })
}

/// Build a valid 24-byte Payload Scientific packet from a `PayloadPacket`.
/// Useful for testing and mock data generation.
pub fn build_payload_packet(packet: &PayloadPacket) -> [u8; PAYLOAD_PACKET_SIZE] {
    let mut buf = [0u8; PAYLOAD_PACKET_SIZE];

    buf[0] = PAYLOAD_START_BYTE;
    buf[1] = packet.packet_id;
    buf[2..6].copy_from_slice(&packet.timestamp_ms.to_le_bytes());
    buf[6..10].copy_from_slice(&packet.latitude.to_le_bytes());
    buf[10..14].copy_from_slice(&packet.longitude.to_le_bytes());
    buf[14..18].copy_from_slice(&packet.altitude.to_le_bytes());
    buf[18..22].copy_from_slice(&packet.scientific_data.to_le_bytes());
    // byte 22 is reserved padding (zeroed)

    // Stamp the checksum
    checksum::stamp_checksum(&mut buf);

    buf
}
