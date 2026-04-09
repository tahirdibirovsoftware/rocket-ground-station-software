/**
 * Mappers — transform Rust snake_case JSON into frontend camelCase interfaces.
 *
 * The Rust backend serializes with serde (snake_case), but the frontend
 * TypeScript interfaces use camelCase. These mappers bridge the gap.
 */
import type { RocketAvionicsPacket, PayloadScientificPacket } from "@shared/types";
import { FlightState } from "@shared/types";

/** Raw rocket packet shape from Rust serde JSON. */
interface RawRocketPacket {
  packet_id: number;
  timestamp_ms: number;
  altitude: number;
  latitude: number;
  longitude: number;
  pressure1: number;
  pressure2: number;
  velocity: number;
  flight_state: string;
  primary_parachute_deployed: boolean;
  secondary_parachute_deployed: boolean;
}

/** Raw payload packet shape from Rust serde JSON. */
interface RawPayloadPacket {
  packet_id: number;
  timestamp_ms: number;
  latitude: number;
  longitude: number;
  altitude: number;
  scientific_data: number;
}

const FLIGHT_STATE_MAP: Record<string, FlightState> = {
  pad: FlightState.Pad,
  powered: FlightState.Powered,
  unpowered: FlightState.Unpowered,
  apogee: FlightState.Apogee,
  primary_chute: FlightState.PrimaryChute,
  secondary_chute: FlightState.SecondaryChute,
};

/** Map a raw Rust rocket packet to the frontend interface. */
export function mapRocketPacket(raw: RawRocketPacket): RocketAvionicsPacket {
  return {
    packetId: raw.packet_id,
    timestamp: raw.timestamp_ms,
    altitude: raw.altitude,
    latitude: raw.latitude,
    longitude: raw.longitude,
    pressure1: raw.pressure1,
    pressure2: raw.pressure2,
    velocity: raw.velocity,
    flightState: FLIGHT_STATE_MAP[raw.flight_state] ?? FlightState.Pad,
    primaryParachuteDeployed: raw.primary_parachute_deployed,
    secondaryParachuteDeployed: raw.secondary_parachute_deployed,
    receivedAt: Date.now(),
  };
}

/** Map a raw Rust payload packet to the frontend interface. */
export function mapPayloadPacket(raw: RawPayloadPacket): PayloadScientificPacket {
  return {
    packetId: raw.packet_id,
    timestamp: raw.timestamp_ms,
    latitude: raw.latitude,
    longitude: raw.longitude,
    altitude: raw.altitude,
    scientificSensorData: raw.scientific_data,
    receivedAt: Date.now(),
  };
}
