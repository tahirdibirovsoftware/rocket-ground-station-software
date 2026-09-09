//! Mock stream generator — produces simulated telemetry packets in ASCII CSV format.
//!
//! Emits ASCII CSV bytes starting with "AA,", "BB,", or "CC," at regular intervals.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use crate::protocol::telemetry_packet::TelemetryPacket;
use crate::protocol::rocket_packet::FlightState;

use super::flight_profile::{
    altitude_at, flight_state_at, gps_at, pressure_from_altitude,
    scientific_sensor_at, velocity_at, FlightProfileConfig,
};

/// Represents a generated packet ready for consumption.
#[derive(Debug, Clone)]
pub enum MockPacket {
    Rocket(Vec<u8>),
    Payload(Vec<u8>),
    Drone(Vec<u8>),
}

/// Shared state for controlling the mock generator across threads.
#[derive(Debug)]
pub struct MockState {
    /// Whether the mock generator is currently running.
    pub running: AtomicBool,
    /// Elapsed time in milliseconds since mock started.
    pub elapsed_ms: AtomicU64,
    /// Ground-station commanded drone arm state (true = ARM).
    pub drone_armed: AtomicBool,
    /// Whether the ground station has sent a drone arm command.
    pub drone_arm_override: AtomicBool,
}

impl MockState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            elapsed_ms: AtomicU64::new(0),
            drone_armed: AtomicBool::new(false),
            drone_arm_override: AtomicBool::new(false),
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn start(&self) {
        self.running.store(true, Ordering::Relaxed);
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }

    pub fn reset(&self) {
        self.stop();
        self.elapsed_ms.store(0, Ordering::Relaxed);
        self.drone_armed.store(false, Ordering::Relaxed);
        self.drone_arm_override.store(false, Ordering::Relaxed);
    }

    pub fn get_elapsed_ms(&self) -> u64 {
        self.elapsed_ms.load(Ordering::Relaxed)
    }

    pub fn set_elapsed_ms(&self, ms: u64) {
        self.elapsed_ms.store(ms, Ordering::Relaxed);
    }

    /// Command the mock drone engine: true = ARM ('1'), false = DISARM ('0').
    pub fn set_drone_arm(&self, armed: bool) {
        self.drone_armed.store(armed, Ordering::Relaxed);
        self.drone_arm_override.store(true, Ordering::Relaxed);
    }

    /// Returns the ground-commanded arm state, or `None` when no command was sent yet.
    pub fn drone_arm_command(&self) -> Option<bool> {
        if self.drone_arm_override.load(Ordering::Relaxed) {
            Some(self.drone_armed.load(Ordering::Relaxed))
        } else {
            None
        }
    }
}

impl Default for MockState {
    fn default() -> Self {
        Self::new()
    }
}

/// Generates simulated CSV bytes.
pub struct MockGenerator {
    config: FlightProfileConfig,
}

impl MockGenerator {
    /// Create a new generator with the given flight profile configuration.
    pub fn new(config: FlightProfileConfig) -> Self {
        Self { config }
    }

    /// Create a new generator with default configuration.
    pub fn with_defaults() -> Self {
        Self::new(FlightProfileConfig::default())
    }

