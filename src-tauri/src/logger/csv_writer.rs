//! CSV writer — append-only logging of parsed telemetry packets.
//!
//! Creates timestamped CSV files for each session:
//! - `rocket_avionics_YYYYMMDD_HHMMSS.csv`
//! - `payload_scientific_YYYYMMDD_HHMMSS.csv`
//!
//! Files are flushed after every write to minimize data loss on crash.

use std::fs::{self, File, OpenOptions};
use std::path::PathBuf;

use chrono::Local;

use crate::protocol::rocket_packet::{FlightState, RocketPacket};
use crate::protocol::payload_packet::PayloadPacket;

/// Default log directory (relative to user home).
pub const DEFAULT_LOG_DIR: &str = "azst-logs";

/// Manages CSV file writing for a single telemetry session.
pub struct CsvLogger {
    /// Directory where log files are stored.
    log_dir: PathBuf,
    /// Session timestamp string (YYYYMMDD_HHMMSS).
    session_id: String,
    /// Writer for rocket avionics packets.
    rocket_writer: Option<csv::Writer<File>>,
    /// Writer for payload scientific packets.
    payload_writer: Option<csv::Writer<File>>,
    /// Count of rocket packets written.
    pub rocket_count: u64,
    /// Count of payload packets written.
    pub payload_count: u64,
}

impl CsvLogger {
    /// Create a new CSV logger with the given log directory.
    ///
    /// The directory is created if it doesn't exist.
    /// CSV files are created lazily on first write.
    pub fn new(log_dir: impl Into<PathBuf>) -> std::io::Result<Self> {
        let log_dir = log_dir.into();
        fs::create_dir_all(&log_dir)?;

        let session_id = Local::now().format("%Y%m%d_%H%M%S").to_string();

        Ok(Self {
            log_dir,
            session_id,
            rocket_writer: None,
            payload_writer: None,
            rocket_count: 0,
            payload_count: 0,
        })
    }

    /// Create a new CSV logger with the default log directory (`~/azst-logs/`).
    pub fn with_default_dir() -> std::io::Result<Self> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let log_dir = PathBuf::from(home).join(DEFAULT_LOG_DIR);
        Self::new(log_dir)
    }

    /// Create a logger with a specific session ID (useful for testing).
    pub fn with_session_id(
        log_dir: impl Into<PathBuf>,
        session_id: impl Into<String>,
    ) -> std::io::Result<Self> {
        let log_dir = log_dir.into();
        fs::create_dir_all(&log_dir)?;

        Ok(Self {
            log_dir,
            session_id: session_id.into(),
            rocket_writer: None,
            payload_writer: None,
            rocket_count: 0,
            payload_count: 0,
        })
    }

    /// Write a rocket avionics packet to the CSV file.
    pub fn write_rocket(&mut self, packet: &RocketPacket) -> std::io::Result<()> {
        let writer = self.get_or_create_rocket_writer()?;

        writer
            .write_record(&[
                packet.timestamp_ms.to_string(),
                format!("{:.4}", packet.altitude),
                format!("{:.6}", packet.latitude),
                format!("{:.6}", packet.longitude),
                format!("{:.2}", packet.pressure1),
                format!("{:.2}", packet.pressure2),
                format!("{:.2}", packet.velocity),
                flight_state_to_str(packet.flight_state),
                (packet.primary_parachute_deployed as u8).to_string(),
                (packet.secondary_parachute_deployed as u8).to_string(),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        writer
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        self.rocket_count += 1;
        Ok(())
    }

    /// Write a payload scientific packet to the CSV file.
    pub fn write_payload(&mut self, packet: &PayloadPacket) -> std::io::Result<()> {
        let writer = self.get_or_create_payload_writer()?;

        writer
            .write_record(&[
                packet.timestamp_ms.to_string(),
                format!("{:.6}", packet.latitude),
                format!("{:.6}", packet.longitude),
                format!("{:.4}", packet.altitude),
                format!("{:.4}", packet.scientific_data),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        writer
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        self.payload_count += 1;
        Ok(())
    }

    /// Get the path to the rocket CSV file.
    pub fn rocket_file_path(&self) -> PathBuf {
        self.log_dir
            .join(format!("rocket_avionics_{}.csv", self.session_id))
    }

    /// Get the path to the payload CSV file.
    pub fn payload_file_path(&self) -> PathBuf {
        self.log_dir
            .join(format!("payload_scientific_{}.csv", self.session_id))
    }

    /// Get or lazily create the rocket CSV writer with headers.
    fn get_or_create_rocket_writer(&mut self) -> std::io::Result<&mut csv::Writer<File>> {
        if self.rocket_writer.is_none() {
            let path = self.rocket_file_path();
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)?;

            let mut writer = csv::Writer::from_writer(file);

            // Write header if file is new (empty)
            if fs::metadata(&path)?.len() == 0 {
                writer
                    .write_record(&[
                        "timestamp_ms",
                        "altitude_m",
                        "latitude",
                        "longitude",
                        "pressure1_hpa",
                        "pressure2_hpa",
                        "velocity_ms",
                        "flight_state",
                        "primary_parachute",
                        "secondary_parachute",
                    ])
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                writer
                    .flush()
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            }

            self.rocket_writer = Some(writer);
        }

        Ok(self.rocket_writer.as_mut().unwrap())
    }

    /// Get or lazily create the payload CSV writer with headers.
    fn get_or_create_payload_writer(&mut self) -> std::io::Result<&mut csv::Writer<File>> {
        if self.payload_writer.is_none() {
            let path = self.payload_file_path();
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)?;

            let mut writer = csv::Writer::from_writer(file);

            if fs::metadata(&path)?.len() == 0 {
                writer
                    .write_record(&[
                        "timestamp_ms",
                        "latitude",
                        "longitude",
                        "altitude_m",
                        "scientific_data",
                    ])
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                writer
                    .flush()
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            }

            self.payload_writer = Some(writer);
        }

        Ok(self.payload_writer.as_mut().unwrap())
    }
}

/// Convert a FlightState to a string for CSV output.
fn flight_state_to_str(state: FlightState) -> String {
    match state {
        FlightState::Pad => "pad".to_string(),
        FlightState::Powered => "powered".to_string(),
        FlightState::Unpowered => "unpowered".to_string(),
        FlightState::Apogee => "apogee".to_string(),
        FlightState::PrimaryChute => "primary_chute".to_string(),
        FlightState::SecondaryChute => "secondary_chute".to_string(),
    }
}
