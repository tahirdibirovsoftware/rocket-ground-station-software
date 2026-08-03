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

  const flight = latest?.flightState ?? FlightState.Pad;
  const glow =
    flight === FlightState.PrimaryChute || flight === FlightState.SecondaryChute
      ? "green"
      : "none";

  return (
    <PanelContainer
      id="avionics-summary"
      title={t("telemetry.altitude")}
      icon={<Rocket size={14} />}
      glow={glow}
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
        {/* Flight State */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <FlightStateBadge state={flight} size="lg" />
        </div>

        {/* Primary Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={latest && typeof latest.altitude === "number" ? latest.altitude.toFixed(1) : "---"}
            unit={t("units.meters")}
            size="lg"
          />
          <TelemetryValue
            label={t("telemetry.velocity")}
            value={latest && typeof latest.gpsSpeed === "number" ? latest.gpsSpeed.toFixed(1) : "---"}
            unit={t("units.metersPerSecond")}
            size="lg"
            color={
              latest && typeof latest.gpsSpeed === "number" && latest.gpsSpeed < 0
                ? "var(--color-status-warning)"
                : undefined
            }
          />
          <TelemetryValue
            label={t("telemetry.pressure1")}
            value={latest && typeof latest.pressure === "number" ? latest.pressure.toFixed(1) : "---"}
            unit={t("units.hectopascals")}
          />
        </div>

        {/* Secondary Data */}
        <DataRow
          label={t("telemetry.latitude")}
          value={latest && typeof latest.latitude === "number" ? latest.latitude.toFixed(6) : "---"}
        />
        <DataRow
          label={t("telemetry.longitude")}
          value={latest && typeof latest.longitude === "number" ? latest.longitude.toFixed(6) : "---"}
        />
        <DataRow
          label={t("telemetry.primaryParachute")}
          value={
            latest?.primaryParachuteDeployed
              ? t("telemetry.deployed")
              : t("telemetry.notDeployed")
          }
          valueColor={
            latest?.primaryParachuteDeployed
              ? "var(--color-status-nominal)"
              : "var(--color-text-secondary)"
          }
        />
        <DataRow
          label={t("telemetry.secondaryParachute")}
          value={
            latest?.secondaryParachuteDeployed
              ? t("telemetry.deployed")
              : t("telemetry.notDeployed")
          }
          valueColor={
            latest?.secondaryParachuteDeployed
              ? "var(--color-status-critical)"
              : "var(--color-text-secondary)"
          }
        />
        <DataRow
          label={t("telemetry.timestamp")}
          value={latest ? `${latest.timestampMs} ${t("units.milliseconds")}` : "---"}
        />
      </div>
    </PanelContainer>
  );
});
