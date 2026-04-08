//! IPC module — Tauri commands and event emission for frontend communication.
//!
//! Bridges the Rust backend (serial reader, mock generator, CSV logger) with
//! the React frontend via Tauri's IPC system:
//! - **Events**: `rocket-telemetry`, `payload-telemetry`, `connection-status`
//! - **Commands**: `connect_serial`, `disconnect_serial`, `list_serial_ports`,
//!   `start_mock`, `stop_mock`, `reset_mock`, `get_connection_status`

pub mod commands;
pub mod events;
pub mod state;

#[cfg(test)]
mod tests;
