/**
 * Tests for Phase 5 — Redux Store & Data Layer
 */
import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

import { CircularBuffer } from "@shared/lib/CircularBuffer";
import { mapTelemetryPacket } from "@shared/lib/mappers";
import { FlightState } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

import rocketTelemetryReducer, {
  rocketPacketReceived,
  rocketPacketsReceived,
  rocketTelemetryReset,
} from "@entities/rocket-packet/model/rocketTelemetrySlice";

import payloadTelemetryReducer, {
  payloadPacketReceived,
  payloadPacketsReceived,
  payloadStatusReceived,
} from "@entities/payload-packet/model/payloadTelemetrySlice";
import { selectPayloadAltitudeHistory } from "@entities/payload-packet";

import droneTelemetryReducer, {
  dronePacketReceived,
  dronePacketsReceived,
  droneStatusReceived,
} from "@entities/drone-packet/model/droneTelemetrySlice";

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
      header: "AA",
      timestamp_ms: 5000,
      accel_x: 0.12,
      accel_y: -0.05,
      accel_z: 9.8,
      gyro_x: 0.01,
      gyro_y: -0.02,
      gyro_z: 0.005,
      mag_x: 12.5,
      mag_y: -8.2,
      mag_z: 42.1,
      temp: 24.5,
      pressure: 1013.2,
      humidity: 45.0,
      altitude: 1500.0,
      aht_temp: 24.2,
      aht_hum: 46.5,
      latitude: 38.3687,
      longitude: 34.037,
      gps_altitude: 1500.0,
      gps_speed: 200.0,
      gps_course: 180.0,
      roll: 12.0,
      pitch: 5.0,
      yaw: 90.0,
      flight_state: "powered",
      primary_parachute_deployed: false,
      secondary_parachute_deployed: false,
    };

    const mapped = mapTelemetryPacket(raw);
    expect(mapped.header).toBe("AA");
    expect(mapped.timestampMs).toBe(5000);
    expect(mapped.altitude).toBe(1500.0);
    expect(mapped.flightState).toBe(FlightState.Powered);
    expect(mapped.primaryParachuteDeployed).toBe(false);
    expect(mapped.receivedAt).toBeGreaterThan(0);
    // Non-drone packets default the flight-control fields
    expect(mapped.armed).toBe(false);
    expect(mapped.stateCode).toBe(0);
    expect(mapped.throttleUs).toBe(0);
  });

  it("maps drone flight-control fields from raw packet", () => {
    const raw = {
      header: "CC",
      timestamp_ms: 66000,
      accel_x: 0.01,
      accel_y: 0.01,
      accel_z: 9.8,
      gyro_x: 0.002,
      gyro_y: 0.003,
      gyro_z: 0.001,
      mag_x: 11.2,
      mag_y: -8.9,
      mag_z: 41.5,
      temp: 25.1,
      pressure: 960.0,
      humidity: 42.0,
      altitude: 48.5,
      aht_temp: 24.8,
      aht_hum: 43.5,
      latitude: 38.3695,
      longitude: 34.0362,
      gps_altitude: 48.5,
      gps_speed: 3.5,
      gps_course: 90.0,
      roll: 1.2,
      pitch: -0.8,
      yaw: 180.0,
      flight_state: "pad",
      primary_parachute_deployed: false,
      secondary_parachute_deployed: false,
      rel_alt: 48.52,
      vertical_velocity: -3.02,
      g_force: 1.03,
      dpdt: 0.36,
      armed: true,
      state_code: 2,
      throttle_us: 1650,
      esc2_us: 1000,
    };

    const mapped = mapTelemetryPacket(raw);
    expect(mapped.header).toBe("CC");
    expect(mapped.relAlt).toBeCloseTo(48.52);
    expect(mapped.verticalVelocity).toBeCloseTo(-3.02);
    expect(mapped.gForce).toBeCloseTo(1.03);
    expect(mapped.dpdt).toBeCloseTo(0.36);
    expect(mapped.armed).toBe(true);
    expect(mapped.stateCode).toBe(2);
    expect(mapped.throttleUs).toBe(1650);
    expect(mapped.esc2Us).toBe(1000);
  });

  it("maps dual-ESC with fallback when esc2_us is absent", () => {
    const raw = {
      header: "CC",
      timestamp_ms: 5000,
      accel_x: 0,
      accel_y: 0,
      accel_z: 9.8,
      gyro_x: 0,
      gyro_y: 0,
      gyro_z: 0,
      mag_x: 0,
      mag_y: 0,
      mag_z: 0,
      temp: 25.0,
      pressure: 1013.2,
      humidity: 45.0,
      altitude: 50.0,
      aht_temp: 24.0,
      aht_hum: 46.0,
      latitude: 38.0,
      longitude: 34.0,
      gps_altitude: 50.0,
      gps_speed: 0,
      gps_course: 0,
      roll: 0,
      pitch: 0,
      yaw: 0,
      flight_state: "pad",
      primary_parachute_deployed: false,
      secondary_parachute_deployed: false,
      throttle_us: 1480,
    };
    const mapped = mapTelemetryPacket(raw);
    expect(mapped.throttleUs).toBe(1480);
    expect(mapped.esc2Us).toBe(1480);
  });

  it("maps payload status fields from raw packet", () => {
    const raw = {
      header: "BB",
      timestamp_ms: 15000,
      accel_x: -0.05,
      accel_y: 0.08,
      accel_z: 9.8,
      gyro_x: -0.01,
      gyro_y: 0.01,
      gyro_z: 0.02,
      mag_x: 10.4,
      mag_y: -9.5,
      mag_z: 40.0,
      temp: 25.0,
      pressure: 960.0,
      humidity: 50.0,
      altitude: 1200.0,
      aht_temp: 23.5,
      aht_hum: 51.0,
      latitude: 38.37,
      longitude: 34.038,
      gps_altitude: 1200.0,
      gps_speed: 12.5,
      gps_course: 180.0,
      roll: 2.0,
      pitch: 3.0,
      yaw: 4.0,
      flight_state: "pad",
      primary_parachute_deployed: false,
      secondary_parachute_deployed: false,
      rel_alt: 1198.5,
      vertical_velocity: -14.8,
      g_force: 1.02,
      dpdt: -1.77,
      on_ground: true,
      flight_phase: 2,
    };

    const mapped = mapTelemetryPacket(raw);
    expect(mapped.header).toBe("BB");
    expect(mapped.relAlt).toBeCloseTo(1198.5);
    expect(mapped.onGround).toBe(true);
    expect(mapped.flightPhase).toBe(2);
    expect(mapped.armed).toBe(false);
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
      const pkt = mapTelemetryPacket({
        header: "AA",
        timestamp_ms: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 0,
        gyro_x: 0,
        gyro_y: 0,
        gyro_z: 0,
        mag_x: 0,
        mag_y: 0,
        mag_z: 0,
        temp: 0,
        pressure: 0,
        humidity: 0,
        altitude: 0,
        aht_temp: 0,
        aht_hum: 0,
        latitude: 0,
        longitude: 0,
        gps_altitude: 0,
        gps_speed: 0,
        gps_course: 0,
        roll: 0,
        pitch: 0,
        yaw: 0,
        flight_state: raw,
        primary_parachute_deployed: false,
        secondary_parachute_deployed: false,
      });
      expect(pkt.flightState).toBe(expected);
    }
  });
});

