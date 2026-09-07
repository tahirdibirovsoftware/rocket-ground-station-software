/**
 * usePayloadStatus — Hook for receiving payload status events.
 *
 * Listens to the "payload-status" Tauri event (binary RF_PKT_STATUS) and
 * provides payload ground/sky status with flight phase.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import { useTauriEvent } from "./useTauriEvent";

export interface PayloadStatus {
  /** true = payload landed, false = in sky. */
  on_ground: boolean;
  /** 0 = PRE_LAUNCH, 1 = IN_AIR, 2 = ON_GROUND. */
  flight_phase: number;
  /** Firmware output state (true=active / buzzer firing, false=cutoff on motion). */
  outputs_active: boolean;
}

export function usePayloadStatus(
  onStatus: (status: PayloadStatus) => void,
) {
  useTauriEvent<PayloadStatus>(IPC_EVENTS.PAYLOAD_STATUS, onStatus);
}
