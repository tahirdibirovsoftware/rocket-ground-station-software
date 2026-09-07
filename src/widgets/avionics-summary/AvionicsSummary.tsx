/**
 * AvionicsSummary — Live rocket telemetry values panel.
 *
 * Displays altitude, velocity, pressure, flight state, and parachute status.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { PanelContainer, TelemetryValue, FlightStateBadge, DataRow } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectLatestRocketPacket,
  selectRocketPacketCount,
} from "@entities/rocket-packet";
import { FlightState } from "@shared/types";

export const AvionicsSummary = React.memo(function AvionicsSummary() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestRocketPacket);
  const count = useAppSelector(selectRocketPacketCount);

  const hasSignal = count > 0 && latest !== null;
  const flight = latest?.flightState ?? FlightState.Pad;
  const glow =
    hasSignal && (flight === FlightState.PrimaryChute || flight === FlightState.SecondaryChute)
      ? "green"
      : "none";

  return (
    <PanelContainer
      id="avionics-summary"
      title={t("avionics.title", "Rocket Avionics (AA)")}
      icon={<Rocket size={14} />}
      glow={glow}
      dense
      headerRight={
        <span
          className="font-telemetry"
          style={{
            fontSize: "0.625rem",
            color: hasSignal ? "var(--color-status-nominal)" : "var(--color-text-muted)",
          }}
        >
          #{count}
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {/* Flight State or Standby */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {hasSignal ? (
            <FlightStateBadge state={flight} size="sm" />
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.2rem 0.625rem",
                borderRadius: "0.25rem",
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                background: "var(--color-bg-tertiary)",
                color: "var(--color-text-muted)",
                border: "1px dashed var(--color-border-default)",
              }}
            >
              {t("avionics.awaitingSignal", "STANDBY - AWAITING SIGNAL (AA)")}
            </span>
          )}
        </div>

        {/* Primary Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={hasSignal && typeof latest.altitude === "number" ? latest.altitude.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="md"
          />
          <TelemetryValue
            label={t("telemetry.velocity")}
            value={
              hasSignal && typeof latest.verticalVelocity === "number"
                ? latest.verticalVelocity.toFixed(1)
                : hasSignal && typeof latest.gpsSpeed === "number"
                ? latest.gpsSpeed.toFixed(1)
                : "---"
            }
            unit={t("units.metersPerSecond")}
            size="md"
            color={
              hasSignal && typeof latest.verticalVelocity === "number" && latest.verticalVelocity < 0
                ? "var(--color-status-warning)"
                : undefined
            }
          />
          <TelemetryValue
            label={t("telemetry.pressure1")}
            value={hasSignal && typeof latest.pressure === "number" ? latest.pressure.toFixed(1) : "---"}
            unit={t("units.hectopascals")}
            size="md"
          />
        </div>

        {/* Compact status rows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem 0.75rem" }}>
          <DataRow
            label={t("telemetry.latitude")}
            value={hasSignal && typeof latest.latitude === "number" && latest.latitude !== 0 ? latest.latitude.toFixed(6) : "---"}
          />
          <DataRow
            label={t("telemetry.longitude")}
            value={hasSignal && typeof latest.longitude === "number" && latest.longitude !== 0 ? latest.longitude.toFixed(6) : "---"}
          />
          <DataRow
            label={t("avionics.drogueChute", "Drogue (Apogee)")}
            value={
              !hasSignal
                ? "---"
                : latest.primaryParachuteDeployed
                ? t("telemetry.deployed")
                : t("telemetry.notDeployed")
            }
            valueColor={
              hasSignal && latest.primaryParachuteDeployed
                ? "var(--color-status-nominal)"
                : "var(--color-text-secondary)"
            }
          />
          <DataRow
            label={t("avionics.mainChute", "Main (500m)")}
            value={
              !hasSignal
                ? "---"
                : latest.secondaryParachuteDeployed
                ? t("telemetry.deployed")
                : t("telemetry.notDeployed")
            }
            valueColor={
              hasSignal && latest.secondaryParachuteDeployed
                ? "var(--color-status-critical)"
                : "var(--color-text-secondary)"
            }
          />
          {hasSignal && (
            <DataRow
              label={t("avionics.bnoCalib", "BNO Calib")}
              value={
                latest.bnoCalib === 3
                  ? t("avionics.calibrated", "FULL (3/3)")
                  : `${latest.bnoCalib ?? 0}/3`
              }
              valueColor={latest.bnoCalib === 3 ? "var(--color-status-nominal)" : "var(--color-status-warning)"}
            />
          )}
          {hasSignal && (
            <DataRow
              label={t("droneTelemetry.gForce", "G-Force")}
              value={typeof latest.gForce === "number" ? `${latest.gForce.toFixed(2)} g` : "---"}
            />
          )}
        </div>
      </div>
    </PanelContainer>
  );
});
