/**
 * Mission-Aware Stream Resolver
 *
 * Automatically resolves the optimal telemetry chart stream (Rocket AA, Payload BB,
 * or Drone CC) based on real-time flight mission states, deployment events, and overrides.
 *
 * Flight Mission Logic:
 * - Standby / Pad: Rocket on pad -> ROCKET (AA)
 * - Ascent (Powered / Unpowered): Rocket climbing -> ROCKET (AA)
 * - Apogee / Separation: Rocket at apogee / chute deploy / drone in air -> DRONE (CC) (or PAYLOAD (BB))
 * - Descent / Recovery: Drone descent / touchdown -> DRONE (CC)
 * - Bench Test Fallback: Only one vehicle streaming -> that vehicle
 * - Manual Override: User explicitly clicked a specific stream button
 */
import { FlightState, type TelemetryPacket } from "@shared/types";
import type { DroneStatusState } from "@entities/drone-packet/model/droneTelemetrySlice";
import type { PayloadStatusState } from "@entities/payload-packet/model/payloadTelemetrySlice";

export type StreamSourceMode = "auto" | "rocket" | "payload" | "drone";
export type ActiveStream = "rocket" | "payload" | "drone";
export type MissionStage = "standby" | "ascent" | "apogee" | "descent" | "touchdown" | "manual";

export interface StreamResolutionInput {
  streamSource: StreamSourceMode;
  rocketCount: number;
  payloadCount: number;
  droneCount: number;
  latestRocket: TelemetryPacket | null;
  droneStatus?: DroneStatusState | null;
  payloadStatus?: PayloadStatusState | null;
}

export interface StreamResolutionResult {
  activeStream: ActiveStream;
  missionStage: MissionStage;
  reason: string;
}

/**
 * Resolves the active telemetry stream and associated mission flight stage.
 */
export function resolveMissionStream(input: StreamResolutionInput): StreamResolutionResult {
  const {
    streamSource,
    rocketCount,
    payloadCount,
    droneCount,
    latestRocket,
    droneStatus,
    payloadStatus,
  } = input;

  // 1. Manual User Override
  if (streamSource !== "auto") {
    return {
      activeStream: streamSource,
      missionStage: "manual",
      reason: "manual_override",
    };
  }

  // 2. Single-stream test bench or isolated transmission
  if (rocketCount === 0) {
    if (droneCount > 0) {
      return {
        activeStream: "drone",
        missionStage: "standby",
        reason: "single_stream_drone",
      };
    }
    if (payloadCount > 0) {
      return {
        activeStream: "payload",
        missionStage: "standby",
        reason: "single_stream_payload",
      };
    }
    return {
      activeStream: "rocket",
      missionStage: "standby",
      reason: "awaiting_telemetry",
    };
  }

  // 3. Multi-stream mission phase detection
  // Check if Drone indicates separation or active descent/flight
  const isDroneSeparatedOrActive = Boolean(
    droneStatus &&
      (droneStatus.flightPhase === 1 ||
        droneStatus.outputsActive === true ||
        droneStatus.armed === true ||
        (droneStatus.stateCode != null && droneStatus.stateCode >= 1))
  );

  // Check if Payload indicates separation or active descent
  const isPayloadSeparatedOrActive = Boolean(
    payloadStatus &&
      (payloadStatus.flightPhase === 1 || payloadStatus.outputsActive === true)
  );

  // Check if Rocket has reached Apogee or parachute deployment
  const isRocketAtApogeeOrBeyond = Boolean(
    latestRocket &&
      (latestRocket.flightState >= FlightState.Apogee ||
        latestRocket.primaryParachuteDeployed ||
        latestRocket.secondaryParachuteDeployed)
  );

  const isPostApogeeOrSeparated =
    isRocketAtApogeeOrBeyond || isDroneSeparatedOrActive || isPayloadSeparatedOrActive;

  if (isPostApogeeOrSeparated) {
    // If drone is transmitting, prioritize drone descent/flight control
    if (droneCount > 0) {
      const isTouchdown =
        droneStatus?.stateCode === 3 ||
        droneStatus?.stateCode === 4 ||
        droneStatus?.flightPhase === 2;
      return {
        activeStream: "drone",
        missionStage: isTouchdown ? "touchdown" : "descent",
        reason: isTouchdown ? "drone_touchdown" : "drone_active_descent",
      };
    }

    // If drone not present but payload transmitting, show payload
    if (payloadCount > 0) {
      const isTouchdown =
        payloadStatus?.flightPhase === 2 || payloadStatus?.onGround === true;
      return {
        activeStream: "payload",
        missionStage: isTouchdown ? "touchdown" : "descent",
        reason: isTouchdown ? "payload_touchdown" : "payload_active_descent",
      };
    }

    // Rocket only during descent
    return {
      activeStream: "rocket",
      missionStage:
        latestRocket?.flightState === FlightState.Apogee ? "apogee" : "descent",
      reason: "rocket_descent_no_subvehicle",
    };
  }

  // 4. Pre-Apogee / Ascent phase
  const flightState = latestRocket?.flightState ?? FlightState.Pad;
  if (flightState === FlightState.Pad) {
    return {
      activeStream: "rocket",
      missionStage: "standby",
      reason: "rocket_pad_ready",
    };
  }

  return {
    activeStream: "rocket",
    missionStage: "ascent",
    reason:
      flightState === FlightState.Powered
        ? "rocket_powered_ascent"
        : "rocket_unpowered_coast",
  };
}
