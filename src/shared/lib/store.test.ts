/**
 * Tests for Phase 5 — Redux Store & Data Layer
 *
 * Covers:
 * - CircularBuffer: push, toArray, latest, overflow, clear
 * - Mappers: snake_case → camelCase for both packet types
 * - Rocket slice: packet received, history cap, reset
 * - Payload slice: packet received, history cap, reset
 * - Connection slice: status update, loading, error, reset
 * - Store: integration test with all slices
 */
import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

import { CircularBuffer } from "@shared/lib/CircularBuffer";
import { mapRocketPacket, mapPayloadPacket } from "@shared/lib/mappers";
import { FlightState } from "@shared/types";

import rocketTelemetryReducer, {
  rocketPacketReceived,
  rocketTelemetryReset,
} from "@entities/rocket-packet/model/rocketTelemetrySlice";

import payloadTelemetryReducer, {
  payloadPacketReceived,
  payloadTelemetryReset,
} from "@entities/payload-packet/model/payloadTelemetrySlice";

import connectionReducer, {
  connectionStatusUpdated,
  connectionLoading,
  connectionError,
  connectionReset,
} from "@entities/connection/model/connectionSlice";

// ============================================================================
// CircularBuffer Tests
// ============================================================================

describe("CircularBuffer", () => {
  it("starts empty", () => {
    const buf = new CircularBuffer<number>(5);
    expect(buf.size()).toBe(0);
    expect(buf.latest()).toBeUndefined();
    expect(buf.toArray()).toEqual([]);
    expect(buf.isFull()).toBe(false);
  });

  it("pushes and retrieves items in order", () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.latest()).toBe(3);
    expect(buf.size()).toBe(3);
  });

  it("overwrites oldest when full", () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.isFull()).toBe(true);

    buf.push(4); // overwrites 1
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.latest()).toBe(4);
    expect(buf.size()).toBe(3);
  });

  it("handles wrapping multiple times", () => {
    const buf = new CircularBuffer<number>(3);
    for (let i = 1; i <= 10; i++) {
      buf.push(i);
    }
    expect(buf.toArray()).toEqual([8, 9, 10]);
    expect(buf.latest()).toBe(10);
  });

  it("clears properly", () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.size()).toBe(0);
    expect(buf.toArray()).toEqual([]);
    expect(buf.latest()).toBeUndefined();
  });

  it("reports capacity", () => {
    const buf = new CircularBuffer<string>(42);
    expect(buf.getCapacity()).toBe(42);
  });

  it("throws on invalid capacity", () => {
    expect(() => new CircularBuffer(0)).toThrow();
    expect(() => new CircularBuffer(-1)).toThrow();
  });

  it("works with capacity of 1", () => {
    const buf = new CircularBuffer<number>(1);
    buf.push(10);
    expect(buf.latest()).toBe(10);
    expect(buf.toArray()).toEqual([10]);
    buf.push(20);
    expect(buf.latest()).toBe(20);
    expect(buf.toArray()).toEqual([20]);
    expect(buf.size()).toBe(1);
  });
});

// ============================================================================
// Mapper Tests
// ============================================================================

