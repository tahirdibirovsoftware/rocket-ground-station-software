//! Serial port reader — byte-level framing and packet extraction.
//!
//! The reader supports two coexisting protocols on the same RF stream:
//! - Legacy ASCII CSV lines starting with "AA,", "BB," or "CC," terminated by '\n'
//! - New binary frames: `AA 55 <12-byte header> <payload> <crc16>` (see
//!   `crate::protocol::binary_packet`)
//!
//! Bare "1"/"0" lines are treated as uplink command ACKs / payload
//! sky-landed status. Rocket ("AA") packets run a flight state estimator.

use crate::protocol::binary_packet::{
    self, DEVICE_DRONE, DEVICE_PAYLOAD, MAX_FRAME_SIZE, PKT_STATUS, PKT_TELEMETRY,
    ROCKET_FRAME_SIZE, ROCKET_PAYLOAD_LEN, ROCKET_TYPE_TELEM, SYNC1, SYNC2,
};
use crate::protocol::telemetry_packet::TelemetryPacket;
use crate::protocol::rocket_packet::FlightState;

/// A successfully parsed packet from the serial stream.
#[derive(Debug, Clone)]
pub enum ParsedPacket {
    Rocket(TelemetryPacket),
    Payload(TelemetryPacket),
    Drone(TelemetryPacket),
    /// Payload status event (binary RF_PKT_STATUS): on_ground flag + flight phase + outputs_active.
    PayloadStatus {
        on_ground: bool,
        flight_phase: u8,
        outputs_active: bool,
    },
    /// Drone status event (binary RF_PKT_STATUS): state code, throttle, armed flag.
    DroneStatus {
        state_code: u8,
        throttle_us: u16,
        armed: bool,
    },
}

/// Statistics tracked by the frame parser.
#[derive(Debug, Clone, Default)]
pub struct ReaderStats {
    pub rocket_packets: u64,
    pub payload_packets: u64,
    pub drone_packets: u64,
    pub checksum_failures: u64,
    pub framing_errors: u64,
    pub bytes_processed: u64,
    /// Count of drone uplink command ACKs received ("1" / "0" lines).
    pub uplink_acks: u64,
    /// Last drone uplink ACK value (Some(true) = ARMed, Some(false) = DISARMed).
    pub last_uplink_ack: Option<bool>,
}

/// State machine for extracting framed packets from a raw byte stream.
#[derive(Debug)]
pub struct FrameParser {
    /// Internal buffer for accumulating line bytes.
    buffer: Vec<u8>,
    /// Buffer for accumulating a binary frame.
    bin_buf: Vec<u8>,
    /// Expected total binary frame length once the header is known.
    bin_expected: Option<usize>,
    /// Cumulative statistics.
    pub stats: ReaderStats,

    // Flight State Estimator State
    max_altitude: f32,
    last_altitude: f32,
    last_timestamp_ms: u32,
    current_flight_state: FlightState,
    primary_parachute_deployed: bool,
    secondary_parachute_deployed: bool,
}

