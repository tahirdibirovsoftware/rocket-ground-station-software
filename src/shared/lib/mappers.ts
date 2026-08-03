/**
 * Mappers — transform Rust snake_case JSON into frontend camelCase interfaces.
 */
import type { TelemetryPacket } from "@shared/types";
import { FlightState } from "@shared/types";

interface RawTelemetryPacket {
  header: string;
  timestamp_ms: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  mag_x: number;
  mag_y: number;
  mag_z: number;
  temp: number;
  pressure: number;
  humidity: number;
  altitude: number;
  aht_temp: number;
  aht_hum: number;
  latitude: number;
  longitude: number;
  gps_altitude: number;
  gps_speed: number;
  gps_course: number;
  roll: number;
  pitch: number;
  yaw: number;
  flight_state: string;
  primary_parachute_deployed: boolean;
  secondary_parachute_deployed: boolean;
}

const FLIGHT_STATE_MAP: Record<string, FlightState> = {
  pad: FlightState.Pad,
  powered: FlightState.Powered,
  unpowered: FlightState.Unpowered,
  apogee: FlightState.Apogee,
  primary_chute: FlightState.PrimaryChute,
  secondary_chute: FlightState.SecondaryChute,
};

/** Map a raw Rust telemetry packet to the frontend interface. */
export function mapTelemetryPacket(raw: RawTelemetryPacket): TelemetryPacket {
  return {
    header: raw.header,
    timestampMs: raw.timestamp_ms,
    accelX: raw.accel_x,
    accelY: raw.accel_y,
    accelZ: raw.accel_z,
    gyroX: raw.gyro_x,
    gyroY: raw.gyro_y,
    gyroZ: raw.gyro_z,
    magX: raw.mag_x,
    magY: raw.mag_y,
    magZ: raw.mag_z,
    temp: raw.temp,
    pressure: raw.pressure,
    humidity: raw.humidity,
    altitude: raw.altitude,
    ahtTemp: raw.aht_temp,
    ahtHum: raw.aht_hum,
    latitude: raw.latitude,
    longitude: raw.longitude,
    gpsAltitude: raw.gps_altitude,
    gpsSpeed: raw.gps_speed,
    gpsCourse: raw.gps_course,
    roll: raw.roll,
    pitch: raw.pitch,
    yaw: raw.yaw,
    flightState: FLIGHT_STATE_MAP[raw.flight_state] ?? FlightState.Pad,
    primaryParachuteDeployed: raw.primary_parachute_deployed,
    secondaryParachuteDeployed: raw.secondary_parachute_deployed,
    receivedAt: Date.now(),
  };
}