describe("Mappers", () => {
  it("maps raw rocket packet to frontend interface", () => {
    const raw = {
      packet_id: 1,
      timestamp_ms: 5000,
      altitude: 1500.0,
      latitude: 38.3687,
      longitude: 34.037,
      pressure1: 850.0,
      pressure2: 849.5,
      velocity: 200.0,
      flight_state: "powered",
      primary_parachute_deployed: false,
      secondary_parachute_deployed: false,
    };

    const mapped = mapRocketPacket(raw);
    expect(mapped.packetId).toBe(1);
    expect(mapped.timestamp).toBe(5000);
    expect(mapped.altitude).toBe(1500.0);
    expect(mapped.flightState).toBe(FlightState.Powered);
    expect(mapped.primaryParachuteDeployed).toBe(false);
    expect(mapped.receivedAt).toBeGreaterThan(0);
  });

  it("maps all flight states correctly", () => {
    const states: [string, FlightState][] = [
      ["pad", FlightState.Pad],
      ["powered", FlightState.Powered],
      ["unpowered", FlightState.Unpowered],
      ["apogee", FlightState.Apogee],
      ["primary_chute", FlightState.PrimaryChute],
      ["secondary_chute", FlightState.SecondaryChute],
    ];

    for (const [raw, expected] of states) {
      const pkt = mapRocketPacket({
        packet_id: 1,
        timestamp_ms: 0,
        altitude: 0,
        latitude: 0,
        longitude: 0,
        pressure1: 0,
        pressure2: 0,
        velocity: 0,
        flight_state: raw,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
      });
      expect(pkt.flightState).toBe(expected);
    }
  });

  it("maps raw payload packet to frontend interface", () => {
    const raw = {
      packet_id: 2,
      timestamp_ms: 67890,
      latitude: 39.91,
      longitude: 32.86,
      altitude: 850.25,
      scientific_data: 23.456,
    };

    const mapped = mapPayloadPacket(raw);
    expect(mapped.packetId).toBe(2);
    expect(mapped.timestamp).toBe(67890);
    expect(mapped.scientificSensorData).toBe(23.456);
    expect(mapped.receivedAt).toBeGreaterThan(0);
  });
});

// ============================================================================
// Rocket Telemetry Slice Tests
// ============================================================================

const sampleRocketPacket = {
  packetId: 1,
  timestamp: 5000,
  altitude: 1500.0,
  latitude: 38.3687,
  longitude: 34.037,
  pressure1: 850.0,
  pressure2: 849.5,
  velocity: 200.0,
  flightState: FlightState.Powered,
  primaryParachuteDeployed: false,
  secondaryParachuteDeployed: false,
  receivedAt: Date.now(),
};

describe("rocketTelemetrySlice", () => {
  it("has correct initial state", () => {
    const state = rocketTelemetryReducer(undefined, { type: "init" });
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
  });

  it("stores received packet as latest", () => {
    const state = rocketTelemetryReducer(
      undefined,
      rocketPacketReceived(sampleRocketPacket),
    );
    expect(state.latest).toEqual(sampleRocketPacket);
    expect(state.packetCount).toBe(1);
    expect(state.history).toHaveLength(1);
  });

  it("caps history at ROCKET_BUFFER_SIZE (600)", () => {
    let state = rocketTelemetryReducer(undefined, { type: "init" });
    for (let i = 0; i < 650; i++) {
      state = rocketTelemetryReducer(
        state,
        rocketPacketReceived({ ...sampleRocketPacket, timestamp: i }),
      );
    }
    expect(state.history.length).toBeLessThanOrEqual(600);
    expect(state.packetCount).toBe(650);
    // Oldest should be trimmed
    expect(state.history[0].timestamp).toBeGreaterThanOrEqual(50);
  });

  it("resets to initial state", () => {
    let state = rocketTelemetryReducer(
      undefined,
      rocketPacketReceived(sampleRocketPacket),
    );
    expect(state.packetCount).toBe(1);

    state = rocketTelemetryReducer(state, rocketTelemetryReset());
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
  });
});

// ============================================================================
// Payload Telemetry Slice Tests
// ============================================================================

const samplePayloadPacket = {
  packetId: 2,
  timestamp: 67890,
  latitude: 39.91,
  longitude: 32.86,
  altitude: 850.25,
  scientificSensorData: 23.456,
  receivedAt: Date.now(),
};