// ============================================================================
// Telemetry Slices Tests
// ============================================================================

const sampleTelemetryPacket = {
  header: "AA",
  timestampMs: 5000,
  accelX: 0.12,
  accelY: -0.05,
  accelZ: 9.8,
  gyroX: 0.01,
  gyroY: -0.02,
  gyroZ: 0.005,
  magX: 12.5,
  magY: -8.2,
  magZ: 42.1,
  temp: 24.5,
  pressure: 1013.2,
  humidity: 45.0,
  altitude: 1500.0,
  ahtTemp: 24.2,
  ahtHum: 46.5,
  latitude: 38.3687,
  longitude: 34.037,
  gpsAltitude: 1500.0,
  gpsSpeed: 200.0,
  gpsCourse: 180.0,
  roll: 12.0,
  pitch: 5.0,
  yaw: 90.0,
  flightState: FlightState.Powered,
  primaryParachuteDeployed: false,
  secondaryParachuteDeployed: false,
  relAlt: 0,
  verticalVelocity: 0,
  gForce: 0,
  dpdt: 0,
  armed: false,
  stateCode: 0,
  throttleUs: 0,
  onGround: false,
  flightPhase: 0,
  fastG: 0,
  outputsActive: false,
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
      rocketPacketReceived(sampleTelemetryPacket),
    );
    expect(state.latest).toEqual(sampleTelemetryPacket);
    expect(state.packetCount).toBe(1);
    expect(state.history).toHaveLength(1);
  });

  it("caps history at ROCKET_BUFFER_SIZE (600)", () => {
    let state = rocketTelemetryReducer(undefined, { type: "init" });
    for (let i = 0; i < 650; i++) {
      state = rocketTelemetryReducer(
        state,
        rocketPacketReceived({ ...sampleTelemetryPacket, timestampMs: i }),
      );
    }
    expect(state.history.length).toBeLessThanOrEqual(600);
    expect(state.packetCount).toBe(650);
  });

  it("appends a batch of rocket packets efficiently", () => {
    const batch = [
      { ...sampleTelemetryPacket, timestampMs: 100 },
      { ...sampleTelemetryPacket, timestampMs: 200 },
      { ...sampleTelemetryPacket, timestampMs: 300 },
    ];
    const state = rocketTelemetryReducer(
      undefined,
      rocketPacketsReceived(batch),
    );
    expect(state.latest?.timestampMs).toBe(300);
    expect(state.packetCount).toBe(3);
    expect(state.history).toHaveLength(3);
    expect(state.history[2].timestampMs).toBe(300);
  });

  it("resets to initial state", () => {
    let state = rocketTelemetryReducer(
      undefined,
      rocketPacketReceived(sampleTelemetryPacket),
    );
    state = rocketTelemetryReducer(state, rocketTelemetryReset());
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
  });
});

