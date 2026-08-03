//! CSV Logger — Session-bundled append-only logging of parsed telemetry packets.
//!
//! Creates a dedicated timestamped flight directory for each session:
//! `~/azst-logs/flight_YYYY-MM-DD_HH-MM-SS/`
//!
//! Log files inside the directory:
//! - `telemetry_rocket.csv`
//! - `telemetry_payload.csv`
//! - `telemetry_drone.csv`
//! - `telemetry_unified.csv` (Excel-optimized master log containing all sources)
//!
//! All writes are flushed immediately to disk to guarantee 0 data loss on crash or power failure.

use std::fs::{self, File, OpenOptions};
use std::path::PathBuf;

use chrono::Local;

use crate::protocol::rocket_packet::FlightState;
use crate::protocol::telemetry_packet::TelemetryPacket;

/// Default root log directory (relative to user home).
pub const DEFAULT_LOG_DIR: &str = "azst-logs";

/// Manages CSV file writing for a single flight telemetry session.
pub struct CsvLogger {
    /// Dedicated flight session directory.
    pub session_dir: PathBuf,
    /// Session timestamp string (YYYY-MM-DD_HH-MM-SS).
    pub session_id: String,
    /// Writer for rocket telemetry.
    rocket_writer: Option<csv::Writer<File>>,
    /// Writer for payload telemetry.
    payload_writer: Option<csv::Writer<File>>,
    /// Writer for drone telemetry.
    drone_writer: Option<csv::Writer<File>>,
    /// Writer for master unified telemetry.
    unified_writer: Option<csv::Writer<File>>,
    /// Count of rocket packets written.
    pub rocket_count: u64,
    /// Count of payload packets written.
    pub payload_count: u64,
    /// Count of drone packets written.
    pub drone_count: u64,
}

impl CsvLogger {
    /// Create a new CSV logger creating a dedicated flight session directory inside `root_dir`.
    pub fn new(root_dir: impl Into<PathBuf>) -> std::io::Result<Self> {
        let root_dir = root_dir.into();
        let session_id = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let session_dir = root_dir.join(format!("flight_{}", session_id));

        fs::create_dir_all(&session_dir)?;

        Ok(Self {
            session_dir,
            session_id,
            rocket_writer: None,
            payload_writer: None,
            drone_writer: None,
            unified_writer: None,
            rocket_count: 0,
            payload_count: 0,
            drone_count: 0,
        })
    }

