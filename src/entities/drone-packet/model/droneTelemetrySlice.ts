/**
 * Drone Telemetry Slice — Redux state for drone avionics data.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TelemetryPacket } from "@shared/types";
import { HISTORY_LIMITS } from "@shared/config/constants";

export interface DroneTelemetryState {
  latest: TelemetryPacket | null;
  history: TelemetryPacket[];
  packetCount: number;
}

const initialState: DroneTelemetryState = {
  latest: null,
  history: [],
  packetCount: 0,
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

    /** Reset all drone telemetry state. */
    droneTelemetryReset() {
      return initialState;
    },
  },
});

export const { dronePacketReceived, droneTelemetryReset } =
  droneTelemetrySlice.actions;

export default droneTelemetrySlice.reducer;
