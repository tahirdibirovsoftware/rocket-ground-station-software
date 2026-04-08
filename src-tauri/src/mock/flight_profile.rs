//! Flight profile simulation — generates physically plausible telemetry values
//! for a ~180-second model rocket flight.
//!
//! The profile defines 6 phases matching the `FlightState` enum:
//!
//! | Phase           | Time (s)  | Behavior                           |
//! |-----------------|-----------|------------------------------------|
//! | Pad             | 0–3       | Stationary on launch pad           |
//! | Powered         | 3–15      | Motor burn, rapid acceleration     |
//! | Unpowered       | 15–30     | Coast, decelerating to apogee      |
//! | Apogee          | 30–32     | Peak altitude, velocity near zero  |
//! | Primary Chute   | 32–120    | Descent under main parachute       |
//! | Secondary Chute | 120–180   | Slower descent under backup chute  |
//!
//! GPS coordinates drift gradually from a configurable launch site.
//! Pressure is inversely correlated with altitude via barometric formula.
//! Scientific sensor data is a sinusoidal wave with random noise.

use crate::protocol::rocket_packet::{FlightState, RocketPacket, ROCKET_PACKET_ID};
use crate::protocol::payload_packet::{PayloadPacket, PAYLOAD_PACKET_ID};

/// Default launch site coordinates (Aksaray, Turkey — typical TEKNOFEST area).
pub const DEFAULT_LAUNCH_LAT: f32 = 38.3687;
pub const DEFAULT_LAUNCH_LON: f32 = 34.0370;

/// Sea-level pressure in hPa.
const SEA_LEVEL_PRESSURE: f32 = 1013.25;

/// Target apogee altitude in meters.
const APOGEE_ALTITUDE: f32 = 3000.0;

/// Descent rate under primary chute (m/s, downward = negative velocity).
const PRIMARY_CHUTE_DESCENT_RATE: f32 = -15.0;

/// Descent rate under secondary chute (m/s, slower).
const SECONDARY_CHUTE_DESCENT_RATE: f32 = -8.0;

/// Phase timing boundaries in seconds.
pub struct PhaseTimings {
    pub pad_end: f32,
    pub powered_end: f32,
    pub unpowered_end: f32,
    pub apogee_end: f32,
    pub primary_chute_end: f32,
    pub flight_end: f32,
}

impl Default for PhaseTimings {
    fn default() -> Self {
        Self {
            pad_end: 3.0,
            powered_end: 15.0,
            unpowered_end: 30.0,
            apogee_end: 32.0,
            primary_chute_end: 120.0,
            flight_end: 180.0,
        }
    }
}

/// Configuration for the flight simulation.
pub struct FlightProfileConfig {
    pub launch_lat: f32,
    pub launch_lon: f32,
    pub timings: PhaseTimings,
}

impl Default for FlightProfileConfig {
    fn default() -> Self {
        Self {
            launch_lat: DEFAULT_LAUNCH_LAT,
            launch_lon: DEFAULT_LAUNCH_LON,
            timings: PhaseTimings::default(),
        }
    }
}

/// Compute the flight state for a given elapsed time in seconds.
pub fn flight_state_at(elapsed_s: f32, timings: &PhaseTimings) -> FlightState {
    if elapsed_s < timings.pad_end {
        FlightState::Pad
    } else if elapsed_s < timings.powered_end {
        FlightState::Powered
    } else if elapsed_s < timings.unpowered_end {
        FlightState::Unpowered
    } else if elapsed_s < timings.apogee_end {
        FlightState::Apogee
    } else if elapsed_s < timings.primary_chute_end {
        FlightState::PrimaryChute
    } else {
        FlightState::SecondaryChute
    }
}

/// Compute altitude (meters) at the given elapsed time.
///
/// Uses parabolic ascent during powered/unpowered phases and linear
/// descent during chute phases.
pub fn altitude_at(elapsed_s: f32, timings: &PhaseTimings) -> f32 {
    let state = flight_state_at(elapsed_s, timings);

    match state {
        FlightState::Pad => 0.0,

        FlightState::Powered => {
            // Quadratic ramp from 0 to ~2000m during motor burn
            let t = elapsed_s - timings.pad_end;
            let duration = timings.powered_end - timings.pad_end;
            let progress = t / duration;
            // Accelerating: s = 0.5 * a * t^2 shape
            APOGEE_ALTITUDE * 0.65 * progress * progress
        }

        FlightState::Unpowered => {
            // Continue rising but decelerating to apogee
            let alt_at_burnout = APOGEE_ALTITUDE * 0.65;
            let t = elapsed_s - timings.powered_end;
            let duration = timings.unpowered_end - timings.powered_end;
            let progress = t / duration;
            // Decelerating: parabolic approach to apogee
            let remaining = APOGEE_ALTITUDE - alt_at_burnout;
            alt_at_burnout + remaining * (2.0 * progress - progress * progress)
        }

        FlightState::Apogee => APOGEE_ALTITUDE,

        FlightState::PrimaryChute => {
            let t = elapsed_s - timings.apogee_end;
            let alt = APOGEE_ALTITUDE + PRIMARY_CHUTE_DESCENT_RATE * t;
            alt.max(500.0) // Don't go below transition altitude
        }

        FlightState::SecondaryChute => {
            // Altitude when secondary deploys
            let primary_duration = timings.primary_chute_end - timings.apogee_end;
            let alt_at_secondary = (APOGEE_ALTITUDE + PRIMARY_CHUTE_DESCENT_RATE * primary_duration).max(500.0);
            let t = elapsed_s - timings.primary_chute_end;
            let alt = alt_at_secondary + SECONDARY_CHUTE_DESCENT_RATE * t;
            alt.max(0.0)
        }
    }
}

