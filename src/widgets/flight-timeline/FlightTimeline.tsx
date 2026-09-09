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
import { selectLatestRocketPacket, selectRocketPacketCount } from "@entities/rocket-packet";
import { selectLatestDronePacket, selectDronePacketCount } from "@entities/drone-packet";
import { FlightState, DroneFlightState } from "@shared/types";

const ROCKET_PHASES: { state: FlightState; key: string }[] = [
  { state: FlightState.Pad, key: "flightState.pad" },
  { state: FlightState.Powered, key: "flightState.powered" },
  { state: FlightState.Unpowered, key: "flightState.unpowered" },
  { state: FlightState.Apogee, key: "flightState.apogee" },
  { state: FlightState.PrimaryChute, key: "flightState.primaryChute" },
  { state: FlightState.SecondaryChute, key: "flightState.secondaryChute" },
];

const ROCKET_PHASE_COLORS: Record<number, string> = {
  [FlightState.Pad]: "var(--color-status-muted)",
  [FlightState.Powered]: "var(--color-status-warning)",
  [FlightState.Unpowered]: "var(--color-status-info)",
  [FlightState.Apogee]: "var(--color-status-nominal)",
  [FlightState.PrimaryChute]: "var(--color-status-nominal)",
  [FlightState.SecondaryChute]: "var(--color-status-critical)",
};

const DRONE_PHASES: { state: DroneFlightState; key: string }[] = [
  { state: DroneFlightState.Standby, key: "droneFlightState.standby" },
  { state: DroneFlightState.Launched, key: "droneFlightState.launched" },
  { state: DroneFlightState.Descending, key: "droneFlightState.descending" },
  { state: DroneFlightState.Landed, key: "droneFlightState.landed" },
];

const DRONE_PHASE_COLORS: Record<number, string> = {
  [DroneFlightState.Standby]: "var(--color-status-muted)",
  [DroneFlightState.Launched]: "var(--color-status-warning)",
  [DroneFlightState.Descending]: "var(--color-status-nominal)",
  [DroneFlightState.Landed]: "var(--color-status-info)",
};

interface FlightTimelineProps {
  activeStream?: "rocket" | "payload" | "drone";
}

export const FlightTimeline = React.memo(function FlightTimeline({
  activeStream,
}: FlightTimelineProps) {
  const { t } = useTranslation();
  const latestRocket = useAppSelector(selectLatestRocketPacket);
  const latestDrone = useAppSelector(selectLatestDronePacket);
  const rocketCount = useAppSelector(selectRocketPacketCount);
  const droneCount = useAppSelector(selectDronePacketCount);

  const isDroneMode = activeStream === "drone" || (activeStream !== "rocket" && droneCount > 0 && rocketCount === 0);

  const hasSignal = isDroneMode ? latestDrone !== null : latestRocket !== null;
  const currentState = isDroneMode
    ? (latestDrone?.stateCode ?? null)
    : (latestRocket?.flightState ?? null);

  const phases = isDroneMode ? DRONE_PHASES : ROCKET_PHASES;
  const colors = isDroneMode ? DRONE_PHASE_COLORS : ROCKET_PHASE_COLORS;

  return (
    <PanelContainer
      id="flight-timeline"
      title={isDroneMode ? t("app.droneFlightTimeline", "Drone Flight Timeline") : t("app.flightTimeline", "Flight Timeline")}
      icon={<Timer size={14} />}
      headerRight={
        <span
          style={{
            fontSize: "0.625rem",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            color: hasSignal ? "var(--color-status-nominal)" : "var(--color-text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          {isDroneMode
            ? hasSignal
              ? "DRONE (CC) ACTIVE"
              : t("avionics.awaitingSignalDrone", "STANDBY - AWAITING SIGNAL (CC)")
            : hasSignal
              ? "ROCKET (AA) ACTIVE"
              : t("avionics.awaitingSignal", "STANDBY - AWAITING SIGNAL (AA)")}
        </span>
      }
    >
      <div
        style={{
          display: "flex",
          gap: "2px",
          width: "100%",
        }}
      >
        {phases.map(({ state, key }) => {
          const isCurrent = hasSignal && (state === currentState || (isDroneMode && state === DroneFlightState.Landed && currentState === 4));
          const isPast = hasSignal && currentState !== null && state < currentState;
          const color = colors[state];

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
