/**
 * usePayloadTelemetry — Hook for receiving payload scientific telemetry.
 *
 * Listens to the "payload-telemetry" Tauri event and dispatches
 * the parsed packet to a callback.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import type { PayloadScientificPacket } from "@shared/types";
import { useTauriEvent } from "./useTauriEvent";

export function usePayloadTelemetry(
  onPacket: (packet: PayloadScientificPacket) => void,
) {
  useTauriEvent<PayloadScientificPacket>(
    IPC_EVENTS.PAYLOAD_TELEMETRY,
    onPacket,
  );
}