/// Compute velocity (m/s) at the given elapsed time.
pub fn velocity_at(elapsed_s: f32, timings: &PhaseTimings) -> f32 {
    let state = flight_state_at(elapsed_s, timings);

    match state {
        FlightState::Pad => 0.0,

        FlightState::Powered => {
            let t = elapsed_s - timings.pad_end;
            let duration = timings.powered_end - timings.pad_end;
            let progress = t / duration;
            // Linear acceleration: v = a*t
            let max_velocity = 250.0;
            max_velocity * progress
        }

        FlightState::Unpowered => {
            let t = elapsed_s - timings.powered_end;
            let duration = timings.unpowered_end - timings.powered_end;
            let progress = t / duration;
            // Linear deceleration from max to 0
            250.0 * (1.0 - progress)
        }

        FlightState::Apogee => 0.0,
        FlightState::PrimaryChute => PRIMARY_CHUTE_DESCENT_RATE,
        FlightState::SecondaryChute => SECONDARY_CHUTE_DESCENT_RATE,
    }
}

/// Estimate barometric pressure from altitude using simplified barometric formula.
/// Returns pressure in hPa.
pub fn pressure_from_altitude(altitude_m: f32) -> f32 {
    // P = P0 * (1 - 0.0000225577 * h)^5.25588
    let factor = (1.0 - 0.0000225577 * altitude_m).max(0.0);
    SEA_LEVEL_PRESSURE * factor.powf(5.25588)
}

/// Compute GPS coordinate with gradual wind-drift offset.
/// Returns (latitude, longitude) with small drift proportional to time.
pub fn gps_at(elapsed_s: f32, launch_lat: f32, launch_lon: f32) -> (f32, f32) {
    // Wind drift: ~0.0001 degrees/second (~11m/s at equator)
    let drift_lat = elapsed_s * 0.00003;
    let drift_lon = elapsed_s * 0.00005;

    (launch_lat + drift_lat, launch_lon + drift_lon)
}

/// Compute a sinusoidal scientific sensor value with pseudo-random noise.
/// Uses a simple deterministic noise based on timestamp to be reproducible.
pub fn scientific_sensor_at(elapsed_s: f32, timestamp_ms: u32) -> f32 {
    let base_signal = 25.0 + 10.0 * (elapsed_s * 0.5).sin();
    // Deterministic "noise" from timestamp bits
    let noise = ((timestamp_ms % 100) as f32 - 50.0) * 0.05;
    base_signal + noise
}

/// Generate a complete `RocketPacket` for a given elapsed time.
pub fn generate_rocket_packet(elapsed_s: f32, config: &FlightProfileConfig) -> RocketPacket {
    let timestamp_ms = (elapsed_s * 1000.0) as u32;
    let timings = &config.timings;
    let altitude = altitude_at(elapsed_s, timings);
    let (lat, lon) = gps_at(elapsed_s, config.launch_lat, config.launch_lon);
    let pressure1 = pressure_from_altitude(altitude);
    let pressure2 = pressure_from_altitude(altitude) + 0.3; // slight sensor offset
    let velocity = velocity_at(elapsed_s, timings);
    let flight_state = flight_state_at(elapsed_s, timings);

    let primary_parachute_deployed = matches!(
        flight_state,
        FlightState::PrimaryChute | FlightState::SecondaryChute
    );
    let secondary_parachute_deployed = matches!(flight_state, FlightState::SecondaryChute);

    RocketPacket {
        packet_id: ROCKET_PACKET_ID,
        timestamp_ms,
        altitude,
        latitude: lat,
        longitude: lon,
        pressure1,
        pressure2,
        velocity,
        flight_state,
        primary_parachute_deployed,
        secondary_parachute_deployed,
    }
}

/// Generate a complete `PayloadPacket` for a given elapsed time.
/// Payload drifts slightly differently from the rocket after separation.
pub fn generate_payload_packet(elapsed_s: f32, config: &FlightProfileConfig) -> PayloadPacket {
    let timestamp_ms = (elapsed_s * 1000.0) as u32;
    let timings = &config.timings;

    // Payload separates after apogee — before that, tracks rocket
    let altitude = altitude_at(elapsed_s, timings) * 0.98; // slight offset
    let (lat, lon) = gps_at(elapsed_s, config.launch_lat, config.launch_lon);
    // Payload drifts slightly more than rocket
    let payload_lat = lat + 0.0002;
    let payload_lon = lon - 0.0001;

    let scientific_data = scientific_sensor_at(elapsed_s, timestamp_ms);

    PayloadPacket {
        packet_id: PAYLOAD_PACKET_ID,
        timestamp_ms,
        latitude: payload_lat,
        longitude: payload_lon,
        altitude,
        scientific_data,
    }
}
