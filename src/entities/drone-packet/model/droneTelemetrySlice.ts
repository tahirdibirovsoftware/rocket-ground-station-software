/**
 * Drone Telemetry Slice — Redux state for drone avionics data.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TelemetryPacket } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

export interface DroneStatusState {
  /** 0 = DISARMED, 1 = ARMED_WAIT, 2 = MOTORS_ON, 3 = MOTORS_HOLD, 4 = TOUCHDOWN. */
  stateCode: number | null;
  /** ESC throttle pulse width (µs). */
  throttleUs: number | null;
  /** RF arm state. */
  armed: boolean | null;
  /** Firmware flight phase (0 = PRE_LAUNCH, 1 = IN_AIR, 2 = ON_GROUND). */
  flightPhase: number | null;
  /** Firmware actuator state (true = active / ESC/Buzzer firing, false = cutoff on motion). */
  outputsActive: boolean | null;
}

export interface DroneTelemetryState {
  latest: TelemetryPacket | null;
  history: TelemetryPacket[];
  packetCount: number;
  /** Latest binary status event (RF_PKT_STATUS). */
  status: DroneStatusState;
}

const initialState: DroneTelemetryState = {
  latest: null,
  history: [],
  packetCount: 0,
  status: { stateCode: null, throttleUs: null, armed: null, flightPhase: null, outputsActive: null },
};

export const droneTelemetrySlice = createSlice({
  name: "droneTelemetry",
  initialState,
  reducers: {
    /** Push a new drone packet. Updates latest and appends to history. */
    dronePacketReceived(state, action: PayloadAction<TelemetryPacket>) {
      state.latest = action.payload;
      state.packetCount += 1;

      // Maintain fixed-size history
      state.history.push(action.payload);
      if (state.history.length > HISTORY_LIMITS.DRONE_BUFFER_SIZE) {
        state.history = state.history.slice(-HISTORY_LIMITS.DRONE_BUFFER_SIZE);
      }
    },

    /** Push a batch of drone packets. Updates latest and appends all to history in one transaction. */
    dronePacketsReceived(state, action: PayloadAction<TelemetryPacket[]>) {
      if (action.payload.length === 0) return;
      state.latest = action.payload[action.payload.length - 1];
      state.packetCount += action.payload.length;

      // Maintain fixed-size history
      state.history.push(...action.payload);
      if (state.history.length > HISTORY_LIMITS.DRONE_BUFFER_SIZE) {
        state.history = state.history.slice(-HISTORY_LIMITS.DRONE_BUFFER_SIZE);
      }
    },

    /** Update drone status from a binary RF_PKT_STATUS event. */
    droneStatusReceived(
      state,
      action: PayloadAction<{
        state_code: number;
        throttle_us: number;
        armed: boolean;
        flight_phase?: number;
        outputs_active?: boolean;
      }>,
    ) {
      const flightPhase = action.payload.flight_phase ?? action.payload.state_code;
      const outputsActive = action.payload.outputs_active ?? (action.payload.throttle_us > 1000);
      state.status = {
        stateCode: action.payload.state_code,
        throttleUs: action.payload.throttle_us,
        armed: action.payload.armed,
        flightPhase,
        outputsActive,
      };
      // Keep the latest packet's flight-control fields in sync too
      if (state.latest) {
        state.latest.stateCode = action.payload.state_code;
        state.latest.throttleUs = action.payload.throttle_us;
        state.latest.armed = action.payload.armed;
        state.latest.flightPhase = flightPhase;
        state.latest.outputsActive = outputsActive;
      }
    },

    /** Reset all drone telemetry state. */
    droneTelemetryReset() {
      return initialState;
    },
  },
});

export const {
  dronePacketReceived,
  dronePacketsReceived,
  droneStatusReceived,
  droneTelemetryReset,
} = droneTelemetrySlice.actions;

export default droneTelemetrySlice.reducer;
