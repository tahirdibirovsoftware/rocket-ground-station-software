/**
 * SystemHealth — Packet rate, checksum failures, uptime display.
 *
 * Provides a quick overview of connection quality and system statistics.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { HeartPulse } from "lucide-react";
import { PanelContainer, DataRow, StatusIndicator } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectConnectionMode,
  selectConnectionStats,
} from "@entities/connection";

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
  const stats = useAppSelector(selectConnectionStats);

  const hasErrors = stats.checksumFailures > 0;

  return (
    <PanelContainer
      id="system-health"
      title={t("dashboard.team.systemHealth")}
      icon={<HeartPulse size={14} />}
      glow={hasErrors ? "red" : "none"}
      headerRight={
        <StatusIndicator
          variant={mode === "disconnected" ? "muted" : hasErrors ? "warning" : "nominal"}
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
            mode === "disconnected"
              ? "var(--color-text-muted)"
              : "var(--color-status-nominal)"
          }
        />
        <DataRow
          label={"Rocket " + t("connection.packetsReceived")}
          value={stats.rocketPackets.toLocaleString()}
        />
        <DataRow
          label={"Payload " + t("connection.packetsReceived")}
          value={stats.payloadPackets.toLocaleString()}
        />
        <DataRow
          label={"Drone " + t("connection.packetsReceived")}
          value={stats.dronePackets.toLocaleString()}
        />
        <DataRow
          label={t("connection.checksumFailures")}
          value={stats.checksumFailures.toLocaleString()}
          valueColor={
            hasErrors
              ? "var(--color-status-critical)"
              : "var(--color-text-primary)"
          }
        />
        <DataRow label="Uptime" value={formatUptime(stats.uptimeMs)} />
      </div>
    </PanelContainer>
  );
});
