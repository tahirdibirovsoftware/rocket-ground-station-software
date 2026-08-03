/**
 * DualGpsPanel — Premium aerospace GPS tracking panel for competition referees.
 *
 * Displays Rocket GPS, Payload GPS, and Drone GPS in 3 high-contrast glassmorphic cards,
 * featuring real-time 3D vector separation distance calculation between Rocket & Payload.
 */
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Copy, Check, Radio, Compass } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectRocketGps } from "@entities/rocket-packet";
import { selectPayloadGps } from "@entities/payload-packet";
import { selectDroneGps } from "@entities/drone-packet";

/** Haversine formula to compute distance in meters between 2 GPS points */
function calculateDistanceMeters(
  lat1?: number,
  lon1?: number,
  alt1?: number,
  lat2?: number,
  lon2?: number,
  alt2?: number,
): number | null {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return null;
  }
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const horizontalDist = R * c;

  const dAlt = (alt2 ?? 0) - (alt1 ?? 0);
  return Math.sqrt(horizontalDist * horizontalDist + dAlt * dAlt);
}

export const DualGpsPanel = React.memo(function DualGpsPanel() {
  const { t } = useTranslation();
  const rocketGps = useAppSelector(selectRocketGps);
  const payloadGps = useAppSelector(selectPayloadGps);
  const droneGps = useAppSelector(selectDroneGps);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Calculate live separation distance
  const separationDistance = useMemo(() => {
    return calculateDistanceMeters(
      rocketGps?.lat,
      rocketGps?.lng,
      rocketGps?.alt,
      payloadGps?.lat,
      payloadGps?.lng,
      payloadGps?.alt,
    );
  }, [rocketGps, payloadGps]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <PanelContainer
      id="dual-gps-panel"
      title={t("dashboard.referee.gpsTracking", "Tri-System GPS Positioning")}
      icon={<MapPin size={16} />}
      headerRight={
        separationDistance !== null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              backgroundColor: "rgba(0, 200, 255, 0.15)",
              border: "1px solid rgba(0, 200, 255, 0.3)",
              padding: "0.2rem 0.5rem",
              borderRadius: "0.25rem",
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono)",
              color: "#00c8ff",
              fontWeight: 700,
            }}
          >
            <Compass size={12} />
            Separation Vector: {separationDistance.toFixed(1)}m
          </div>
        ) : undefined
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* 3 Column GPS Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.625rem",
            flex: 1,
          }}
        >
          {/* Rocket GPS Card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-status-critical)",
              borderRadius: "0.375rem",
              padding: "0.625rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  color: "var(--color-status-critical)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("dashboard.referee.rocketGPS", "Rocket GPS")}
              </span>
              <button
                onClick={() =>
                  rocketGps?.lat &&
                  copyToClipboard(`${rocketGps.lat}, ${rocketGps.lng}`, "rocket")
                }
                disabled={!rocketGps?.lat}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: "0.15rem",
                }}
                title="Copy Rocket GPS Coordinates"
              >
                {copiedKey === "rocket" ? <Check size={12} color="var(--color-status-nominal)" /> : <Copy size={12} />}
              </button>
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
              color="var(--color-status-critical)"
            />
          </div>

          {/* Payload GPS Card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-status-info)",
              borderRadius: "0.375rem",
              padding: "0.625rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  color: "var(--color-status-info)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {t("dashboard.referee.payloadGPS", "Payload GPS")}
              </span>
              <button
                onClick={() =>
                  payloadGps?.lat &&
                  copyToClipboard(`${payloadGps.lat}, ${payloadGps.lng}`, "payload")
                }
                disabled={!payloadGps?.lat}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: "0.15rem",
                }}
                title="Copy Payload GPS Coordinates"
              >
                {copiedKey === "payload" ? <Check size={12} color="var(--color-status-nominal)" /> : <Copy size={12} />}
              </button>
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
              color="var(--color-status-info)"
            />
          </div>

          {/* Drone GPS Card */}
          <div
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-status-nominal)",
              borderRadius: "0.375rem",
              padding: "0.625rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  color: "var(--color-status-nominal)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Drone GPS
              </span>
              <button
                onClick={() =>
                  droneGps?.lat &&
                  copyToClipboard(`${droneGps.lat}, ${droneGps.lng}`, "drone")
                }
                disabled={!droneGps?.lat}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: "0.15rem",
                }}
                title="Copy Drone GPS Coordinates"
              >
                {copiedKey === "drone" ? <Check size={12} color="var(--color-status-nominal)" /> : <Copy size={12} />}
              </button>
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
              color="var(--color-status-nominal)"
            />
          </div>
        </div>

        {/* GPS Fix Status Indicator Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.375rem 0.625rem",
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "0.25rem",
            border: "1px solid var(--color-border-default)",
            fontSize: "0.625rem",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Radio size={12} style={{ color: "var(--color-status-nominal)" }} />
            <span>GPS Satellite Lock: 3D Multi-Constellation</span>
          </div>
          <span style={{ color: "var(--color-status-nominal)", fontWeight: 700 }}>
            {rocketGps?.lat ? "FIX LOCKED" : "SEARCHING"}
          </span>
        </div>
      </div>
    </PanelContainer>
  );
});