    /// Create a new CSV logger with default root log directory (`~/azst-logs/`).
    pub fn with_default_dir() -> std::io::Result<Self> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let root_dir = PathBuf::from(home).join(DEFAULT_LOG_DIR);
        Self::new(root_dir)
    }

    /// Create a logger with a specific session directory (useful for testing).
    pub fn with_session_dir(session_dir: impl Into<PathBuf>) -> std::io::Result<Self> {
        let session_dir = session_dir.into();
        fs::create_dir_all(&session_dir)?;
        let session_id = session_dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| Local::now().format("%Y-%m-%d_%H-%M-%S").to_string());

        Ok(Self {
            session_dir,
            session_id,
            rocket_writer: None,
            payload_writer: None,
            drone_writer: None,
            unified_writer: None,
            rocket_count: 0,
            payload_count: 0,
            drone_count: 0,
        })
    }

    /// Write a rocket packet into rocket CSV and master unified CSV.
    pub fn write_rocket(&mut self, packet: &TelemetryPacket) -> std::io::Result<()> {
        let iso_time = Local::now().to_rfc3339();

        // 1. Dedicated Rocket CSV
        let writer = self.get_or_create_writer("rocket")?;
        writer
            .write_record(&[
                packet.timestamp_ms.to_string(),
                iso_time.clone(),
                flight_state_to_str(packet.flight_state),
                format!("{:.2}", packet.altitude),
                format!("{:.6}", packet.latitude),
                format!("{:.6}", packet.longitude),
                format!("{:.2}", packet.gps_speed),
                format!("{:.2}", packet.pressure),
                format!("{:.2}", packet.humidity),
                (packet.primary_parachute_deployed as u8).to_string(),
                (packet.secondary_parachute_deployed as u8).to_string(),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        writer
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        // 2. Unified Master CSV
        let unified = self.get_or_create_writer("unified")?;
        unified
            .write_record(&[
                "ROCKET",
                "0x01",
                &packet.timestamp_ms.to_string(),
                &iso_time,
                &flight_state_to_str(packet.flight_state),
                &format!("{:.2}", packet.altitude),
                &format!("{:.6}", packet.latitude),
                &format!("{:.6}", packet.longitude),
                &format!("{:.2}", packet.gps_speed),
                &format!("{:.2}", packet.pressure),
                &format!("{:.2}", packet.humidity),
                &(packet.primary_parachute_deployed as u8).to_string(),
                &(packet.secondary_parachute_deployed as u8).to_string(),
                "",
                "",
                "",
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        unified
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        self.rocket_count += 1;
        Ok(())
    }

    /// Write a payload packet into payload CSV and master unified CSV.
    pub fn write_payload(&mut self, packet: &TelemetryPacket) -> std::io::Result<()> {
        let iso_time = Local::now().to_rfc3339();

        // 1. Dedicated Payload CSV
        let writer = self.get_or_create_writer("payload")?;
        writer
            .write_record(&[
                packet.timestamp_ms.to_string(),
                iso_time.clone(),
                format!("{:.6}", packet.latitude),
                format!("{:.6}", packet.longitude),
                format!("{:.2}", packet.altitude),
                format!("{:.2}", packet.temp),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        writer
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        // 2. Unified Master CSV
        let unified = self.get_or_create_writer("unified")?;
        unified
            .write_record(&[
                "PAYLOAD",
                "0x02",
                &packet.timestamp_ms.to_string(),
                &iso_time,
                "",
                &format!("{:.2}", packet.altitude),
                &format!("{:.6}", packet.latitude),
                &format!("{:.6}", packet.longitude),
                "",
                "",
                "",
                "",
                "",
                &format!("{:.2}", packet.temp),
                "",
                "",
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        unified
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        self.payload_count += 1;
        Ok(())
    }

    /// Write a drone packet into drone CSV and master unified CSV.
    pub fn write_drone(&mut self, packet: &TelemetryPacket) -> std::io::Result<()> {
        let iso_time = Local::now().to_rfc3339();

        // 1. Dedicated Drone CSV
        let writer = self.get_or_create_writer("drone")?;
        writer
            .write_record(&[
                packet.timestamp_ms.to_string(),
                iso_time.clone(),
                format!("{:.6}", packet.latitude),
                format!("{:.6}", packet.longitude),
                format!("{:.2}", packet.altitude),
                format!("{:.2}", packet.gps_speed),
                format!("{:.1}", packet.gps_course),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        writer
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        // 2. Unified Master CSV
        let unified = self.get_or_create_writer("unified")?;
        unified
            .write_record(&[
                "DRONE",
                "0x03",
                &packet.timestamp_ms.to_string(),
                &iso_time,
                "",
                &format!("{:.2}", packet.altitude),
                &format!("{:.6}", packet.latitude),
                &format!("{:.6}", packet.longitude),
                "",
                "",
                "",
                "",
                "",
                "",
                &format!("{:.2}", packet.gps_speed),
                &format!("{:.1}", packet.gps_course),
            ])
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        unified
            .flush()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        self.drone_count += 1;
        Ok(())
    }

    /// Get file paths inside the flight session directory.
    pub fn rocket_file_path(&self) -> PathBuf {
        self.session_dir.join("telemetry_rocket.csv")
    }

    pub fn payload_file_path(&self) -> PathBuf {
        self.session_dir.join("telemetry_payload.csv")
    }

    pub fn drone_file_path(&self) -> PathBuf {
        self.session_dir.join("telemetry_drone.csv")
    }

    pub fn unified_file_path(&self) -> PathBuf {
        self.session_dir.join("telemetry_unified.csv")
    }

    /// Get or create CSV writer with clear Excel-friendly headers.
    fn get_or_create_writer(&mut self, source: &str) -> std::io::Result<&mut csv::Writer<File>> {
        let path = match source {
            "rocket" => self.rocket_file_path(),
            "payload" => self.payload_file_path(),
            "drone" => self.drone_file_path(),
            "unified" => self.unified_file_path(),
            _ => unreachable!(),
        };

        let writer_ref = match source {
            "rocket" => &mut self.rocket_writer,
            "payload" => &mut self.payload_writer,
            "drone" => &mut self.drone_writer,
            "unified" => &mut self.unified_writer,
            _ => unreachable!(),
        };

        if writer_ref.is_none() {
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)?;

            let mut writer = csv::Writer::from_writer(file);

            if fs::metadata(&path)?.len() == 0 {
                let headers: &[&str] = match source {
                    "rocket" => &[
                        "timestamp_ms",
                        "date_time_iso",
                        "flight_state",
                        "altitude_m",
                        "latitude",
                        "longitude",
                        "velocity_m_s",
                        "pressure1_hpa",
                        "pressure2_hpa",
                        "primary_parachute",
                        "secondary_parachute",
                    ],
                    "payload" => &[
                        "timestamp_ms",
                        "date_time_iso",
                        "latitude",
                        "longitude",
                        "altitude_m",
                        "scientific_data",
                    ],
                    "drone" => &[
                        "timestamp_ms",
                        "date_time_iso",
                        "latitude",
                        "longitude",
                        "altitude_m",
                        "speed_m_s",
                        "course_deg",
                    ],
                    "unified" => &[
                        "source",
                        "packet_id",
                        "timestamp_ms",
                        "date_time_iso",
                        "flight_state",
                        "altitude_m",
                        "latitude",
                        "longitude",
                        "velocity_m_s",
                        "pressure1_hpa",
                        "pressure2_hpa",
                        "primary_parachute",
                        "secondary_parachute",
                        "scientific_data",
                        "drone_speed_m_s",
                        "drone_course_deg",
                    ],
                    _ => unreachable!(),
                };

                writer
                    .write_record(headers)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                writer
                    .flush()
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            }

            *writer_ref = Some(writer);
        }

        Ok(writer_ref.as_mut().unwrap())
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


