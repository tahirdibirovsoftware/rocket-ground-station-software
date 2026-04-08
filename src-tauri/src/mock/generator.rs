//! Mock stream generator — produces raw binary packets at configurable rates.
//!
//! The `MockGenerator` acts as an async data source that can be controlled
//! via Tauri commands (`start_mock`, `stop_mock`, `reset_mock`). It emits
//! raw `Vec<u8>` packets with valid checksums at the correct data rates:
//! - Rocket Avionics: 1 Hz (one 36-byte packet per second)
//! - Payload Scientific: 5 Hz (five 24-byte packets per second)

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use crate::protocol::rocket_packet::build_rocket_packet;
use crate::protocol::payload_packet::build_payload_packet;

use super::flight_profile::{
    generate_rocket_packet, generate_payload_packet, FlightProfileConfig,
};

/// Represents a generated packet ready for consumption.
#[derive(Debug, Clone)]
pub enum MockPacket {
    Rocket(Vec<u8>),
    Payload(Vec<u8>),
}

/// Shared state for controlling the mock generator across threads.
#[derive(Debug)]
pub struct MockState {
    /// Whether the mock generator is currently running.
    pub running: AtomicBool,
    /// Elapsed time in milliseconds since mock started.
    pub elapsed_ms: AtomicU64,
}

impl MockState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            elapsed_ms: AtomicU64::new(0),
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
    }

    pub fn get_elapsed_ms(&self) -> u64 {
        self.elapsed_ms.load(Ordering::Relaxed)
    }

    pub fn set_elapsed_ms(&self, ms: u64) {
        self.elapsed_ms.store(ms, Ordering::Relaxed);
    }
}

impl Default for MockState {
    fn default() -> Self {
        Self::new()
    }
}

/// Generates raw binary packets for a specific point in time.
///
/// This is the core generation function used by both the async loop
/// and the synchronous test helpers.
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

    /// Generate a rocket avionics packet (36 bytes) for the given elapsed time.
    /// Returns `None` if the flight has ended (elapsed > flight_end).
    pub fn generate_rocket_bytes(&self, elapsed_s: f32) -> Option<MockPacket> {
        if elapsed_s > self.config.timings.flight_end {
            return None;
        }
        let packet = generate_rocket_packet(elapsed_s, &self.config);
        let bytes = build_rocket_packet(&packet);
        Some(MockPacket::Rocket(bytes.to_vec()))
    }

    /// Generate a payload scientific packet (24 bytes) for the given elapsed time.
    /// Returns `None` if the flight has ended (elapsed > flight_end).
    pub fn generate_payload_bytes(&self, elapsed_s: f32) -> Option<MockPacket> {
        if elapsed_s > self.config.timings.flight_end {
            return None;
        }
        let packet = generate_payload_packet(elapsed_s, &self.config);
        let bytes = build_payload_packet(&packet);
        Some(MockPacket::Payload(bytes.to_vec()))
    }

    /// Generate all packets that should be emitted at a given tick.
    ///
    /// At every tick (200ms / 5 Hz):
    /// - Always emits a payload packet (5 Hz)
    /// - Emits a rocket packet every 5th tick (1 Hz)
    ///
    /// `tick_index` is 0-based and increments at 5 Hz.
    pub fn generate_tick(&self, tick_index: u64) -> Vec<MockPacket> {
        let elapsed_s = tick_index as f32 * 0.2; // 200ms per tick
        let mut packets = Vec::new();

        // Payload at every tick (5 Hz)
        if let Some(p) = self.generate_payload_bytes(elapsed_s) {
            packets.push(p);
        }

        // Rocket every 5th tick (1 Hz)
        if tick_index % 5 == 0 {
            if let Some(r) = self.generate_rocket_bytes(elapsed_s) {
                packets.push(r);
            }
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
