/**
 * TelemetryBridge — Listens to Tauri IPC events and dispatches to Redux.
 *
 * Renders nothing visible — purely a side-effect component that bridges
 * the Rust backend events to the Redux store.
 */
import { useCallback } from "react";
import { useAppDispatch } from "@app/store";
import { useRocketTelemetry, usePayloadTelemetry, useConnectionStatus } from "@shared/hooks";
import { mapRocketPacket, mapPayloadPacket } from "@shared/lib";
import { rocketPacketReceived } from "@entities/rocket-packet";
import { payloadPacketReceived } from "@entities/payload-packet";
import { connectionStatusUpdated } from "@entities/connection";

export function TelemetryBridge() {
  const dispatch = useAppDispatch();

  useRocketTelemetry(
    useCallback(
      (raw: any) => {
        const mapped = mapRocketPacket(raw);
        dispatch(rocketPacketReceived(mapped));
      },
      [dispatch],
    ),
  );

  usePayloadTelemetry(
    useCallback(
      (raw: any) => {
        const mapped = mapPayloadPacket(raw);
        dispatch(payloadPacketReceived(mapped));
      },
      [dispatch],
    ),
  );

  useConnectionStatus(
    useCallback(
      (status) => {
        dispatch(connectionStatusUpdated(status));
      },
      [dispatch],
    ),
  );

  return null;
}
