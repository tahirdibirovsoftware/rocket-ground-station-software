/**
 * AZST Ground Station — Global Type Definitions
 *
 * Domain types for telemetry packets, flight states, and connection management.
 * These mirror the Rust backend binary schemas (little-endian).
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

/* ── Rocket Avionics Packet (36 bytes on wire) ── */
export interface RocketAvionicsPacket {
  packetId: number;
  timestamp: number;        // ms since boot
  altitude: number;         // meters
  latitude: number;
  longitude: number;
  pressure1: number;        // hPa
  pressure2: number;        // hPa
  velocity: number;         // m/s
  flightState: FlightState;
  primaryParachuteDeployed: boolean;
  secondaryParachuteDeployed: boolean;
  receivedAt: number;       // frontend timestamp (Date.now())
}

/* ── Payload Scientific Packet (24 bytes on wire) ── */
export interface PayloadScientificPacket {
  packetId: number;
  timestamp: number;        // ms since boot
  latitude: number;
  longitude: number;
  altitude: number;         // meters
  scientificSensorData: number;
  receivedAt: number;       // frontend timestamp (Date.now())
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
  rocketPort: {
    status: ConnectionStatus;
    path: string | null;
    baudRate: number;
    packetsReceived: number;
    checksumFailures: number;
    lastPacketAt: number | null;
  };
  payloadPort: {
    status: ConnectionStatus;
    path: string | null;
    baudRate: number;
    packetsReceived: number;
    checksumFailures: number;
    lastPacketAt: number | null;
  };
  mockMode: boolean;
}
