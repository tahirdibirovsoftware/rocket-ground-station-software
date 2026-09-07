/**
 * Unit tests for resolveMissionStream
 *
 * Verifies automatic switching between Rocket (AA), Drone (CC), and Payload (BB)
 * streams based on competition flight phases, sensor triggers, and manual overrides.
 */
import { describe, it, expect } from "vitest";
import { resolveMissionStream } from "./missionStream";
import { FlightState, type TelemetryPacket } from "@shared/types";

const mockRocketPacket = (overrides: Partial<TelemetryPacket> = {}): TelemetryPacket => ({
  header: "AA",
  timestampMs: 1000,
  accelX: 0,
  accelY: 0,
  accelZ: 9.8,
  gyroX: 0,
  gyroY: 0,
  gyroZ: 0,
  magX: 0,
  magY: 0,
  magZ: 0,
  temp: 20,
  pressure: 1013.25,
  humidity: 50,
  altitude: 100,
  ahtTemp: 20,
  ahtHum: 50,
  latitude: 39.9,
  longitude: 32.8,
  gpsAltitude: 100,
  gpsSpeed: 0,
  gpsCourse: 0,
  roll: 0,
  pitch: 0,
  yaw: 0,
  flightState: FlightState.Pad,
  primaryParachuteDeployed: false,
  secondaryParachuteDeployed: false,
  relAlt: 0,
  verticalVelocity: 0,
  gForce: 1,
  dpdt: 0,
  armed: false,
  stateCode: 0,
  throttleUs: 1000,
  onGround: true,
  flightPhase: 0,
  fastG: 1,
  outputsActive: false,
  receivedAt: 1000,
  ...overrides,
});

describe("resolveMissionStream", () => {
  describe("Manual Mode", () => {
    it("respects manual rocket selection regardless of mission state", () => {
      const result = resolveMissionStream({
        streamSource: "rocket",
        rocketCount: 10,
        payloadCount: 10,
        droneCount: 10,
        latestRocket: mockRocketPacket({ flightState: FlightState.Apogee }),
      });
      expect(result.activeStream).toBe("rocket");
      expect(result.missionStage).toBe("manual");
    });

    it("respects manual drone selection", () => {
      const result = resolveMissionStream({
        streamSource: "drone",
        rocketCount: 10,
        payloadCount: 0,
        droneCount: 10,
        latestRocket: mockRocketPacket({ flightState: FlightState.Pad }),
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("manual");
    });

    it("respects manual payload selection", () => {
      const result = resolveMissionStream({
        streamSource: "payload",
        rocketCount: 10,
        payloadCount: 10,
        droneCount: 0,
        latestRocket: mockRocketPacket({ flightState: FlightState.Powered }),
      });
      expect(result.activeStream).toBe("payload");
      expect(result.missionStage).toBe("manual");
    });
  });

  describe("Single Stream Bench Testing Fallback", () => {
    it("selects drone if only drone telemetry is streaming", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 0,
        payloadCount: 0,
        droneCount: 5,
        latestRocket: null,
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("standby");
    });

    it("selects payload if only payload telemetry is streaming", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 0,
        payloadCount: 8,
        droneCount: 0,
        latestRocket: null,
      });
      expect(result.activeStream).toBe("payload");
      expect(result.missionStage).toBe("standby");
    });

    it("defaults to rocket on standby if 0 packets received", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 0,
        payloadCount: 0,
        droneCount: 0,
        latestRocket: null,
      });
      expect(result.activeStream).toBe("rocket");
      expect(result.missionStage).toBe("standby");
    });
  });

  describe("Mission-Aware Auto Progression", () => {
    it("selects rocket during Pad phase", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 20,
        payloadCount: 10,
        droneCount: 10,
        latestRocket: mockRocketPacket({ flightState: FlightState.Pad }),
        droneStatus: { stateCode: 0, throttleUs: 1000, armed: false, flightPhase: 0, outputsActive: false },
        payloadStatus: { onGround: true, flightPhase: 0, outputsActive: false },
      });
      expect(result.activeStream).toBe("rocket");
      expect(result.missionStage).toBe("standby");
    });

    it("selects rocket during Powered ascent phase", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 50,
        payloadCount: 20,
        droneCount: 20,
        latestRocket: mockRocketPacket({ flightState: FlightState.Powered }),
        droneStatus: { stateCode: 0, throttleUs: 1000, armed: false, flightPhase: 0, outputsActive: false },
      });
      expect(result.activeStream).toBe("rocket");
      expect(result.missionStage).toBe("ascent");
    });

    it("selects rocket during Unpowered coast to apogee", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 80,
        payloadCount: 30,
        droneCount: 30,
        latestRocket: mockRocketPacket({ flightState: FlightState.Unpowered }),
        droneStatus: { stateCode: 0, throttleUs: 1000, armed: false, flightPhase: 0, outputsActive: false },
      });
      expect(result.activeStream).toBe("rocket");
      expect(result.missionStage).toBe("ascent");
    });

    it("automatically switches to drone when rocket reaches Apogee", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 120,
        payloadCount: 50,
        droneCount: 50,
        latestRocket: mockRocketPacket({ flightState: FlightState.Apogee }),
        droneStatus: { stateCode: 1, throttleUs: 1480, armed: true, flightPhase: 1, outputsActive: true },
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("descent");
    });

    it("automatically switches to drone when primary parachute deploys", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 130,
        payloadCount: 60,
        droneCount: 60,
        latestRocket: mockRocketPacket({
          flightState: FlightState.PrimaryChute,
          primaryParachuteDeployed: true,
        }),
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("descent");
    });

    it("switches to drone if drone reports IN_AIR (flightPhase = 1) even before rocket apogee packet arrives", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 100,
        payloadCount: 40,
        droneCount: 40,
        latestRocket: mockRocketPacket({ flightState: FlightState.Unpowered }),
        droneStatus: { stateCode: 1, throttleUs: 1480, armed: true, flightPhase: 1, outputsActive: true },
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("descent");
    });

    it("switches to payload at apogee if drone is not transmitting", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 150,
        payloadCount: 80,
        droneCount: 0, // Drone not streaming
        latestRocket: mockRocketPacket({ flightState: FlightState.Apogee }),
        payloadStatus: { onGround: false, flightPhase: 1, outputsActive: true },
      });
      expect(result.activeStream).toBe("payload");
      expect(result.missionStage).toBe("descent");
    });

    it("detects drone touchdown and sets mission stage to touchdown", () => {
      const result = resolveMissionStream({
        streamSource: "auto",
        rocketCount: 300,
        payloadCount: 100,
        droneCount: 150,
        latestRocket: mockRocketPacket({ flightState: FlightState.SecondaryChute }),
        droneStatus: { stateCode: 4, throttleUs: 1000, armed: false, flightPhase: 2, outputsActive: false },
      });
      expect(result.activeStream).toBe("drone");
      expect(result.missionStage).toBe("touchdown");
    });
  });
});
