//! Protocol module — Binary packet parsing for the AZST Ground Station.
//!
//! Implements parsers for two independent serial streams:
//! - **Rocket Avionics** (36 bytes, start byte `0xAA`)
//! - **Payload Scientific** (24 bytes, start byte `0xBB`)
//!
//! All multi-byte fields are **little-endian**. Each packet ends with an
//! XOR checksum computed over bytes `[1..N-1]` (excluding start byte and
//! checksum byte itself).

pub mod checksum;
pub mod payload_packet;
pub mod rocket_packet;

#[cfg(test)]
mod tests;