impl FrameParser {
    /// Create a new frame parser.
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(256),
            bin_buf: Vec::with_capacity(MAX_FRAME_SIZE),
            bin_expected: None,
            stats: ReaderStats::default(),
            max_altitude: 0.0,
            last_altitude: 0.0,
            last_timestamp_ms: 0,
            current_flight_state: FlightState::Pad,
            primary_parachute_deployed: false,
            secondary_parachute_deployed: false,
        }
    }

    /// Feed raw bytes into the parser and extract any complete packets.
    pub fn feed(&mut self, data: &[u8]) -> Vec<ParsedPacket> {
        let mut packets = Vec::new();

        for &byte in data {
            self.stats.bytes_processed += 1;

            if !self.bin_buf.is_empty() || byte == SYNC1 {
                self.feed_binary_byte(byte, &mut packets);
            } else {
                self.feed_line_byte(byte, &mut packets);
            }
        }

        packets
    }

    /// Process a byte for the binary frame state machine.
    fn feed_binary_byte(&mut self, byte: u8, packets: &mut Vec<ParsedPacket>) {
        if self.bin_buf.is_empty() {
            // Only enter binary mode on the sync byte
            if byte != SYNC1 {
                self.feed_line_byte(byte, packets);
                return;
            }
            self.bin_buf.push(byte);
            return;
        }

        self.bin_buf.push(byte);

        // Validate the second sync byte
        if self.bin_buf.len() == 2 && self.bin_buf[1] != SYNC2 {
            // Not a binary frame — replay the buffered bytes as line bytes
            let stray = std::mem::take(&mut self.bin_buf);
            self.bin_expected = None;
            for b in stray {
                self.feed_line_byte(b, packets);
            }
            return;
        }

        // Compute the expected total length based on frame type
        if self.bin_expected.is_none() {
            if self.bin_buf.len() >= 4
                && self.bin_buf[2] == ROCKET_TYPE_TELEM
                && self.bin_buf[3] == ROCKET_PAYLOAD_LEN as u8
            {
                // STM32 Rocket Frame: [0xAA, 0x55, 0x01, 55, ... 55 payload ..., crc16] = 61 bytes
                self.bin_expected = Some(ROCKET_FRAME_SIZE);
            } else if self.bin_buf.len() >= 12 {
                // Teensy Frame: [0xAA, 0x55, proto, device_id, type, seq (2), ms (4), payload_len, ...]
                let payload_len = self.bin_buf[11] as usize;
                let total = 12 + payload_len + 2;
                if total > MAX_FRAME_SIZE {
                    // Corrupt length field — drop and resync
                    self.bin_buf.clear();
                    self.bin_expected = None;
                    self.stats.framing_errors += 1;
                    return;
                }
                self.bin_expected = Some(total);
            }
        }

        // Wait for a complete frame
        if let Some(expected) = self.bin_expected {
            if self.bin_buf.len() >= expected {
                let frame_bytes = std::mem::take(&mut self.bin_buf);
                self.bin_expected = None;
                self.handle_binary_frame(&frame_bytes, packets);
            }
        }
    }

    /// Parse a complete binary frame and emit derived packets.
    fn handle_binary_frame(&mut self, bytes: &[u8], packets: &mut Vec<ParsedPacket>) {
        if bytes.len() == ROCKET_FRAME_SIZE
            && bytes[0] == SYNC1
            && bytes[1] == SYNC2
            && bytes[2] == ROCKET_TYPE_TELEM
            && bytes[3] == ROCKET_PAYLOAD_LEN as u8
        {
            match binary_packet::parse_rocket_frame(bytes) {
                Ok(rkt) => {
                    self.stats.rocket_packets += 1;
                    packets.push(ParsedPacket::Rocket(rkt));
                }
                Err(binary_packet::FrameError::CrcMismatch { .. }) => {
                    self.stats.checksum_failures += 1;
                }
                Err(_) => {
                    self.stats.framing_errors += 1;
                }
            }
            return;
        }

        match binary_packet::parse_frame(bytes) {
            Ok(frame) => match frame.packet_type {
                PKT_TELEMETRY => {
                    let pkt = binary_packet::parse_telemetry_payload(
                        frame.device_id,
                        frame.timestamp_ms,
                        &frame.payload,
                    );
                    match (frame.device_id, pkt) {
                        (DEVICE_PAYLOAD, Some(pkt)) => {
                            self.stats.payload_packets += 1;
                            packets.push(ParsedPacket::Payload(pkt));
                        }
                        (DEVICE_DRONE, Some(pkt)) => {
                            self.stats.drone_packets += 1;
                            packets.push(ParsedPacket::Drone(pkt));
                        }
                        _ => {
                            self.stats.framing_errors += 1;
                        }
                    }
                }
                PKT_STATUS => match frame.device_id {
                    DEVICE_PAYLOAD => {
                        if let Some((on_ground, flight_phase, outputs_active)) =
                            binary_packet::parse_payload_status_payload(&frame.payload)
                        {
                            packets.push(ParsedPacket::PayloadStatus {
                                on_ground,
                                flight_phase,
                                outputs_active,
                            });
                        }
                    }
                    DEVICE_DRONE => {
                        if let Some((state_code, throttle_us, armed)) =
                            binary_packet::parse_drone_status_payload(&frame.payload)
                        {
                            packets.push(ParsedPacket::DroneStatus {
                                state_code,
                                throttle_us,
                                armed,
                            });
                        }
                    }
                    _ => {
                        self.stats.framing_errors += 1;
                    }
                },
                _ => {
                    self.stats.framing_errors += 1;
                }
            },
            Err(binary_packet::FrameError::CrcMismatch { .. }) => {
                self.stats.checksum_failures += 1;
            }
            Err(_) => {
                self.stats.framing_errors += 1;
            }
        }
    }

    /// Process a byte for the ASCII line protocol.
    fn feed_line_byte(&mut self, byte: u8, packets: &mut Vec<ParsedPacket>) {
        if byte == b'\n' {
            let mut start_idx = None;
            for header in &[b"AA,", b"BB,", b"CC,"] {
                if let Some(pos) = self.buffer.windows(3).position(|w| w == *header) {
                    if start_idx.is_none() || pos < start_idx.unwrap() {
                        start_idx = Some(pos);
                    }
                }
            }

            if let Some(idx) = start_idx {
                if let Ok(line_str) = std::str::from_utf8(&self.buffer[idx..]) {
                    let line_owned = line_str.to_string();
                    if let Some(pkt) = self.parse_line(&line_owned) {
                        packets.push(pkt);
                    }
                }
            } else {
                // Uplink command ACKs:
                // - drone (binary firmware): "ACK_ARM" / "ACK_DISARM" lines
                // - payload (CSV firmware): bare "1" (landed/ARM) / "0" (sky/DISARM) lines
                let line = std::str::from_utf8(&self.buffer).unwrap_or("");
                let trimmed = line.trim();
                if trimmed == "ACK_ARM" {
                    self.stats.uplink_acks += 1;
                    self.stats.last_uplink_ack = Some(true);
                } else if trimmed == "ACK_DISARM" {
                    self.stats.uplink_acks += 1;
                    self.stats.last_uplink_ack = Some(false);
                } else if self.buffer.len() <= 3 && (trimmed == "1" || trimmed == "0") {
                    self.stats.uplink_acks += 1;
                    self.stats.last_uplink_ack = Some(trimmed == "1");
                }
            }
            self.buffer.clear();
        } else {
            // Prevent buffer from growing indefinitely on raw garbage streams
            if self.buffer.len() < 1024 {
                self.buffer.push(byte);
            } else {
                self.buffer.clear();
                self.stats.framing_errors += 1;
            }
        }
    }

    /// Attempt to parse a line and identify the packet.
    fn parse_line(&mut self, line: &str) -> Option<ParsedPacket> {
        // Find the start of our headers in case there is garbage before it
        let mut start_idx = None;
        for header in &["AA,", "BB,", "CC,"] {
            if let Some(pos) = line.find(header) {
                if start_idx.is_none() || pos < start_idx.unwrap() {
                    start_idx = Some(pos);
                }
            }
        }

        let clean_line = match start_idx {
            Some(idx) => &line[idx..],
            None => return None,
        };

        if let Some(mut packet) = TelemetryPacket::parse(clean_line) {
            match packet.header.as_str() {
                "AA" => {
                    self.estimate_rocket_state(&mut packet);
                    self.stats.rocket_packets += 1;
                    Some(ParsedPacket::Rocket(packet))
                }
                "BB" => {
                    self.stats.payload_packets += 1;
                    Some(ParsedPacket::Payload(packet))
                }
                "CC" => {
                    self.stats.drone_packets += 1;
                    Some(ParsedPacket::Drone(packet))
                }
                _ => {
                    self.stats.framing_errors += 1;
                    None
                }
            }
        } else {
            self.stats.framing_errors += 1;
            None
        }
    }

    /// Estimate the rocket flight phase and barometric vertical velocity.
    fn estimate_rocket_state(&mut self, packet: &mut TelemetryPacket) {
        let alt = packet.altitude;

        // 0. Fallback: Compute barometric vertical velocity (dh/dt) if gps_speed is zero
        if packet.gps_speed.abs() < 0.001 && self.last_timestamp_ms > 0 && packet.timestamp_ms > self.last_timestamp_ms {
            let dt = (packet.timestamp_ms - self.last_timestamp_ms) as f32 / 1000.0;
            if dt > 0.01 {
                let inst_v = (alt - self.last_altitude) / dt;
                // On pad (FlightState::Pad), filter out sensor 0.1m quantization noise (+/- 1.5 m/s)
                let smoothed_v = if self.current_flight_state == FlightState::Pad && inst_v.abs() <= 2.0 {
                    0.0
                } else {
                    (inst_v * 10.0).round() / 10.0
                };
                packet.gps_speed = smoothed_v;
            }
        }
        self.last_timestamp_ms = packet.timestamp_ms;

        // 1. Ground Hysteresis Safeguard for Bench Testing:
        // If altitude is near ground level (< 5.0 m) AND max historical altitude was low (< 50.0 m),
        // force state back to Pad so bench testing noise spikes never trap the state machine.
        if alt < 5.0 && self.max_altitude < 50.0 {
            self.current_flight_state = FlightState::Pad;
            self.primary_parachute_deployed = false;
            self.secondary_parachute_deployed = false;
        } else if alt > self.max_altitude {
            self.max_altitude = alt;
        }

        // 2. State transition logic
        match self.current_flight_state {
            FlightState::Pad => {
                if alt > 25.0 {
                    self.current_flight_state = FlightState::Powered;
                }
            }
            FlightState::Powered => {
                if alt >= 1800.0 {
                    self.current_flight_state = FlightState::Unpowered;
                }
            }
            FlightState::Unpowered => {
                if self.max_altitude > 250.0 && alt < self.max_altitude - 10.0 {
                    self.current_flight_state = FlightState::Apogee;
                }
            }
            FlightState::Apogee => {
                self.current_flight_state = FlightState::PrimaryChute;
                self.primary_parachute_deployed = true;
            }
            FlightState::PrimaryChute => {
                if alt <= 1700.0 {
                    self.current_flight_state = FlightState::SecondaryChute;
                    self.secondary_parachute_deployed = true;
                }
            }
            FlightState::SecondaryChute => {
                // Remains landed
            }
        }

        // Apply estimated states to the packet
        packet.flight_state = self.current_flight_state;
        packet.primary_parachute_deployed = self.primary_parachute_deployed;
        packet.secondary_parachute_deployed = self.secondary_parachute_deployed;

        self.last_altitude = alt;
    }

    /// Reset the parser state.
    pub fn reset(&mut self) {
        self.buffer.clear();
        self.bin_buf.clear();
        self.bin_expected = None;
        self.max_altitude = 0.0;
        self.last_altitude = 0.0;
        self.last_timestamp_ms = 0;
        self.current_flight_state = FlightState::Pad;
        self.primary_parachute_deployed = false;
        self.secondary_parachute_deployed = false;
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
pub fn open_serial_port(
    config: &super::config::SerialPortConfig,
) -> Result<Box<dyn serialport::SerialPort>, SerialReaderError> {
    serialport::new(&config.path, config.baud_rate)
        .timeout(std::time::Duration::from_millis(config.timeout_ms))
        .open()
        .map_err(|e| SerialReaderError::OpenError(format!("{}: {e}", config.path)))
}
