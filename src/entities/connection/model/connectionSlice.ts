/**
 * Connection Slice — Redux state for serial/mock connection management.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnectionStatus } from "@shared/hooks/useConnectionStatus";

export interface ConnectionSliceState {
  /** Current connection mode. */
  mode: "disconnected" | "serial" | "mock";
  /** Connected RFD port path. */
  rfdPort: string | null;
  /** Total rocket packets received (from backend). */
  rocketPacketsReceived: number;
  /** Total payload packets received (from backend). */
  payloadPacketsReceived: number;
  /** Total drone packets received (from backend). */
  dronePacketsReceived: number;
  /** Total checksum failures (from backend). */
  checksumFailures: number;
  /** Backend uptime in milliseconds. */
  uptimeMs: number;
  /** Whether the connection panel is loading. */
  isLoading: boolean;
  /** Last error message. */
  error: string | null;
}

const initialState: ConnectionSliceState = {
  mode: "disconnected",
  rfdPort: null,
  rocketPacketsReceived: 0,
  payloadPacketsReceived: 0,
  dronePacketsReceived: 0,
  checksumFailures: 0,
  uptimeMs: 0,
  isLoading: false,
  error: null,
};

export const connectionSlice = createSlice({
  name: "connection",
  initialState,
  reducers: {
    /** Update from a backend ConnectionStatus event. */
    connectionStatusUpdated(state, action: PayloadAction<ConnectionStatus>) {
      const s = action.payload;
      state.mode = s.mode;
      state.rfdPort = s.rfd_port;
      state.rocketPacketsReceived = s.rocket_packets_received;
      state.payloadPacketsReceived = s.payload_packets_received;
      state.dronePacketsReceived = s.drone_packets_received;
      state.checksumFailures = s.checksum_failures;
      state.uptimeMs = s.uptime_ms;
      state.isLoading = false;
      state.error = null;
    },

    /** Set loading state (when connecting/disconnecting). */
    connectionLoading(state) {
      state.isLoading = true;
      state.error = null;
    },

    /** Set error state. */
    connectionError(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },

    /** Reset connection state to initial. */
    connectionReset() {
      return initialState;
    },
  },
});

export const {
  connectionStatusUpdated,
  connectionLoading,
  connectionError,
  connectionReset,
} = connectionSlice.actions;

export default connectionSlice.reducer;
