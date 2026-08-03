/**
 * FlightStateHero — Large flight phase display for the referee dashboard.
 *
 * Designed to be readable from 3+ meters. Shows the current flight state
 * with a massive color-coded label and parachute deployment flash.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectLatestRocketPacket } from "@entities/rocket-packet";
import { FlightState } from "@shared/types";

const STATE_COLORS: Record<FlightState, string> = {
  [FlightState.Pad]: "var(--color-status-muted)",
  [FlightState.Powered]: "var(--color-status-warning)",
  [FlightState.Unpowered]: "var(--color-status-info)",
  [FlightState.Apogee]: "var(--color-status-nominal)",
  [FlightState.PrimaryChute]: "var(--color-status-nominal)",
  [FlightState.SecondaryChute]: "var(--color-status-critical)",
};

const I18N_KEYS: Record<FlightState, string> = {
  [FlightState.Pad]: "flightState.pad",
  [FlightState.Powered]: "flightState.powered",
  [FlightState.Unpowered]: "flightState.unpowered",
  [FlightState.Apogee]: "flightState.apogee",
  [FlightState.PrimaryChute]: "flightState.primaryChute",
  [FlightState.SecondaryChute]: "flightState.secondaryChute",
};

export const FlightStateHero = React.memo(function FlightStateHero() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestRocketPacket);
  const state = latest?.flightState ?? FlightState.Pad;
  const color = STATE_COLORS[state];

  const isDeployed =
    latest?.primaryParachuteDeployed || latest?.secondaryParachuteDeployed;

  const glow = isDeployed ? "green" : "none";

  return (
    <PanelContainer
      id="flight-state-hero"
      title="Flight State"
      icon={<Rocket size={14} />}
      glow={glow}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1rem 0",
          minHeight: 160,
        }}
      >
        {/* Massive flight state label */}
        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            fontFamily: "var(--font-mono)",
            color,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            textAlign: "center",
            lineHeight: 1.1,
            textShadow: `0 0 24px ${color}`,
            transition: "all 300ms ease",
          }}
        >
          {t(I18N_KEYS[state])}
        </div>

        {/* Key metrics row */}
        <div
          style={{
            display: "flex",
            gap: "2rem",
            justifyContent: "center",
          }}
        >
          <TelemetryValue
            label={t("telemetry.altitude")}
            value={latest && typeof latest.altitude === "number" ? latest.altitude.toFixed(0) : "---"}
            unit={t("units.meters")}
            size="xl"
          />
          <TelemetryValue
            label={t("telemetry.velocity")}
            value={latest && typeof latest.gpsSpeed === "number" ? latest.gpsSpeed.toFixed(1) : "---"}
            unit={t("units.metersPerSecond")}
            size="xl"
          />
        </div>

        {/* Parachute deployment status */}
        {isDeployed && (
          <div
            className="animate-pulse-nominal"
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--color-status-nominal)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "0.5rem 1.5rem",
              border: "2px solid var(--color-status-nominal)",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(0, 255, 136, 0.1)",
            }}
          >
            {latest?.primaryParachuteDeployed
              ? t("telemetry.primaryParachute")
              : t("telemetry.secondaryParachute")}{" "}
            {t("telemetry.deployed")}
          </div>
        )}
      </div>
    </PanelContainer>
  );
});
