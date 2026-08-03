/**
 * AZST Ground Station — Global Type Definitions
 *
 * Domain types for telemetry packets, flight states, and connection management.
 */

/* ── Flight State Enum ── */
export enum FlightState {
  Pad = 0,
  Powered = 1,
  Unpowered = 2,
  Apogee = 3,
  PrimaryChute = 4,
  SecondaryChute = 5,
}

/* ── Telemetry Packet (ASCII CSV parsed schema) ── */
export interface TelemetryPacket {
  header: string;                  // "AA", "BB", "CC"
  timestampMs: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  magX: number;
  magY: number;
  magZ: number;
  temp: number;
  pressure: number;
  humidity: number;
  altitude: number;
  ahtTemp: number;
  ahtHum: number;
  latitude: number;
  longitude: number;
  gpsAltitude: number;
  gpsSpeed: number;
  gpsCourse: number;
  roll: number;
  pitch: number;
  yaw: number;
  flightState: FlightState;
  primaryParachuteDeployed: boolean;
  secondaryParachuteDeployed: boolean;
  receivedAt: number;              // frontend timestamp (Date.now())
}

/* ── Connection State ── */
export enum ConnectionStatus {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Error = "error",
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  product?: string;
}

export interface ConnectionState {
  rfdPort: {
    status: ConnectionStatus;
    path: string | null;
    baudRate: number;
    rocketPacketsReceived: number;
    payloadPacketsReceived: number;
    dronePacketsReceived: number;
    checksumFailures: number;
    lastPacketAt: number | null;
  };
  mockMode: boolean;
}
