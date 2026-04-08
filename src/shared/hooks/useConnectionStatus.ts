/**
 * useConnectionStatus — Hook for receiving connection status updates.
 *
 * Listens to the "connection-status" Tauri event and provides
 * the current connection state.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import { useTauriEvent } from "./useTauriEvent";

export interface ConnectionStatus {
  mode: "disconnected" | "serial" | "mock";
  rocket_port: string | null;
  payload_port: string | null;
  rocket_packets_received: number;
  payload_packets_received: number;
  checksum_failures: number;
  uptime_ms: number;
}

export function useConnectionStatus(
  onStatus: (status: ConnectionStatus) => void,
) {
  useTauriEvent<ConnectionStatus>(
    IPC_EVENTS.CONNECTION_STATUS,
    onStatus,
  );
}