describe("payloadTelemetrySlice", () => {
  it("has correct initial state", () => {
    const state = payloadTelemetryReducer(undefined, { type: "init" });
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
    expect(state.status).toEqual({
      onGround: null,
      flightPhase: null,
      outputsActive: null,
    });
  });

  it("stores received packet as latest", () => {
    const state = payloadTelemetryReducer(
      undefined,
      payloadPacketReceived(sampleTelemetryPacket),
    );
    expect(state.latest).toEqual(sampleTelemetryPacket);
    expect(state.packetCount).toBe(1);
    expect(state.history).toHaveLength(1);
  });

  it("updates payload status from status event", () => {
    let state = payloadTelemetryReducer(
      undefined,
      payloadPacketReceived(sampleTelemetryPacket),
    );
    state = payloadTelemetryReducer(
      state,
      payloadStatusReceived({ on_ground: true, flight_phase: 2, outputs_active: true }),
    );
    expect(state.status).toEqual({ onGround: true, flightPhase: 2, outputsActive: true });
    // Latest packet's phase and outputs are kept in sync
    expect(state.latest?.onGround).toBe(true);
    expect(state.latest?.flightPhase).toBe(2);
    expect(state.latest?.outputsActive).toBe(true);
  });

  it("appends a batch of payload packets efficiently", () => {
    const batch = [
      { ...sampleTelemetryPacket, timestampMs: 100, temp: 21.0 },
      { ...sampleTelemetryPacket, timestampMs: 200, temp: 22.0 },
    ];
    const state = payloadTelemetryReducer(
      undefined,
      payloadPacketsReceived(batch),
    );
    expect(state.latest?.temp).toBe(22.0);
    expect(state.packetCount).toBe(2);
    expect(state.history).toHaveLength(2);
  });

  it("caps history at PAYLOAD_BUFFER_SIZE (3000)", () => {
    let state = payloadTelemetryReducer(undefined, { type: "init" });
    for (let i = 0; i < 3050; i++) {
      state = payloadTelemetryReducer(
        state,
        payloadPacketReceived({ ...sampleTelemetryPacket, timestampMs: i }),
      );
    }
    expect(state.history.length).toBeLessThanOrEqual(3000);
    expect(state.packetCount).toBe(3050);
  });
});

