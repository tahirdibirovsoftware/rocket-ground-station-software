/**
 * PayloadSummary — Live payload scientific telemetry panel.
 *
 * Displays payload GPS coordinates, altitude, scientific sensor data,
 * and the payload flight phase (PRE-LAUNCH / IN AIR / ON GROUND).
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

  const phaseLabel = (phase: number) =>
    phase === 2
      ? t("payloadPhase.onGround", "ON GROUND")
      : phase === 1
        ? t("payloadPhase.inAir", "IN AIR")
        : t("payloadPhase.preLaunch", "PRE-LAUNCH");

  const phase = latest?.flightPhase ?? 0;
  const onGround = latest?.onGround ?? (phase === 2);
  const outputsActive = latest?.outputsActive ?? false;

  const phaseColor = (p: number) => {
    switch (p) {
      case 2:
        return {
          bg: "rgba(255, 51, 102, 0.12)",
          border: "rgba(255, 51, 102, 0.4)",
          text: "var(--color-status-critical)",
        };
      case 1:
        return {
          bg: "rgba(0, 200, 255, 0.12)",
          border: "rgba(0, 200, 255, 0.4)",
          text: "var(--color-status-info)",
        };
      default:
        return {
          bg: "rgba(0, 255, 136, 0.08)",
          border: "rgba(0, 255, 136, 0.25)",
          text: "var(--color-status-nominal)",
        };
    }
  };

  const currentPhaseStyle = phaseColor(phase);

  return (
    <PanelContainer
      id="payload-summary"
      title={t("dashboard.referee.scientificData")}
      icon={<Cpu size={14} />}
      dense
      headerRight={
        <span
          className="font-telemetry"
          style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}
        >
          #{count}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {/* Status banners: Flight Phase + Actuator Output State */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid",
              fontSize: "0.625rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              backgroundColor: currentPhaseStyle.bg,
              borderColor: currentPhaseStyle.border,
              color: currentPhaseStyle.text,
            }}
          >
            <span>{phaseLabel(phase)}</span>
            <span style={{ fontSize: "0.5625rem", opacity: 0.85 }}>
              {onGround
                ? t("payloadPhase.landedStatus", "LANDED")
                : t("payloadPhase.skyStatus", "IN SKY")}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid",
              fontSize: "0.5625rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.03em",
              backgroundColor: outputsActive
                ? "rgba(255, 170, 0, 0.12)"
                : "rgba(255, 255, 255, 0.04)",
              borderColor: outputsActive
                ? "rgba(255, 170, 0, 0.35)"
                : "rgba(255, 255, 255, 0.08)",
              color: outputsActive
                ? "var(--color-status-warning)"
                : "var(--color-text-muted)",
            }}
          >
            {outputsActive
              ? t("payloadPhase.buzzerActive", "ACTIVE (Buzzer/ESC Firing)")
              : t("payloadPhase.buzzerCutoff", "CUTOFF (Motion)")}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <TelemetryValue
            label={t("telemetry.relativeAltitude", "Altitude (AGL)")}
            value={latest && typeof latest.relAlt === "number" ? latest.relAlt.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.scientificData")}
            value={latest && typeof latest.temp === "number" ? latest.temp.toFixed(2) : "---"}
            color="var(--color-status-info)"
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.mslAltitude", "MSL Alt (Sea Level)")}
            value={latest && typeof latest.altitude === "number" ? latest.altitude.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
          <TelemetryValue
            label={t("droneTelemetry.climbRate", "Climb Rate")}
            value={latest && typeof latest.verticalVelocity === "number" ? latest.verticalVelocity.toFixed(2) : "---"}
            unit="m/s"
            size="md"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem 0.75rem" }}>
          <DataRow
            label={t("telemetry.latitude")}
            value={latest && typeof latest.latitude === "number" ? latest.latitude.toFixed(6) : "---"}
          />
          <DataRow
            label={t("telemetry.longitude")}
            value={latest && typeof latest.longitude === "number" ? latest.longitude.toFixed(6) : "---"}
          />
          <DataRow
            label={t("payloadPhase.fastG", "Fast-G Filter")}
            value={latest && typeof latest.fastG === "number" ? `${latest.fastG.toFixed(2)} g` : "---"}
          />
          <DataRow
            label={t("droneTelemetry.gForce", "G-Force")}
            value={latest && typeof latest.gForce === "number" ? `${latest.gForce.toFixed(2)} g` : "---"}
          />
          <DataRow
            label={t("telemetry.pressure1")}
            value={latest && typeof latest.pressure === "number" ? `${latest.pressure.toFixed(1)} hPa` : "---"}
          />
          <DataRow
            label={t("telemetry.timestamp")}
            value={latest ? `${latest.timestampMs} ${t("units.milliseconds")}` : "---"}
          />
        </div>
      </div>
    </PanelContainer>
  );
});
