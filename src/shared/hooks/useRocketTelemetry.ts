/**
 * useRocketTelemetry — Hook for receiving rocket avionics telemetry.
 *
 * Listens to the "rocket-telemetry" Tauri event and dispatches
 * the raw snake_case packet to a callback (map to camelCase first).
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { RawTelemetryPacket } from "@shared/lib";
import { useTauriEvent } from "./useTauriEvent";

export function useRocketTelemetry(
  onPacket: (packet: RawTelemetryPacket) => void,
) {
  useTauriEvent<RawTelemetryPacket>(
    IPC_EVENTS.ROCKET_TELEMETRY,
    onPacket,
  );
}
