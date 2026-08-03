/**
 * DroneSummary — Live drone telemetry panel.
 *
 * Displays drone GPS coordinates, altitude, speed, and course.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Navigation } from "lucide-react";
import { PanelContainer, TelemetryValue, DataRow } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectLatestDronePacket,
  selectDronePacketCount,
} from "@entities/drone-packet";

export const DroneSummary = React.memo(function DroneSummary() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestDronePacket);
  const count = useAppSelector(selectDronePacketCount);

  return (
    <PanelContainer
      id="drone-summary"
      title="Drone Telemetry"
      icon={<Navigation size={14} />}
      headerRight={
        <span
          className="font-telemetry"
          style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}
        >
          #{count}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingBottom: "0.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={latest && typeof latest.altitude === "number" ? latest.altitude.toFixed(1) : "---"}
            unit={t("units.meters")}
          />
          <TelemetryValue
            label="Drone Speed"
            value={latest && typeof latest.gpsSpeed === "number" ? latest.gpsSpeed.toFixed(1) : "---"}
            unit="m/s"
            color="var(--color-status-nominal)"
          />
        </div>
        <DataRow
          label={t("telemetry.latitude")}
          value={latest && typeof latest.latitude === "number" ? latest.latitude.toFixed(6) : "---"}
        />
        <DataRow
          label={t("telemetry.longitude")}
          value={latest && typeof latest.longitude === "number" ? latest.longitude.toFixed(6) : "---"}
        />
        <DataRow
          label="Drone Course"
          value={latest && typeof latest.gpsCourse === "number" ? `${latest.gpsCourse.toFixed(1)}°` : "---"}
        />
        <DataRow
          label={t("telemetry.timestamp")}
          value={latest ? `${latest.timestampMs} ${t("units.milliseconds")}` : "---"}
        />
      </div>
    </PanelContainer>
  );
});
