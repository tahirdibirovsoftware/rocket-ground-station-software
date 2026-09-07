import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";
import { HISTORY_LIMITS } from "@shared/config/constants";

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
    pkt
      ? {
          lat: pkt.latitude,
          lng: pkt.longitude,
          alt: pkt.relAlt ?? pkt.altitude,
          gpsAlt: pkt.gpsAltitude,
        }
      : null,
);

/** Select the drone status (state code / throttle / armed / flight phase / outputs active). */
export const selectDroneStatus = createSelector(
  selectDroneSlice,
  (slice) => slice.status,
);

/** Select drone relative altitude history (AGL for real-time charting, downsampled to rolling window). */
export const selectDroneAltitudeHistory = createSelector(
  selectDroneHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.relAlt ?? p.altitude })),
);

/** Select drone absolute MSL altitude history (sea level, downsampled to rolling window). */
export const selectDroneMslAltitudeHistory = createSelector(
  selectDroneHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.altitude })),
);

/** Select drone vertical velocity history for real-time charting, downsampled to rolling window. */
export const selectDroneVelocityHistory = createSelector(
  selectDroneHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.verticalVelocity })),
);

/** Select drone G-force history for real-time charting, downsampled to rolling window. */
export const selectDroneGForceHistory = createSelector(
  selectDroneHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.gForce })),
);

/** Select drone pressure history for real-time charting, downsampled to rolling window. */
export const selectDronePressureHistory = createSelector(
  selectDroneHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.pressure })),
);