describe("payloadTelemetrySlice", () => {
  it("has correct initial state", () => {
    const state = payloadTelemetryReducer(undefined, { type: "init" });
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
  });

  it("stores received packet as latest", () => {
    const state = payloadTelemetryReducer(
      undefined,
      payloadPacketReceived(samplePayloadPacket),
    );
    expect(state.latest).toEqual(samplePayloadPacket);
    expect(state.packetCount).toBe(1);
  });

  it("caps history at PAYLOAD_BUFFER_SIZE (3000)", () => {
    let state = payloadTelemetryReducer(undefined, { type: "init" });
    for (let i = 0; i < 3050; i++) {
      state = payloadTelemetryReducer(
        state,
        payloadPacketReceived({ ...samplePayloadPacket, timestamp: i }),
      );
    }
    expect(state.history.length).toBeLessThanOrEqual(3000);
    expect(state.packetCount).toBe(3050);
  });

  it("resets to initial state", () => {
    let state = payloadTelemetryReducer(
      undefined,
      payloadPacketReceived(samplePayloadPacket),
    );
    state = payloadTelemetryReducer(state, payloadTelemetryReset());
    expect(state.latest).toBeNull();
    expect(state.packetCount).toBe(0);
  });
});

// ============================================================================
// Connection Slice Tests
// ============================================================================

describe("connectionSlice", () => {
  it("has correct initial state", () => {
    const state = connectionReducer(undefined, { type: "init" });
    expect(state.mode).toBe("disconnected");
    expect(state.rocketPort).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("updates from backend connection status", () => {
    const backendStatus = {
      mode: "mock" as const,
      rocket_port: null,
      payload_port: null,
      rocket_packets_received: 42,
      payload_packets_received: 210,
      checksum_failures: 3,
      uptime_ms: 60000,
    };

    const state = connectionReducer(
      undefined,
      connectionStatusUpdated(backendStatus),
    );
    expect(state.mode).toBe("mock");
    expect(state.rocketPacketsReceived).toBe(42);
    expect(state.payloadPacketsReceived).toBe(210);
    expect(state.checksumFailures).toBe(3);
    expect(state.uptimeMs).toBe(60000);
    expect(state.isLoading).toBe(false);
  });

  it("sets loading state", () => {
    const state = connectionReducer(undefined, connectionLoading());
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("sets error state", () => {
    const state = connectionReducer(
      undefined,
      connectionError("Port not found"),
    );
    expect(state.error).toBe("Port not found");
    expect(state.isLoading).toBe(false);
  });

  it("resets to initial state", () => {
    let state = connectionReducer(undefined, connectionLoading());
    state = connectionReducer(state, connectionReset());
    expect(state.mode).toBe("disconnected");
    expect(state.isLoading).toBe(false);
  });
});

// ============================================================================
// Store Integration Test
// ============================================================================

describe("Redux Store Integration", () => {
  it("creates store with all slices", () => {
    const testStore = configureStore({
      reducer: {
        rocketTelemetry: rocketTelemetryReducer,
        payloadTelemetry: payloadTelemetryReducer,
        connection: connectionReducer,
      },
    });

    const state = testStore.getState();
    expect(state.rocketTelemetry.latest).toBeNull();
    expect(state.payloadTelemetry.latest).toBeNull();
    expect(state.connection.mode).toBe("disconnected");
  });

  it("dispatches across slices independently", () => {
    const testStore = configureStore({
      reducer: {
        rocketTelemetry: rocketTelemetryReducer,
        payloadTelemetry: payloadTelemetryReducer,
        connection: connectionReducer,
      },
    });

    testStore.dispatch(rocketPacketReceived(sampleRocketPacket));
    testStore.dispatch(payloadPacketReceived(samplePayloadPacket));
    testStore.dispatch(
      connectionStatusUpdated({
        mode: "mock",
        rocket_port: null,
        payload_port: null,
        rocket_packets_received: 1,
        payload_packets_received: 1,
        checksum_failures: 0,
        uptime_ms: 1000,
      }),
    );

    const state = testStore.getState();
    expect(state.rocketTelemetry.packetCount).toBe(1);
    expect(state.payloadTelemetry.packetCount).toBe(1);
    expect(state.connection.mode).toBe("mock");
  });
});