describe("droneTelemetrySlice", () => {
  it("has correct initial state", () => {
    const state = droneTelemetryReducer(undefined, { type: "init" });
    expect(state.latest).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.packetCount).toBe(0);
    expect(state.status).toEqual({
      stateCode: null,
      throttleUs: null,
      armed: null,
      flightPhase: null,
      outputsActive: null,
    });
  });

  it("stores received packet as latest", () => {
    const state = droneTelemetryReducer(
      undefined,
      dronePacketReceived(sampleTelemetryPacket),
    );
    expect(state.latest).toEqual(sampleTelemetryPacket);
    expect(state.packetCount).toBe(1);
  });

  it("stores drone status events", () => {
    let state = droneTelemetryReducer(
      undefined,
      dronePacketReceived(sampleTelemetryPacket),
    );
    state = droneTelemetryReducer(
      state,
      droneStatusReceived({
        state_code: 1,
        throttle_us: 1480,
        armed: true,
        flight_phase: 1,
        outputs_active: true,
      }),
    );
    expect(state.status).toEqual({
      stateCode: 1,
      throttleUs: 1480,
      armed: true,
      flightPhase: 1,
      outputsActive: true,
    });
    expect(state.latest?.stateCode).toBe(1);
    expect(state.latest?.throttleUs).toBe(1480);
    expect(state.latest?.armed).toBe(true);
    expect(state.latest?.flightPhase).toBe(1);
    expect(state.latest?.outputsActive).toBe(true);
  });

  it("appends a batch of drone packets efficiently", () => {
    const batch = [
      { ...sampleTelemetryPacket, timestampMs: 100, altitude: 50.0 },
      { ...sampleTelemetryPacket, timestampMs: 200, altitude: 55.0 },
    ];
    const state = droneTelemetryReducer(
      undefined,
      dronePacketsReceived(batch),
    );
    expect(state.latest?.altitude).toBe(55.0);
    expect(state.packetCount).toBe(2);
    expect(state.history).toHaveLength(2);
  });
});

// ============================================================================
// Connection Slice Tests
// ============================================================================

describe("connectionSlice", () => {
  it("has correct initial state", () => {
    const state = connectionReducer(undefined, { type: "init" });
    expect(state.mode).toBe("disconnected");
    expect(state.rfdPort).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("updates from backend connection status", () => {
    const backendStatus = {
      mode: "mock" as const,
      rfd_port: null,
      rocket_packets_received: 42,
      payload_packets_received: 210,
      drone_packets_received: 10,
      checksum_failures: 3,
      uplink_acks: 2,
      last_uplink_ack: true,
      uptime_ms: 60000,
    };

    const state = connectionReducer(
      undefined,
      connectionStatusUpdated(backendStatus),
    );
    expect(state.mode).toBe("mock");
    expect(state.rocketPacketsReceived).toBe(42);
    expect(state.payloadPacketsReceived).toBe(210);
    expect(state.dronePacketsReceived).toBe(10);
    expect(state.checksumFailures).toBe(3);
    expect(state.uplinkAcks).toBe(2);
    expect(state.lastUplinkAck).toBe(true);
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
        droneTelemetry: droneTelemetryReducer,
        connection: connectionReducer,
      },
    });

    const state = testStore.getState();
    expect(state.rocketTelemetry.latest).toBeNull();
    expect(state.payloadTelemetry.latest).toBeNull();
    expect(state.droneTelemetry.latest).toBeNull();
    expect(state.connection.mode).toBe("disconnected");
  });

  it("dispatches across slices independently", () => {
    const testStore = configureStore({
      reducer: {
        rocketTelemetry: rocketTelemetryReducer,
        payloadTelemetry: payloadTelemetryReducer,
        droneTelemetry: droneTelemetryReducer,
        connection: connectionReducer,
      },
    });

    testStore.dispatch(rocketPacketReceived(sampleTelemetryPacket));
    testStore.dispatch(payloadPacketReceived(sampleTelemetryPacket));
    testStore.dispatch(dronePacketReceived(sampleTelemetryPacket));
    testStore.dispatch(
      connectionStatusUpdated({
        mode: "mock",
        rfd_port: null,
        rocket_packets_received: 1,
        payload_packets_received: 1,
        drone_packets_received: 1,
        checksum_failures: 0,
        uplink_acks: 0,
        last_uplink_ack: null,
        uptime_ms: 1000,
      }),
    );

    const state = testStore.getState();
    expect(state.rocketTelemetry.packetCount).toBe(1);
    expect(state.payloadTelemetry.packetCount).toBe(1);
    expect(state.droneTelemetry.packetCount).toBe(1);
    expect(state.connection.mode).toBe("mock");
  });

  it("limits charting history to CHART_WINDOW_LIMIT points for high-frequency performance", () => {
    let state = payloadTelemetryReducer(undefined, { type: "init" });
    const batch = Array.from({ length: 500 }, (_, i) => ({
      ...sampleTelemetryPacket,
      timestampMs: i * 100,
      altitude: i * 2,
    }));
    state = payloadTelemetryReducer(state, payloadPacketsReceived(batch));

    const rootState = {
      payloadTelemetry: state,
    } as any;

    const chartData = selectPayloadAltitudeHistory(rootState);
    expect(chartData.length).toBe(HISTORY_LIMITS.CHART_WINDOW_LIMIT); // 400
    expect(chartData[chartData.length - 1].t).toBe(499 * 100);
  });
});
