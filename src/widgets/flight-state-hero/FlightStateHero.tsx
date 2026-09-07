/**
 * FlightStateHero — Premium aerospace flight phase & altitude display for Referees.
 *
 * Designed to be read from 3+ meters. Displays current flight phase with color-coded halo,
 * apogee progress bar, ascent/descent rate, and dual parachute deployment status.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Rocket, ShieldCheck, ArrowUpRight, ArrowDownRight, Gauge, CheckCircle2 } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectLatestRocketPacket, selectMaxAltitude } from "@entities/rocket-packet";
import { FlightState } from "@shared/types";

const STATE_COLORS: Record<FlightState, { color: string; bg: string; border: string }> = {
  [FlightState.Pad]: {
    color: "var(--color-status-muted)",
    bg: "rgba(148, 163, 184, 0.1)",
    border: "rgba(148, 163, 184, 0.3)",
  },
  [FlightState.Powered]: {
    color: "var(--color-status-warning)",
    bg: "rgba(255, 170, 0, 0.15)",
    border: "rgba(255, 170, 0, 0.4)",
  },
  [FlightState.Unpowered]: {
    color: "var(--color-status-info)",
    bg: "rgba(0, 200, 255, 0.15)",
    border: "rgba(0, 200, 255, 0.4)",
  },
  [FlightState.Apogee]: {
    color: "var(--color-status-nominal)",
    bg: "rgba(0, 255, 136, 0.15)",
    border: "rgba(0, 255, 136, 0.4)",
  },
  [FlightState.PrimaryChute]: {
    color: "var(--color-status-nominal)",
    bg: "rgba(0, 255, 136, 0.15)",
    border: "rgba(0, 255, 136, 0.4)",
  },
  [FlightState.SecondaryChute]: {
    color: "#ff0055",
    bg: "rgba(255, 0, 85, 0.15)",
    border: "rgba(255, 0, 85, 0.4)",
  },
};

const I18N_KEYS: Record<FlightState, string> = {
  [FlightState.Pad]: "flightState.pad",
  [FlightState.Powered]: "flightState.powered",
  [FlightState.Unpowered]: "flightState.unpowered",
  [FlightState.Apogee]: "flightState.apogee",
  [FlightState.PrimaryChute]: "flightState.primaryChute",
  [FlightState.SecondaryChute]: "flightState.secondaryChute",
};

const FLIGHT_PHASES = [
  FlightState.Pad,
  FlightState.Powered,
  FlightState.Unpowered,
  FlightState.Apogee,
  FlightState.PrimaryChute,
  FlightState.SecondaryChute,
];

export const FlightStateHero = React.memo(function FlightStateHero() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestRocketPacket);
  const maxAltitude = useAppSelector(selectMaxAltitude);

  const isConnected = latest !== null;
  const state = latest?.flightState ?? FlightState.Pad;
  const stateTheme = isConnected
    ? STATE_COLORS[state]
    : {
        color: "var(--color-text-muted)",
        bg: "rgba(255, 255, 255, 0.02)",
        border: "rgba(255, 255, 255, 0.12)",
      };

  const currentAlt = isConnected && typeof latest.altitude === "number" ? latest.altitude : 0;

  // Determine if rocket is ascending or descending
  const isDescending = isConnected && (state === FlightState.PrimaryChute || state === FlightState.SecondaryChute);

  // Progress to apogee target (3000m competition baseline)
  const apogeeProgress = isConnected ? Math.min(100, Math.max(0, (currentAlt / 3000) * 100)) : 0;

  return (
    <PanelContainer
      id="flight-state-hero"
      title={t("dashboard.referee.title", "Flight State & Avionics")}
      icon={<Rocket size={16} />}
      glow={latest?.primaryParachuteDeployed || latest?.secondaryParachuteDeployed ? "green" : "none"}
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldCheck size={14} style={{ color: "var(--color-status-nominal)" }} />
          <span style={{ fontSize: "0.6875rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
            TEKNOFEST A4
          </span>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* Flight State Phase Timeline Stepper */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "0.25rem",
            backgroundColor: "var(--color-bg-tertiary)",
            padding: "0.375rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {FLIGHT_PHASES.map((phase) => {
            const isActive = isConnected && phase === state;
            const phaseTheme = STATE_COLORS[phase];
            return (
              <div
                key={phase}
                style={{
                  textAlign: "center",
                  padding: "0.25rem 0.125rem",
                  fontSize: "0.625rem",
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "var(--font-mono)",
                  color: isActive ? phaseTheme.color : "var(--color-text-muted)",
                  backgroundColor: isActive ? phaseTheme.bg : "transparent",
                  border: isActive ? `1px solid ${phaseTheme.border}` : "1px solid transparent",
                  borderRadius: "0.25rem",
                  transition: "all 200ms ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t(I18N_KEYS[phase])}
              </div>
            );
          })}
        </div>

        {/* Hero Flight Phase Badge */}
        <div
          style={{
            backgroundColor: stateTheme.bg,
            border: isConnected ? `1.5px solid ${stateTheme.border}` : "1px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: "0.5rem",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isConnected ? `0 0 30px ${stateTheme.bg}` : "none",
            transition: "all 300ms ease",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-text-muted)",
              marginBottom: "0.25rem",
            }}
          >
            {isConnected ? "ACTIVE FLIGHT PHASE" : "ROCKET AVIONICS (AA)"}
          </div>

          <div
            style={{
              fontSize: isConnected ? "2.25rem" : "1.6rem",
              fontWeight: 900,
              fontFamily: "var(--font-mono)",
              color: stateTheme.color,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textAlign: "center",
              lineHeight: 1.1,
              textShadow: isConnected ? `0 0 20px ${stateTheme.color}` : "none",
            }}
          >
            {isConnected ? t(I18N_KEYS[state]) : "STANDBY — NO SIGNAL"}
          </div>

          {/* Target Apogee Progress Bar */}
          <div style={{ width: "100%", maxWidth: 320, marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "var(--color-text-muted)", marginBottom: 2 }}>
              <span>Apogee Target</span>
              <span>{isConnected ? `${apogeeProgress.toFixed(0)}% (3000m)` : "STANDBY"}</span>
            </div>
            <div style={{ width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${apogeeProgress}%`,
                  height: "100%",
                  backgroundColor: stateTheme.color,
                  boxShadow: isConnected ? `0 0 8px ${stateTheme.color}` : "none",
                  transition: "width 300ms ease-out",
                }}
              />
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.625rem",
          }}
        >
          {/* Altitude Box */}
          <div
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "0.375rem",
              padding: "0.625rem 0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
                {t("telemetry.altitude")}
              </span>
              <span style={{ fontSize: "0.625rem", color: "var(--color-status-nominal)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {isConnected ? `MAX ${maxAltitude.toFixed(0)}m` : "MAX ---"}
              </span>
            </div>
            <TelemetryValue
              label={t("telemetry.altitude")}
              value={isConnected && typeof latest.altitude === "number" ? latest.altitude.toFixed(0) : "---"}
              unit={t("units.meters")}
              size="lg"
            />
          </div>

          {/* Speed / Velocity Box */}
          <div
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "0.375rem",
              padding: "0.625rem 0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
                {t("telemetry.velocity")}
              </span>
              <span style={{ fontSize: "0.625rem", color: isConnected ? (isDescending ? "var(--color-status-warning)" : "var(--color-status-info)") : "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 2, fontWeight: 700 }}>
                {isDescending ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                {isConnected ? (isDescending ? "DESCENT" : "ASCENT") : "STANDBY"}
              </span>
            </div>
            <TelemetryValue
              label={t("telemetry.velocity")}
              value={isConnected && typeof latest.gpsSpeed === "number" ? latest.gpsSpeed.toFixed(1) : "---"}
              unit={t("units.metersPerSecond")}
              size="lg"
              color={isConnected ? (isDescending ? "var(--color-status-warning)" : "var(--color-status-info)") : undefined}
            />
          </div>
        </div>

        {/* Parachute Status Indicator Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
          }}
        >
          {/* Primary Parachute Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.625rem",
              borderRadius: "0.25rem",
              backgroundColor: latest?.primaryParachuteDeployed ? "rgba(0, 255, 136, 0.15)" : "var(--color-bg-tertiary)",
              border: `1px solid ${latest?.primaryParachuteDeployed ? "var(--color-status-nominal)" : "var(--color-border-default)"}`,
              transition: "all 200ms ease",
            }}
          >
            <CheckCircle2
              size={14}
              style={{
                color: latest?.primaryParachuteDeployed ? "var(--color-status-nominal)" : "var(--color-text-muted)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}>Primary Chute</span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: isConnected
                    ? latest?.primaryParachuteDeployed
                      ? "var(--color-status-nominal)"
                      : "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                }}
              >
                {isConnected ? (latest?.primaryParachuteDeployed ? "DEPLOYED" : "ARMED") : "STANDBY"}
              </span>
            </div>
          </div>

          {/* Secondary Parachute Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.625rem",
              borderRadius: "0.25rem",
              backgroundColor: latest?.secondaryParachuteDeployed ? "rgba(0, 255, 136, 0.15)" : "var(--color-bg-tertiary)",
              border: `1px solid ${latest?.secondaryParachuteDeployed ? "var(--color-status-nominal)" : "var(--color-border-default)"}`,
              transition: "all 200ms ease",
            }}
          >
            <Gauge
              size={14}
              style={{
                color: latest?.secondaryParachuteDeployed ? "var(--color-status-nominal)" : "var(--color-text-muted)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}>Secondary Chute</span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: isConnected
                    ? latest?.secondaryParachuteDeployed
                      ? "var(--color-status-nominal)"
                      : "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                }}
              >
                {isConnected ? (latest?.secondaryParachuteDeployed ? "DEPLOYED" : "ARMED") : "STANDBY"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </PanelContainer>
  );
});
