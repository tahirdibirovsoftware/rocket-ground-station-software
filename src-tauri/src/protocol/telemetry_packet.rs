//! Telemetry Packet — unified ASCII CSV parser for Rocket, Payload, and Drone streams.
//!
//! Layout (AA / BB — 25 fields):
//! 0: Header ("AA", "BB", "CC")
//! 1: timestamp_ms (u32)
//! 2-4: accel_x, accel_y, accel_z (f32)
//! 5-7: gyro_x, gyro_y, gyro_z (f32)
//! 8-10: mag_x, mag_y, mag_z (f32)
//! 11: temp (f32)
//! 12: pressure (f32)
//! 13: humidity (f32)
//! 14: altitude (f32)
//! 15: aht_temp (f32)
//! 16: aht_hum (f32)
//! 17-18: latitude, longitude (f32)
//! 19: gps_altitude (f32)
//! 20: gps_speed (f32)
//! 21: gps_course (f32)
//! 22-24: roll, pitch, yaw (f32)
//!
//! Drone (CC) appends 7 flight-control fields (32 total):
//! 25: rel_alt (f32)         — relative altitude above takeoff (m)
//! 26: vertical_velocity (f32) — climb rate (m/s, + up)
//! 27: g_force (f32)         — G-loading (g)
//! 28: dpdt (f32)            — pressure change rate (hPa/s)
//! 29: armed (0/1)           — RF ARM command state
//! 30: state_code (u8)       — 0=DISARMED, 1=ARMED, 2=MOTORS_ON
//! 31: throttle_us (u16)     — ESC pulse width (1000..2000 us)

use serde::{Deserialize, Serialize};
use crate::protocol::rocket_packet::FlightState;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TelemetryPacket {
    pub header: String,
    pub timestamp_ms: u32,
    pub accel_x: f32,
    pub accel_y: f32,
    pub accel_z: f32,
    pub gyro_x: f32,
    pub gyro_y: f32,
    pub gyro_z: f32,
    pub mag_x: f32,
    pub mag_y: f32,
    pub mag_z: f32,
    pub temp: f32,
    pub pressure: f32,
    pub humidity: f32,
    pub altitude: f32,
    pub aht_temp: f32,
    pub aht_hum: f32,
    pub latitude: f32,
    pub longitude: f32,
    pub gps_altitude: f32,
    pub gps_speed: f32,
    pub gps_course: f32,
    pub roll: f32,
    pub pitch: f32,
    pub yaw: f32,

    // Derived fields estimated on Ground Station
    pub flight_state: FlightState,
    pub primary_parachute_deployed: bool,
    pub secondary_parachute_deployed: bool,

    // Drone flight-control fields (CC only, zero for AA/BB)
    #[serde(default)]
    pub rel_alt: f32,
    #[serde(default)]
    pub vertical_velocity: f32,
    #[serde(default)]
    pub g_force: f32,
    #[serde(default)]
    pub dpdt: f32,
    #[serde(default)]
    pub armed: bool,
    #[serde(default)]
    pub state_code: u8,
    #[serde(default)]
    pub throttle_us: u16,
}

