/**
 * Drone Telemetry Selectors — memoized selectors for drone data.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";

const selectDroneSlice = (state: RootState) => state.droneTelemetry;

/** Select the latest drone packet. */
export const selectLatestDronePacket = createSelector(
  selectDroneSlice,
  (slice) => slice.latest,
);

/** Select the full drone history array. */
export const selectDroneHistory = createSelector(
  selectDroneSlice,
  (slice) => slice.history,
);

/** Select the total drone packet count. */
export const selectDronePacketCount = createSelector(
  selectDroneSlice,
  (slice) => slice.packetCount,
);

/** Select the latest drone GPS position. */
export const selectDroneGps = createSelector(
  selectLatestDronePacket,
  (pkt) =>
    pkt ? { lat: pkt.latitude, lng: pkt.longitude, alt: pkt.altitude } : null,
);
