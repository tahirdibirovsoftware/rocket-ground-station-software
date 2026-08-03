/**
 * Payload Telemetry Selectors — memoized selectors for payload data.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@app/store";

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

/** Select the scientific data history (for charting). */
export const selectScientificDataHistory = createSelector(
  selectPayloadHistory,
  (history) =>
    history.map((p) => ({ t: p.timestampMs, v: p.temp })),
);

/** Select the latest payload GPS position. */
export const selectPayloadGps = createSelector(
  selectLatestPayloadPacket,
  (pkt) =>
    pkt ? { lat: pkt.latitude, lng: pkt.longitude, alt: pkt.altitude } : null,
);
