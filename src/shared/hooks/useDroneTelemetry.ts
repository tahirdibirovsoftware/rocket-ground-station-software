/**
 * useDroneTelemetry — Hook for receiving drone telemetry.
 *
 * Listens to the "drone-telemetry" Tauri event and dispatches
 * the raw snake_case packet to a callback (map to camelCase first).
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { RawTelemetryPacket } from "@shared/lib";
import { useTauriEvent } from "./useTauriEvent";

export function useDroneTelemetry(
  onPacket: (packet: RawTelemetryPacket) => void,
) {
  useTauriEvent<RawTelemetryPacket>(
    IPC_EVENTS.DRONE_TELEMETRY,
    onPacket,
  );
}
