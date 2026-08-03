/**
 * TelemetryBridge — Listens to Tauri IPC events and dispatches to Redux.
 *
 * Renders nothing visible — purely a side-effect component that bridges
 * the Rust backend events to the Redux store.
 */
import { useCallback } from "react";
import { useAppDispatch } from "@app/store";
import {
  useRocketTelemetry,
  usePayloadTelemetry,
  useDroneTelemetry,
  useConnectionStatus,
} from "@shared/hooks";
import { mapTelemetryPacket } from "@shared/lib";
import { rocketPacketReceived } from "@entities/rocket-packet";
import { payloadPacketReceived } from "@entities/payload-packet";
import { dronePacketReceived } from "@entities/drone-packet";
import { connectionStatusUpdated } from "@entities/connection";

export function TelemetryBridge() {
  const dispatch = useAppDispatch();

  useRocketTelemetry(
    useCallback(
      (raw: any) => {
        console.log("Rocket raw:", raw);
        const mapped = mapTelemetryPacket(raw);
        console.log("Rocket mapped:", mapped);
        dispatch(rocketPacketReceived(mapped));
      },
      [dispatch],
    ),
  );

  usePayloadTelemetry(
    useCallback(
      (raw: any) => {
        console.log("Payload raw:", raw);
        const mapped = mapTelemetryPacket(raw);
        console.log("Payload mapped:", mapped);
        dispatch(payloadPacketReceived(mapped));
      },
      [dispatch],
    ),
  );

  useDroneTelemetry(
    useCallback(
      (raw: any) => {
        console.log("Drone raw:", raw);
        const mapped = mapTelemetryPacket(raw);
        console.log("Drone mapped:", mapped);
        dispatch(dronePacketReceived(mapped));
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
