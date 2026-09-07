/**
 * usePayloadTelemetry — Hook for receiving payload scientific telemetry.
 *
 * Listens to the "payload-telemetry" Tauri event and dispatches
 * the raw snake_case packet to a callback (map to camelCase first).
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { RawTelemetryPacket } from "@shared/lib";
import { useTauriEvent } from "./useTauriEvent";

export function usePayloadTelemetry(
  onPacket: (packet: RawTelemetryPacket) => void,
) {
  useTauriEvent<RawTelemetryPacket>(
    IPC_EVENTS.PAYLOAD_TELEMETRY,
    onPacket,
  );
}
