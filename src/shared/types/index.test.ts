import { describe, it, expect } from "vitest";
import {
  FlightState,
  DroneFlightState,
  ConnectionStatus,
} from "@shared/types";
import {
  IPC_EVENTS,
  ROUTES,
  SUPPORTED_LOCALES,
  PACKET_START_BYTES,
} from "@shared/config/constants";

describe("Shared Types", () => {
  it("FlightState enum has correct numeric values", () => {
    expect(FlightState.Pad).toBe(0);
    expect(FlightState.Powered).toBe(1);
    expect(FlightState.Unpowered).toBe(2);
    expect(FlightState.Apogee).toBe(3);
    expect(FlightState.PrimaryChute).toBe(4);
    expect(FlightState.SecondaryChute).toBe(5);
  });

  it("DroneFlightState enum has correct numeric values", () => {
    expect(DroneFlightState.Standby).toBe(0);
    expect(DroneFlightState.Launched).toBe(1);
    expect(DroneFlightState.Descending).toBe(2);
    expect(DroneFlightState.Landed).toBe(3);
  });

  it("ConnectionStatus has correct string values", () => {
    expect(ConnectionStatus.Disconnected).toBe("disconnected");
    expect(ConnectionStatus.Connected).toBe("connected");
    expect(ConnectionStatus.Connecting).toBe("connecting");
    expect(ConnectionStatus.Error).toBe("error");
  });
});

describe("Shared Constants", () => {
  it("IPC event names are defined", () => {
    expect(IPC_EVENTS.ROCKET_TELEMETRY).toBe("rocket-telemetry");
    expect(IPC_EVENTS.PAYLOAD_TELEMETRY).toBe("payload-telemetry");
    expect(IPC_EVENTS.CONNECTION_STATUS).toBe("connection-status");
  });

  it("route paths are defined", () => {
    expect(ROUTES.TEAM_DASHBOARD).toBe("/dashboard/team");
    expect(ROUTES.REFEREE_DASHBOARD).toBe("/dashboard/referee");
  });

  it("supports 4 locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(4);
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("az");
    expect(SUPPORTED_LOCALES).toContain("tr");
    expect(SUPPORTED_LOCALES).toContain("ru");
  });

  it("packet start bytes match protocol spec", () => {
    expect(PACKET_START_BYTES.ROCKET_AVIONICS).toBe(0xaa);
    expect(PACKET_START_BYTES.PAYLOAD_SCIENTIFIC).toBe(0xbb);
  });
});
