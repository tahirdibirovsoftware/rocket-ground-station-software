//! Serial port reader — byte-level framing and packet extraction.
//!
//! The reader scans an incoming byte stream for start bytes (`0xAA` for rocket,
//! `0xBB` for payload), accumulates the correct number of bytes, validates the
//! checksum, and returns parsed packets.
//!
//! This module provides both:
//! - A synchronous `FrameParser` that works on any `&[u8]` input (testable)
//! - An async `SerialReader` that wraps a real serial port with tokio

use crate::protocol::checksum::validate_checksum;
use crate::protocol::rocket_packet::{
    parse_rocket_packet, RocketPacket,
    ROCKET_PACKET_SIZE, ROCKET_START_BYTE,
};
use crate::protocol::payload_packet::{
    parse_payload_packet, PayloadPacket,
    PAYLOAD_PACKET_SIZE, PAYLOAD_START_BYTE,
};

/// A successfully parsed packet from the serial stream.
#[derive(Debug, Clone)]
pub enum ParsedPacket {
    Rocket(RocketPacket),
    Payload(PayloadPacket),
}

/// Statistics tracked by the frame parser.
#[derive(Debug, Clone, Default)]
pub struct ReaderStats {
    pub rocket_packets: u64,
    pub payload_packets: u64,
    pub checksum_failures: u64,
    pub framing_errors: u64,
    pub bytes_processed: u64,
}

/// State machine for extracting framed packets from a raw byte stream.
///
/// The parser scans for start bytes, accumulates frame data, validates,
/// and emits parsed packets. Handles partial reads and stream corruption
/// gracefully by discarding invalid bytes and re-syncing on the next
/// start byte.
#[derive(Debug)]
pub struct FrameParser {
    /// Internal buffer for accumulating frame bytes.
    buffer: Vec<u8>,
    /// Current state of the parser.
    state: FrameState,
    /// Cumulative statistics.
    pub stats: ReaderStats,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FrameState {
    /// Scanning for a start byte (0xAA or 0xBB).
    Scanning,
    /// Accumulating bytes for an identified frame type.
    Accumulating {
        /// Expected total frame length.
        expected_len: usize,
    },
}

impl FrameParser {
    /// Create a new frame parser.
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(64),
            state: FrameState::Scanning,
            stats: ReaderStats::default(),
        }
    }

    /// Feed raw bytes into the parser and extract any complete packets.
    ///
    /// Returns a vector of successfully parsed packets. Bytes that don't
    /// form valid packets are silently discarded (stats are updated).
    pub fn feed(&mut self, data: &[u8]) -> Vec<ParsedPacket> {
        let mut packets = Vec::new();

        for &byte in data {
            self.stats.bytes_processed += 1;

            match self.state {
                FrameState::Scanning => {
                    match byte {
                        ROCKET_START_BYTE => {
                            self.buffer.clear();
                            self.buffer.push(byte);
                            self.state = FrameState::Accumulating {
                                expected_len: ROCKET_PACKET_SIZE,
                            };
                        }
                        PAYLOAD_START_BYTE => {
                            self.buffer.clear();
                            self.buffer.push(byte);
                            self.state = FrameState::Accumulating {
                                expected_len: PAYLOAD_PACKET_SIZE,
                            };
                        }
                        _ => {
                            // Discard byte, not a start byte
                        }
                    }
                }

                FrameState::Accumulating { expected_len } => {
                    self.buffer.push(byte);

                    if self.buffer.len() == expected_len {
                        // Frame complete — attempt to parse
                        if let Some(pkt) = self.try_parse_frame() {
                            packets.push(pkt);
                        }
                        // Reset to scanning regardless of parse success
                        self.buffer.clear();
                        self.state = FrameState::Scanning;
                    }
                }
            }
        }

        packets
    }

    /// Attempt to parse the current buffer as a valid packet.
    fn try_parse_frame(&mut self) -> Option<ParsedPacket> {
        let data = &self.buffer;

        // First check the checksum before full parsing
        if !validate_checksum(data) {
            self.stats.checksum_failures += 1;
            log::debug!(
                "Checksum failure on frame starting with 0x{:02X} ({} bytes)",
                data[0],
                data.len()
            );
            return None;
        }

        match data[0] {
            ROCKET_START_BYTE => match parse_rocket_packet(data) {
                Ok(pkt) => {
                    self.stats.rocket_packets += 1;
                    Some(ParsedPacket::Rocket(pkt))
                }
                Err(e) => {
                    self.stats.framing_errors += 1;
                    log::debug!("Rocket parse error: {e}");
                    None
                }
            },
            PAYLOAD_START_BYTE => match parse_payload_packet(data) {
                Ok(pkt) => {
                    self.stats.payload_packets += 1;
                    Some(ParsedPacket::Payload(pkt))
                }
                Err(e) => {
                    self.stats.framing_errors += 1;
                    log::debug!("Payload parse error: {e}");
                    None
                }
            },
            _ => {
                self.stats.framing_errors += 1;
                None
            }
        }
    }

    /// Reset the parser state (e.g., after a disconnect).
    pub fn reset(&mut self) {
        self.buffer.clear();
        self.state = FrameState::Scanning;
    }

    /// Reset the parser state and statistics.
    pub fn reset_all(&mut self) {
        self.reset();
        self.stats = ReaderStats::default();
    }
}

impl Default for FrameParser {
    fn default() -> Self {
        Self::new()
    }
}

/// Errors from the serial reader.
#[derive(Debug)]
pub enum SerialReaderError {
    /// Failed to open the serial port.
    OpenError(String),
    /// Error reading from the port.
    ReadError(String),
    /// Port configuration error.
    ConfigError(String),
}

impl std::fmt::Display for SerialReaderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OpenError(msg) => write!(f, "Serial port open error: {msg}"),
            Self::ReadError(msg) => write!(f, "Serial port read error: {msg}"),
            Self::ConfigError(msg) => write!(f, "Serial port config error: {msg}"),
        }
    }
}

impl std::error::Error for SerialReaderError {}

/// Open a serial port with the given configuration.
///
/// Returns a boxed `SerialPort` trait object suitable for reading.
pub fn open_serial_port(
    config: &super::config::SerialPortConfig,
) -> Result<Box<dyn serialport::SerialPort>, SerialReaderError> {
    serialport::new(&config.path, config.baud_rate)
        .timeout(std::time::Duration::from_millis(config.timeout_ms))
        .open()
        .map_err(|e| SerialReaderError::OpenError(format!("{}: {e}", config.path)))
}
