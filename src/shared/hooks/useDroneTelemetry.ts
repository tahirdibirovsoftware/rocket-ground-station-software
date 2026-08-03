/**
 * useDroneTelemetry — Hook for receiving drone telemetry.
 *
 * Listens to the "drone-telemetry" Tauri event and dispatches
 * the parsed packet to a callback.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { TelemetryPacket } from "@shared/types";
import { useTauriEvent } from "./useTauriEvent";

export function useDroneTelemetry(
  onPacket: (packet: TelemetryPacket) => void,
) {
  useTauriEvent<TelemetryPacket>(
    IPC_EVENTS.DRONE_TELEMETRY,
    onPacket,
  );
}
