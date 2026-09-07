/**
 * Payload Telemetry Slice — Redux state for payload scientific data.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TelemetryPacket } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

export interface PayloadStatusState {
  /** true = payload landed, false = in sky. */
  onGround: boolean | null;
  /** 0 = PRE_LAUNCH, 1 = IN_AIR, 2 = ON_GROUND. */
  flightPhase: number | null;
  /** Firmware output state (true=active / buzzer firing, false=cutoff on motion). */
  outputsActive: boolean | null;
}

export interface PayloadTelemetryState {
  latest: TelemetryPacket | null;
  history: TelemetryPacket[];
  packetCount: number;
  /** Latest binary status event (RF_PKT_STATUS). */
  status: PayloadStatusState;
}

const initialState: PayloadTelemetryState = {
  latest: null,
  history: [],
  packetCount: 0,
  status: { onGround: null, flightPhase: null, outputsActive: null },
};

export const payloadTelemetrySlice = createSlice({
  name: "payloadTelemetry",
  initialState,
  reducers: {
    /** Push a new payload packet. Updates latest and appends to history. */
    payloadPacketReceived(state, action: PayloadAction<TelemetryPacket>) {
      state.latest = action.payload;
      state.packetCount += 1;

      // Maintain fixed-size history
      state.history.push(action.payload);
      if (state.history.length > HISTORY_LIMITS.PAYLOAD_BUFFER_SIZE) {
        state.history = state.history.slice(-HISTORY_LIMITS.PAYLOAD_BUFFER_SIZE);
      }
    },

    /** Push a batch of payload packets. Updates latest and appends all to history in one transaction. */
    payloadPacketsReceived(state, action: PayloadAction<TelemetryPacket[]>) {
      if (action.payload.length === 0) return;
      state.latest = action.payload[action.payload.length - 1];
      state.packetCount += action.payload.length;

      // Maintain fixed-size history
      state.history.push(...action.payload);
      if (state.history.length > HISTORY_LIMITS.PAYLOAD_BUFFER_SIZE) {
        state.history = state.history.slice(-HISTORY_LIMITS.PAYLOAD_BUFFER_SIZE);
      }
    },

    /** Update payload status from a binary RF_PKT_STATUS event. */
    payloadStatusReceived(
      state,
      action: PayloadAction<{
        on_ground: boolean;
        flight_phase: number;
        outputs_active?: boolean;
      }>,
    ) {
      state.status = {
        onGround: action.payload.on_ground,
        flightPhase: action.payload.flight_phase,
        outputsActive: action.payload.outputs_active ?? null,
      };
      // Keep the latest packet's phase in sync too
      if (state.latest) {
        state.latest.onGround = action.payload.on_ground;
        state.latest.flightPhase = action.payload.flight_phase;
        if (action.payload.outputs_active !== undefined) {
          state.latest.outputsActive = action.payload.outputs_active;
        }
      }
    },

    /** Reset all payload telemetry state. */
    payloadTelemetryReset() {
      return initialState;
    },
  },
});

export const {
  payloadPacketReceived,
  payloadPacketsReceived,
  payloadStatusReceived,
  payloadTelemetryReset,
} = payloadTelemetrySlice.actions;

export default payloadTelemetrySlice.reducer;
