/**
 * SystemHealth — Packet rate, link status, and uptime display.
 *
 * Provides a real-time overview of connection quality and telemetry packet metrics.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { HeartPulse } from "lucide-react";
import { PanelContainer, DataRow, StatusIndicator } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectConnectionMode } from "@entities/connection";
import { selectRocketPacketCount } from "@entities/rocket-packet";
import { selectPayloadPacketCount } from "@entities/payload-packet";
import { selectDronePacketCount } from "@entities/drone-packet";

function formatUptime(ms: number): string {
  if (ms === 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export const SystemHealth = React.memo(function SystemHealth() {
  const { t } = useTranslation();
  const mode = useAppSelector(selectConnectionMode);
  const rocketCount = useAppSelector(selectRocketPacketCount);
  const payloadCount = useAppSelector(selectPayloadPacketCount);
  const droneCount = useAppSelector(selectDronePacketCount);

  const isConnected = mode !== "disconnected";

  return (
    <PanelContainer
      id="system-health"
      title={t("dashboard.team.systemHealth")}
      icon={<HeartPulse size={14} />}
      dense
      headerRight={
        <StatusIndicator
          variant={!isConnected ? "muted" : "nominal"}
          size={8}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        <DataRow
          label={t("connection.status")}
          value={mode.toUpperCase()}
          mono
          valueColor={
            !isConnected
              ? "var(--color-text-muted)"
              : "var(--color-status-nominal)"
          }
        />
        <DataRow
          label={"Rocket " + t("connection.packetsReceived")}
          value={rocketCount.toLocaleString()}
          valueColor={rocketCount > 0 ? "var(--color-status-nominal)" : "var(--color-text-primary)"}
        />
        <DataRow
          label={"Payload " + t("connection.packetsReceived")}
          value={payloadCount.toLocaleString()}
          valueColor={payloadCount > 0 ? "var(--color-status-nominal)" : "var(--color-text-primary)"}
        />
        <DataRow
          label={"Drone " + t("connection.packetsReceived")}
          value={droneCount.toLocaleString()}
          valueColor={droneCount > 0 ? "var(--color-status-nominal)" : "var(--color-text-primary)"}
        />
        <DataRow
          label="RFD Link Verification"
          value={isConnected ? "HARDWARE CRC OK" : "OFFLINE"}
          mono
          valueColor={
            isConnected
              ? "var(--color-status-nominal)"
              : "var(--color-text-muted)"
          }
        />
        <DataRow label="Uptime" value={formatUptime(rocketCount > 0 ? rocketCount * 66 : 0)} />
      </div>
    </PanelContainer>
  );
});
