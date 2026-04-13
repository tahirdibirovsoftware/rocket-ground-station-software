/**
 * DualGpsPanel — Side-by-side rocket vs payload GPS coordinates.
 *
 * Large readable GPS coordinates for the referee dashboard.
 * No debug info — only lat/lng/alt for both vehicles.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectRocketGps } from "@entities/rocket-packet";
import { selectPayloadGps } from "@entities/payload-packet";

export const DualGpsPanel = React.memo(function DualGpsPanel() {
  const { t } = useTranslation();
  const rocketGps = useAppSelector(selectRocketGps);
  const payloadGps = useAppSelector(selectPayloadGps);

  const columnStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "0.5rem",
  };

  const headerStyle: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "0.25rem",
    fontFamily: "var(--font-mono)",
  };

  return (
    <PanelContainer
      id="dual-gps-panel"
      title="GPS Tracking"
      icon={<MapPin size={14} />}
    >
      <div style={{ display: "flex", gap: "1px" }}>
        {/* Rocket GPS */}
        <div style={columnStyle}>
          <div style={{ ...headerStyle, color: "var(--color-status-critical)" }}>
            {t("dashboard.referee.rocketGPS")}
          </div>
          <TelemetryValue
            label={t("telemetry.latitude")}
            value={rocketGps ? rocketGps.lat.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.longitude")}
            value={rocketGps ? rocketGps.lng.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={rocketGps ? rocketGps.alt.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            backgroundColor: "var(--color-border-default)",
            alignSelf: "stretch",
          }}
        />

        {/* Payload GPS */}
        <div style={columnStyle}>
          <div style={{ ...headerStyle, color: "var(--color-status-info)" }}>
            {t("dashboard.referee.payloadGPS")}
          </div>
          <TelemetryValue
            label={t("telemetry.latitude")}
            value={payloadGps ? payloadGps.lat.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.longitude")}
            value={payloadGps ? payloadGps.lng.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={payloadGps ? payloadGps.alt.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
        </div>
      </div>
    </PanelContainer>
  );
});
