/**
 * Rocket Telemetry Selectors — memoized selectors for rocket data.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";
import { HISTORY_LIMITS } from "@shared/config/constants";

const selectRocketSlice = (state: RootState) => state.rocketTelemetry;

/** Select the latest rocket packet. */
export const selectLatestRocketPacket = createSelector(
  selectRocketSlice,
  (slice) => slice.latest,
);

/** Select the full rocket history array. */
export const selectRocketHistory = createSelector(
  selectRocketSlice,
  (slice) => slice.history,
);

/** Select the total rocket packet count. */
export const selectRocketPacketCount = createSelector(
  selectRocketSlice,
  (slice) => slice.packetCount,
);

/** Select only the altitude history (for charting, downsampled to rolling window). */
export const selectRocketAltitudeHistory = createSelector(
  selectRocketHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.altitude })),
);

/** Select only the velocity history (for charting, downsampled to rolling window). */
export const selectRocketVelocityHistory = createSelector(
  selectRocketHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.gpsSpeed })),
);

/** Select only the pressure history (for charting, downsampled to rolling window). */
export const selectRocketPressureHistory = createSelector(
  selectRocketHistory,
  (history) =>
    history.slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT).map((p) => ({
      t: p.timestampMs,
      p1: p.pressure,
      p2: p.pressure,
    })),
);

/** Select the latest GPS position. */
export const selectRocketGps = createSelector(
  selectLatestRocketPacket,
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

/** Select the maximum altitude reached so far. */
export const selectMaxAltitude = createSelector(
  selectRocketHistory,
  (history) => {
    if (history.length === 0) return 0;
    return Math.max(...history.map((p) => p.altitude));
  },
);
