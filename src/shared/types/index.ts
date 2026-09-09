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

/* ── Drone Flight State Enum (CC) ── */
export enum DroneFlightState {
  Standby = 0,
  Launched = 1,
  Descending = 2,
  Landed = 3,
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
  /* ── Drone flight-control fields (CC only, 0/false for AA/BB) ── */
  relAlt: number;              // relative altitude above takeoff (m)
  verticalVelocity: number;    // climb rate (m/s, + up)
  gForce: number;              // G-loading (g)
  dpdt: number;                // pressure change rate (hPa/s)
  armed: boolean;              // RF ARM command state
  stateCode: number;           // 0=STANDBY, 1=LAUNCHED, 2=DESCENDING, 3=LANDED
  throttleUs: number;          // ESC 1 pulse width (1000..2000 us)
  esc2Us?: number;             // ESC 2 pulse width (1000..2000 us)
  /* ── Payload status fields (BB only) ── */
  onGround: boolean;           // true = payload landed, false = in sky
  flightPhase: number;         // 0=PRE_LAUNCH, 1=IN_AIR, 2=ON_GROUND
  /* ── Firmware extension fields (BB & CC & AA) ── */
  fastG: number;               // Fast transient accelerometer filter (g)
  outputsActive: boolean;      // Live actuator output state (ESC / Buzzer firing)
  bnoCalib?: number;           // BNO055 sensor calibration state (0..3)
  flags?: number;              // Sensor health & status bitflags
  receivedAt: number;          // frontend timestamp (Date.now())
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
