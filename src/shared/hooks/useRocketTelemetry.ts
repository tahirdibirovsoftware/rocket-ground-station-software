/**
 * useRocketTelemetry — Hook for receiving rocket avionics telemetry.
 *
 * Listens to the "rocket-telemetry" Tauri event and dispatches
 * the parsed packet to a callback.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { TelemetryPacket } from "@shared/types";
import { useTauriEvent } from "./useTauriEvent";

export function useRocketTelemetry(
  onPacket: (packet: TelemetryPacket) => void,
) {
  useTauriEvent<TelemetryPacket>(
    IPC_EVENTS.ROCKET_TELEMETRY,
    onPacket,
  );
}