impl TelemetryPacket {
    pub fn parse(line: &str) -> Option<Self> {
        let line = line.trim();
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 25 {
            return None;
        }

        let header = parts[0].trim().to_string();
        if header != "AA" && header != "BB" && header != "CC" {
            return None;
        }

        let parse_f32 = |s: &str| -> f32 {
            let s_trimmed = s.trim();
            if s_trimmed == "N" || s_trimmed.is_empty() {
                0.0
            } else {
                let parsed = s_trimmed.parse::<f32>().unwrap_or(0.0);
                if parsed.is_nan() || parsed.is_infinite() {
                    0.0
                } else {
                    parsed
                }
            }
        };

        let timestamp_ms = parts[1].trim().parse::<u32>().unwrap_or(0);
        let accel_x = parse_f32(parts[2]);
        let accel_y = parse_f32(parts[3]);
        let accel_z = parse_f32(parts[4]);
        let gyro_x = parse_f32(parts[5]);
        let gyro_y = parse_f32(parts[6]);
        let gyro_z = parse_f32(parts[7]);
        let mag_x = parse_f32(parts[8]);
        let mag_y = parse_f32(parts[9]);
        let mag_z = parse_f32(parts[10]);
        let temp = parse_f32(parts[11]);
        let pressure = parse_f32(parts[12]);
        let humidity = parse_f32(parts[13]);
        let altitude = parse_f32(parts[14]);
        let aht_temp = parse_f32(parts[15]);
        let aht_hum = parse_f32(parts[16]);
        let latitude = parse_f32(parts[17]);
        let longitude = parse_f32(parts[18]);
        let gps_altitude = parse_f32(parts[19]);
        let gps_speed = parse_f32(parts[20]);
        let gps_course = parse_f32(parts[21]);
        let roll = parse_f32(parts[22]);
        let pitch = parse_f32(parts[23]);
        let yaw = parse_f32(parts[24]);

        // Drone (CC) flight-control extension: 7 extra fields
        let (rel_alt, vertical_velocity, g_force, dpdt, armed, state_code, throttle_us) =
            if header == "CC" && parts.len() >= 32 {
                let rel_alt = parse_f32(parts[25]);
                let vertical_velocity = parse_f32(parts[26]);
                let g_force = parse_f32(parts[27]);
                let dpdt = parse_f32(parts[28]);
                let armed = parts[29].trim() == "1";
                let state_code = parts[30].trim().parse::<u8>().unwrap_or(0);
                let throttle_us = parts[31].trim().parse::<u16>().unwrap_or(0);
                (
                    rel_alt,
                    vertical_velocity,
                    g_force,
                    dpdt,
                    armed,
                    state_code,
                    throttle_us,
                )
            } else {
                (0.0, 0.0, 0.0, 0.0, false, 0, 0)
            };

        Some(Self {
            header,
            timestamp_ms,
            accel_x,
            accel_y,
            accel_z,
            gyro_x,
            gyro_y,
            gyro_z,
            mag_x,
            mag_y,
            mag_z,
            temp,
            pressure,
            humidity,
            altitude,
            aht_temp,
            aht_hum,
            latitude,
            longitude,
            gps_altitude,
            gps_speed,
            gps_course,
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
            armed,
            state_code,
            throttle_us,
        })
    }

    pub fn to_csv_string(&self) -> String {
        let format_f32 = |v: f32, decimals: usize| -> String {
            format!("{:.1$}", v, decimals)
        };

        let mut line = format!(
            "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
            self.header,
            self.timestamp_ms,
            format_f32(self.accel_x, 3),
            format_f32(self.accel_y, 3),
            format_f32(self.accel_z, 3),
            format_f32(self.gyro_x, 4),
            format_f32(self.gyro_y, 4),
            format_f32(self.gyro_z, 4),
            format_f32(self.mag_x, 2),
            format_f32(self.mag_y, 2),
            format_f32(self.mag_z, 2),
            format_f32(self.temp, 1),
            format_f32(self.pressure, 1),
            format_f32(self.humidity, 1),
            format_f32(self.altitude, 1),
            format_f32(self.aht_temp, 1),
            format_f32(self.aht_hum, 1),
            format_f32(self.latitude, 6),
            format_f32(self.longitude, 6),
            format_f32(self.gps_altitude, 1),
            format_f32(self.gps_speed, 2),
            format_f32(self.gps_course, 1),
            format_f32(self.roll, 2),
            format_f32(self.pitch, 2),
            format_f32(self.yaw, 2)
        );

        // Drone (CC) flight-control extension
        if self.header == "CC" {
            line.push_str(&format!(
                ",{},{},{},{},{},{},{}",
                format_f32(self.rel_alt, 2),
                format_f32(self.vertical_velocity, 2),
                format_f32(self.g_force, 3),
                format_f32(self.dpdt, 3),
                if self.armed { 1 } else { 0 },
                self.state_code,
                self.throttle_us,
            ));
        }

        line.push('\n');
        line
    }
}
