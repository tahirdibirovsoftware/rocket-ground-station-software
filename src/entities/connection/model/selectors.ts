/**
 * Connection Selectors — memoized selectors for connection state.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";

const selectConnectionSlice = (state: RootState) => state.connection;

export const selectConnectionMode = createSelector(
  selectConnectionSlice,
  (s) => s.mode,
);

export const selectIsConnected = createSelector(
  selectConnectionSlice,
  (s) => s.mode !== "disconnected",
);

export const selectIsMockMode = createSelector(
  selectConnectionSlice,
  (s) => s.mode === "mock",
);

export const selectConnectionPorts = createSelector(
  selectConnectionSlice,
  (s) => ({ rocket: s.rocketPort, payload: s.payloadPort }),
);

export const selectConnectionStats = createSelector(
  selectConnectionSlice,
  (s) => ({
    rocketPackets: s.rocketPacketsReceived,
    payloadPackets: s.payloadPacketsReceived,
    checksumFailures: s.checksumFailures,
    uptimeMs: s.uptimeMs,
  }),
);

export const selectConnectionLoading = createSelector(
  selectConnectionSlice,
  (s) => s.isLoading,
);

export const selectConnectionError = createSelector(
  selectConnectionSlice,
  (s) => s.error,
);
