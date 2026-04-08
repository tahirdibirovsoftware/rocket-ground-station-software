//! Mock data generator module — simulates realistic telemetry without hardware.
//!
//! Provides a configurable flight profile that progresses through all 6 flight
//! states over ~180 seconds, generating valid binary packets at the correct
//! data rates (1 Hz avionics, 5 Hz payload).

pub mod flight_profile;
pub mod generator;

#[cfg(test)]
mod tests;