    /// Generate simulated Rocket telemetry in ASCII CSV format.
    pub fn generate_rocket_bytes(&self, elapsed_s: f32) -> Option<MockPacket> {
        if elapsed_s > self.config.timings.flight_end {
            return None;
        }
        let timestamp_ms = (elapsed_s * 1000.0) as u32;
        let alt = altitude_at(elapsed_s, &self.config.timings);
        let vel = velocity_at(elapsed_s, &self.config.timings);
        let (lat, lon) = gps_at(elapsed_s, self.config.launch_lat, self.config.launch_lon);
        let press = pressure_from_altitude(alt);
        
        let state = flight_state_at(elapsed_s, &self.config.timings);
        let accel_z = match state {
            FlightState::Powered => 25.0,
            FlightState::Unpowered => -9.8,
            FlightState::Pad => 9.8,
            _ => -1.5,
        };

        let packet = TelemetryPacket {
            header: "AA".to_string(),
            timestamp_ms,
            accel_x: 0.12,
            accel_y: -0.05,
            accel_z,
            gyro_x: 0.01,
            gyro_y: -0.02,
            gyro_z: 0.005,
            mag_x: 12.5,
            mag_y: -8.2,
            mag_z: 42.1,
            temp: 24.5 - (alt * 0.0065),
            pressure: press,
            humidity: 45.0 - (alt * 0.01),
            altitude: alt,
            aht_temp: 24.2 - (alt * 0.006),
            aht_hum: 46.5 - (alt * 0.009),
            latitude: lat,
            longitude: lon,
            gps_altitude: alt,
            gps_speed: vel.abs(),
            gps_course: 180.0,
            roll: 12.0 + elapsed_s * 0.5,
            pitch: 5.0 + elapsed_s * 0.2,
            yaw: 90.0 + elapsed_s * 0.1,
            flight_state: state,
            primary_parachute_deployed: matches!(state, FlightState::PrimaryChute | FlightState::SecondaryChute),
            secondary_parachute_deployed: matches!(state, FlightState::SecondaryChute),
            rel_alt: 0.0,
            vertical_velocity: 0.0,
            g_force: 0.0,
            dpdt: 0.0,
            armed: false,
            state_code: 0,
            throttle_us: 0,
            esc2_us: 0,
            on_ground: false,
            flight_phase: 0,
            fast_g: 0.0,
            outputs_active: false,
            bno_calib: 0,
            flags: 0,
        };
        
        let csv_str = packet.to_csv_string();
        Some(MockPacket::Rocket(csv_str.into_bytes()))
    }

    /// Generate simulated Payload telemetry in ASCII CSV format.
    pub fn generate_payload_bytes(&self, elapsed_s: f32) -> Option<MockPacket> {
        if elapsed_s > self.config.timings.flight_end {
            return None;
        }
        let timestamp_ms = (elapsed_s * 1000.0) as u32;
        let alt = altitude_at(elapsed_s, &self.config.timings) * 0.98;
        let vel = velocity_at(elapsed_s, &self.config.timings) * 0.98;
        let (lat, lon) = gps_at(elapsed_s, self.config.launch_lat, self.config.launch_lon);
        let payload_lat = lat + 0.0002;
        let payload_lon = lon - 0.0001;
        let press = pressure_from_altitude(alt);

        // Payload flight phase (mirrors Teensy payload state machine):
        // PRE_LAUNCH (0) → IN_AIR (1) on launch → ON_GROUND (2) after landing
        let rocket_state = flight_state_at(elapsed_s, &self.config.timings);
        let flight_phase: u8 = match rocket_state {
            FlightState::Pad => 0,                                     // PRE_LAUNCH
            FlightState::SecondaryChute => 2,                          // ON_GROUND
            _ => 1,                                                    // IN_AIR
        };
        let on_ground = flight_phase == 2;
        let g_force = if rocket_state == FlightState::Powered { 4.0 } else { 1.0 };

        let packet = TelemetryPacket {
            header: "BB".to_string(),
            timestamp_ms,
            accel_x: -0.05,
            accel_y: 0.08,
            accel_z: 9.8,
            gyro_x: -0.01,
            gyro_y: 0.01,
            gyro_z: 0.02,
            mag_x: 10.4,
            mag_y: -9.5,
            mag_z: 40.0,
            temp: scientific_sensor_at(elapsed_s, timestamp_ms),
            pressure: press,
            humidity: 50.0,
            altitude: alt,
            aht_temp: 23.5,
            aht_hum: 51.0,
            latitude: payload_lat,
            longitude: payload_lon,
            gps_altitude: alt,
            gps_speed: vel.abs(),
            gps_course: 180.0,
            roll: 0.0,
            pitch: 0.0,
            yaw: 0.0,
            flight_state: FlightState::Pad,
            primary_parachute_deployed: false,
            secondary_parachute_deployed: false,
            rel_alt: alt,
            vertical_velocity: vel,
            g_force,
            dpdt: -vel * 0.12,
            armed: false,
            state_code: 0,
            throttle_us: 0,
            esc2_us: 0,
            on_ground,
            flight_phase,
            fast_g: g_force,
            outputs_active: on_ground,
            bno_calib: 0,
            flags: 0,
        };
        
        let csv_str = packet.to_csv_string();
        Some(MockPacket::Payload(csv_str.into_bytes()))
    }

    /// Generate simulated Drone telemetry in ASCII CSV format.
    pub fn generate_drone_bytes(&self, elapsed_s: f32) -> Option<MockPacket> {
        self.generate_drone_bytes_with_arm(elapsed_s, None)
    }

