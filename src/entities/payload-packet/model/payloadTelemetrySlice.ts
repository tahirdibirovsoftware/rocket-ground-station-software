/**
 * Payload Telemetry Slice — Redux state for payload scientific data.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TelemetryPacket } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

export interface PayloadTelemetryState {
  latest: TelemetryPacket | null;
  history: TelemetryPacket[];
  packetCount: number;
}

const initialState: PayloadTelemetryState = {
  latest: null,
  history: [],
  packetCount: 0,
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

    /** Reset all payload telemetry state. */
    payloadTelemetryReset() {
      return initialState;
    },
  },
});

export const { payloadPacketReceived, payloadTelemetryReset } =
  payloadTelemetrySlice.actions;

export default payloadTelemetrySlice.reducer;
