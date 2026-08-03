/**
 * Rocket Telemetry Slice — Redux state for rocket avionics data.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TelemetryPacket } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

export interface RocketTelemetryState {
  latest: TelemetryPacket | null;
  history: TelemetryPacket[];
  packetCount: number;
}

const initialState: RocketTelemetryState = {
  latest: null,
  history: [],
  packetCount: 0,
};

export const rocketTelemetrySlice = createSlice({
  name: "rocketTelemetry",
  initialState,
  reducers: {
    /** Push a new rocket packet. Updates latest and appends to history. */
    rocketPacketReceived(state, action: PayloadAction<TelemetryPacket>) {
      state.latest = action.payload;
      state.packetCount += 1;

      // Maintain fixed-size history
      state.history.push(action.payload);
      if (state.history.length > HISTORY_LIMITS.ROCKET_BUFFER_SIZE) {
        state.history = state.history.slice(-HISTORY_LIMITS.ROCKET_BUFFER_SIZE);
      }
    },

    /** Reset all rocket telemetry state. */
    rocketTelemetryReset() {
      return initialState;
    },
  },
});

export const { rocketPacketReceived, rocketTelemetryReset } =
  rocketTelemetrySlice.actions;

export default rocketTelemetrySlice.reducer;