    /// Generate simulated Drone telemetry with an optional ground-commanded arm override.
    pub fn generate_drone_bytes_with_arm(
        &self,
        elapsed_s: f32,
        arm_override: Option<bool>,
    ) -> Option<MockPacket> {
        if elapsed_s > self.config.timings.flight_end {
            return None;
        }
        let timestamp_ms = (elapsed_s * 1000.0) as u32;
        
        let alt = if elapsed_s < 10.0 {
            elapsed_s * 5.0
        } else if elapsed_s < 150.0 {
            50.0
        } else {
            (50.0 - (elapsed_s - 150.0) * 3.0).max(0.0)
        };

        // Drone flight-control simulation (mirrors Teensy flight_ctrl state machine):
        // DISARMED → ARMED → MOTORS_ON (descending && alt <= 500 m)
        let vertical_velocity: f32 = if elapsed_s < 10.0 {
            5.0
        } else if elapsed_s < 150.0 {
            0.0
        } else {
            -3.0
        };
        let armed = arm_override.unwrap_or(elapsed_s >= 5.0);
        let motors_on = armed && vertical_velocity < 0.0 && alt <= 500.0;
        let state_code = if !armed {
            0
        } else if motors_on {
            2
        } else {
            1
        };
        let throttle_us = if motors_on { 1480u16 } else { 1000u16 };
        let esc2_us = if motors_on { 1480u16 } else { 1000u16 };
        let g_force = 1.0 + vertical_velocity.abs() * 0.01;
        let dpdt = -vertical_velocity * 0.12; // approx hPa/s at low altitude

        let (lat, lon) = gps_at(elapsed_s, self.config.launch_lat, self.config.launch_lon);
        let drone_lat = lat - 0.0003;
        let drone_lon = lon + 0.0004;
        let press = pressure_from_altitude(alt);

        let packet = TelemetryPacket {
            header: "CC".to_string(),
            timestamp_ms,
            accel_x: 0.01,
            accel_y: 0.01,
            accel_z: 9.8,
            gyro_x: 0.002,
            gyro_y: 0.003,
            gyro_z: 0.001,
            mag_x: 11.2,
            mag_y: -8.9,
            mag_z: 41.5,
            temp: 25.1,
            pressure: press,
            humidity: 42.0,
            altitude: alt,
            aht_temp: 24.8,
            aht_hum: 43.5,
            latitude: drone_lat,
            longitude: drone_lon,
            gps_altitude: alt,
            gps_speed: if alt > 0.0 { 3.5 } else { 0.0 },
            gps_course: 90.0,
            roll: 1.2,
            pitch: -0.8,
            yaw: 180.0,
            flight_state: FlightState::Pad,
            primary_parachute_deployed: false,
            secondary_parachute_deployed: false,
            rel_alt: alt,
            vertical_velocity,
            g_force,
            dpdt,
            armed,
            state_code,
            throttle_us,
            esc2_us,
            on_ground: false,
            flight_phase: 0,
            fast_g: g_force,
            outputs_active: state_code == 2,
            bno_calib: 0,
            flags: 0,
        };

        let csv_str = packet.to_csv_string();
        Some(MockPacket::Drone(csv_str.into_bytes()))
    }

    /// Generate all packets for a tick.
    pub fn generate_tick(&self, tick_index: u64) -> Vec<MockPacket> {
        self.generate_tick_with_arm(tick_index, None)
    }

    /// Generate all packets for a tick with an optional drone arm override.
    pub fn generate_tick_with_arm(
        &self,
        tick_index: u64,
        drone_arm: Option<bool>,
    ) -> Vec<MockPacket> {
        let elapsed_s = tick_index as f32 * 0.2;
        let mut packets = Vec::new();

        if tick_index % 5 == 0 {
            if let Some(r) = self.generate_rocket_bytes(elapsed_s) {
                packets.push(r);
            }
        }

        if let Some(p) = self.generate_payload_bytes(elapsed_s) {
            packets.push(p);
        }

        if let Some(d) = self.generate_drone_bytes_with_arm(elapsed_s, drone_arm) {
            packets.push(d);
        }

        packets
    }

    /// Get the flight profile configuration.
    pub fn config(&self) -> &FlightProfileConfig {
        &self.config
    }
}

/// Create a shared mock state wrapped in an Arc for cross-thread usage.
pub fn create_mock_state() -> Arc<MockState> {
    Arc::new(MockState::new())
}
