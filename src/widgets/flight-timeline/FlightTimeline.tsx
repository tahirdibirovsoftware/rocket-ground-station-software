/**
 * FlightTimeline — Horizontal flight state progression visualization.
 *
 * Shows all 6 flight phases as a horizontal bar with the current
 * phase highlighted. Past phases are dimmed, future phases are ghosted.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Timer } from "lucide-react";
import { PanelContainer } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectLatestRocketPacket } from "@entities/rocket-packet";
import { FlightState } from "@shared/types";

const PHASES: { state: FlightState; key: string }[] = [
  { state: FlightState.Pad, key: "flightState.pad" },
  { state: FlightState.Powered, key: "flightState.powered" },
  { state: FlightState.Unpowered, key: "flightState.unpowered" },
  { state: FlightState.Apogee, key: "flightState.apogee" },
  { state: FlightState.PrimaryChute, key: "flightState.primaryChute" },
  { state: FlightState.SecondaryChute, key: "flightState.secondaryChute" },
];

const PHASE_COLORS: Record<number, string> = {
  [FlightState.Pad]: "var(--color-status-muted)",
  [FlightState.Powered]: "var(--color-status-warning)",
  [FlightState.Unpowered]: "var(--color-status-info)",
  [FlightState.Apogee]: "var(--color-status-nominal)",
  [FlightState.PrimaryChute]: "var(--color-status-nominal)",
  [FlightState.SecondaryChute]: "var(--color-status-critical)",
};

export const FlightTimeline = React.memo(function FlightTimeline() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestRocketPacket);
  const currentState = latest?.flightState ?? FlightState.Pad;

  return (
    <PanelContainer
      id="flight-timeline"
      title="Flight Timeline"
      icon={<Timer size={14} />}
    >
      <div
        style={{
          display: "flex",
          gap: "2px",
          width: "100%",
        }}
      >
        {PHASES.map(({ state, key }) => {
          const isCurrent = state === currentState;
          const isPast = state < currentState;
          const color = PHASE_COLORS[state];

          return (
            <div
              key={state}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              {/* Progress bar segment */}
              <div
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isCurrent
                    ? color
                    : isPast
                      ? color
                      : "var(--color-bg-elevated)",
                  opacity: isCurrent ? 1 : isPast ? 0.5 : 0.2,
                  boxShadow: isCurrent ? `0 0 8px ${color}` : "none",
                  transition: "all 300ms ease",
                }}
              />
              {/* Label */}
              <span
                style={{
                  fontSize: "0.5625rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent
                    ? color
                    : isPast
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-muted)",
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.2,
                  transition: "all 300ms ease",
                }}
              >
                {t(key)}
              </span>
            </div>
          );
        })}
      </div>
    </PanelContainer>
  );
});
