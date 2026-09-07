/**
 * Payload Telemetry Selectors — memoized selectors for payload data.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";
import { HISTORY_LIMITS } from "@shared/config/constants";

const selectPayloadSlice = (state: RootState) => state.payloadTelemetry;

/** Select the latest payload packet. */
export const selectLatestPayloadPacket = createSelector(
  selectPayloadSlice,
  (slice) => slice.latest,
);

/** Select the full payload history array. */
export const selectPayloadHistory = createSelector(
  selectPayloadSlice,
  (slice) => slice.history,
);

/** Select the total payload packet count. */
export const selectPayloadPacketCount = createSelector(
  selectPayloadSlice,
  (slice) => slice.packetCount,
);

/** Select the scientific data history (for charting, downsampled to rolling window). */
export const selectScientificDataHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.temp })),
);

/** Select the latest payload GPS position. */
export const selectPayloadGps = createSelector(
  selectLatestPayloadPacket,
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

/** Select the payload status (ground/sky + flight phase). */
export const selectPayloadStatus = createSelector(
  selectPayloadSlice,
  (slice) => slice.status,
);

/** Select the payload flight phase (0=PRE_LAUNCH, 1=IN_AIR, 2=ON_GROUND). */
export const selectPayloadFlightPhase = createSelector(
  selectPayloadSlice,
  (slice) => slice.status.flightPhase ?? slice.latest?.flightPhase ?? 0,
);

/** Select the payload outputs active state (Buzzer/ESC firing). */
export const selectPayloadOutputsActive = createSelector(
  selectPayloadSlice,
  (slice) => slice.status.outputsActive ?? slice.latest?.outputsActive ?? false,
);

/** Select the latest payload fast-G filter reading. */
export const selectPayloadFastG = createSelector(
  selectLatestPayloadPacket,
  (pkt) => pkt?.fastG ?? 0,
);

/** Select the payload relative altitude history (AGL for flight charting, downsampled to rolling window). */
export const selectPayloadAltitudeHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.relAlt ?? p.altitude })),
);

/** Select the payload absolute MSL altitude history (sea level, downsampled to rolling window). */
export const selectPayloadMslAltitudeHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.altitude })),
);

/** Select the payload vertical velocity history (for charting, downsampled to rolling window). */
export const selectPayloadVelocityHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.verticalVelocity })),
);

/** Select the payload G-force history (for charting, downsampled to rolling window). */
export const selectPayloadGForceHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history
      .slice(-HISTORY_LIMITS.CHART_WINDOW_LIMIT)
      .map((p) => ({ t: p.timestampMs, v: p.gForce })),
);
