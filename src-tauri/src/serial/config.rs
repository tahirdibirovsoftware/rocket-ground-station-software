//! Serial port configuration and enumeration.

use serde::{Deserialize, Serialize};

/// Default baud rate for ground station communication.
pub const DEFAULT_BAUD_RATE: u32 = 115200;

/// Default read timeout in milliseconds.
pub const DEFAULT_TIMEOUT_MS: u64 = 100;

/// Configuration for a serial port connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialPortConfig {
    /// Device path (e.g., `/dev/ttyUSB0`).
    pub path: String,
    /// Baud rate (default: 115200).
    pub baud_rate: u32,
    /// Read timeout in milliseconds.
    pub timeout_ms: u64,
}

impl SerialPortConfig {
    pub fn new(path: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            baud_rate: DEFAULT_BAUD_RATE,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }

    pub fn with_baud_rate(mut self, baud_rate: u32) -> Self {
        self.baud_rate = baud_rate;
        self
    }

    pub fn with_timeout_ms(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }
}

/// Information about an available serial port on the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    /// Device path (e.g., `/dev/ttyUSB0`).
    pub path: String,
    /// Manufacturer name, if available.
    pub manufacturer: Option<String>,
    /// Product name, if available.
    pub product: Option<String>,
    /// Serial number, if available.
    pub serial_number: Option<String>,
}

/// Enumerate all available serial ports on the system.
///
/// Returns an empty list if no ports are found or if enumeration fails.
pub fn list_available_ports() -> Vec<PortInfo> {
    match serialport::available_ports() {
        Ok(ports) => ports
            .into_iter()
            .filter(|p| {
                // Filter out ghost hardware ports (like /dev/ttyS*) by requiring USB or Bluetooth
                matches!(
                    p.port_type,
                    serialport::SerialPortType::UsbPort(_) | serialport::SerialPortType::BluetoothPort
                )
            })
            .map(|p| {
                let (manufacturer, product, serial_number) = match &p.port_type {
                    serialport::SerialPortType::UsbPort(usb) => (
                        usb.manufacturer.clone(),
                        usb.product.clone(),
                        usb.serial_number.clone(),
                    ),
                    _ => (None, None, None),
                };
                PortInfo {
                    path: p.port_name,
                    manufacturer,
                    product,
                    serial_number,
                }
            })
            .collect(),
        Err(e) => {
            log::warn!("Failed to enumerate serial ports: {e}");
            Vec::new()
        }
    }
}
