/**
 * DualGpsPanel — Side-by-side rocket, payload, and drone GPS coordinates.
 *
 * Large readable GPS coordinates for the referee dashboard.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectRocketGps } from "@entities/rocket-packet";
import { selectPayloadGps } from "@entities/payload-packet";
import { selectDroneGps } from "@entities/drone-packet";

export const DualGpsPanel = React.memo(function DualGpsPanel() {
  const { t } = useTranslation();
  const rocketGps = useAppSelector(selectRocketGps);
  const payloadGps = useAppSelector(selectPayloadGps);
  const droneGps = useAppSelector(selectDroneGps);

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
            value={rocketGps && typeof rocketGps.lat === "number" ? rocketGps.lat.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.longitude")}
            value={rocketGps && typeof rocketGps.lng === "number" ? rocketGps.lng.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={rocketGps && typeof rocketGps.alt === "number" ? rocketGps.alt.toFixed(1) : "---"}
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
            value={payloadGps && typeof payloadGps.lat === "number" ? payloadGps.lat.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.longitude")}
            value={payloadGps && typeof payloadGps.lng === "number" ? payloadGps.lng.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={payloadGps && typeof payloadGps.alt === "number" ? payloadGps.alt.toFixed(1) : "---"}
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

        {/* Drone GPS */}
        <div style={columnStyle}>
          <div style={{ ...headerStyle, color: "var(--color-status-nominal)" }}>
            Drone GPS
          </div>
          <TelemetryValue
            label={t("telemetry.latitude")}
            value={droneGps && typeof droneGps.lat === "number" ? droneGps.lat.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.longitude")}
            value={droneGps && typeof droneGps.lng === "number" ? droneGps.lng.toFixed(6) : "---"}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={droneGps && typeof droneGps.alt === "number" ? droneGps.alt.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
        </div>
      </div>
    </PanelContainer>
  );
});
