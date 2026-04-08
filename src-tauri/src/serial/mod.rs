//! Serial port module — reads raw binary streams from Linux serial ports.
//!
//! Handles byte-level framing: scans for start bytes (`0xAA` or `0xBB`),
//! accumulates the correct number of bytes, and validates checksums before
//! passing parsed packets upstream.

pub mod config;
pub mod reader;

#[cfg(test)]
mod tests;
