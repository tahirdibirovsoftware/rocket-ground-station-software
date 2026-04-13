/**
 * PayloadSummary — Live payload scientific telemetry panel.
 *
 * Displays payload GPS coordinates, altitude, and scientific sensor data.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";
import { PanelContainer, TelemetryValue, DataRow } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectLatestPayloadPacket,
  selectPayloadPacketCount,
} from "@entities/payload-packet";

export const PayloadSummary = React.memo(function PayloadSummary() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestPayloadPacket);
  const count = useAppSelector(selectPayloadPacketCount);

  return (
    <PanelContainer
      id="payload-summary"
      title={t("dashboard.referee.scientificData")}
      icon={<Cpu size={14} />}
      headerRight={
        <span
          className="font-telemetry"
          style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}
        >
          #{count}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={latest ? latest.altitude.toFixed(1) : "---"}
            unit={t("units.meters")}
          />
          <TelemetryValue
            label={t("telemetry.scientificData")}
            value={latest ? latest.scientificSensorData.toFixed(2) : "---"}
            color="var(--color-status-info)"
          />
        </div>
        <DataRow
          label={t("telemetry.latitude")}
          value={latest ? latest.latitude.toFixed(6) : "---"}
        />
        <DataRow
          label={t("telemetry.longitude")}
          value={latest ? latest.longitude.toFixed(6) : "---"}
        />
        <DataRow
          label={t("telemetry.timestamp")}
          value={latest ? `${latest.timestamp} ${t("units.milliseconds")}` : "---"}
        />
      </div>
    </PanelContainer>
  );
});
