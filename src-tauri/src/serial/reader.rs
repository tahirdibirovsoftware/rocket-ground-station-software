//! Serial port reader — byte-level framing and packet extraction.
//!
//! The reader scans an incoming byte stream for line endings ('\n'),
//! extracts lines starting with "AA,", "BB,", or "CC,", parses them as CSV,
//! and runs a flight state estimator on the Rocket ("AA") packets.

use crate::protocol::telemetry_packet::TelemetryPacket;
use crate::protocol::rocket_packet::FlightState;

/// A successfully parsed packet from the serial stream.
#[derive(Debug, Clone)]
pub enum ParsedPacket {
    Rocket(TelemetryPacket),
    Payload(TelemetryPacket),
    Drone(TelemetryPacket),
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
}

/// State machine for extracting framed CSV packets from a raw byte stream.
#[derive(Debug)]
pub struct FrameParser {
    /// Internal buffer for accumulating line bytes.
    buffer: Vec<u8>,
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

        packets
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
