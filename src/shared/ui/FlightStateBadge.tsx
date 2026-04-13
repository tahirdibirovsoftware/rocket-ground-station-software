/**
 * FlightStateBadge — Displays the current flight phase as a styled badge.
 *
 * Maps FlightState enum values to human-readable labels and color-coded badges.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { FlightState } from "@shared/types";

interface FlightStateBadgeProps {
  state: FlightState;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  /** HTML id for testing. */
  id?: string;
}

const STATE_COLORS: Record<FlightState, { bg: string; text: string; border: string }> = {
  [FlightState.Pad]: {
    bg: "rgba(100, 116, 139, 0.15)",
    text: "var(--color-status-muted)",
    border: "var(--color-status-muted)",
  },
  [FlightState.Powered]: {
    bg: "rgba(255, 170, 0, 0.15)",
    text: "var(--color-status-warning)",
    border: "var(--color-status-warning)",
  },
  [FlightState.Unpowered]: {
    bg: "rgba(51, 153, 255, 0.15)",
    text: "var(--color-status-info)",
    border: "var(--color-status-info)",
  },
  [FlightState.Apogee]: {
    bg: "rgba(0, 255, 136, 0.15)",
    text: "var(--color-status-nominal)",
    border: "var(--color-status-nominal)",
  },
  [FlightState.PrimaryChute]: {
    bg: "rgba(0, 255, 136, 0.2)",
    text: "var(--color-status-nominal)",
    border: "var(--color-status-nominal)",
  },
  [FlightState.SecondaryChute]: {
    bg: "rgba(255, 51, 102, 0.15)",
    text: "var(--color-status-critical)",
    border: "var(--color-status-critical)",
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

const SIZE_MAP = {
  sm: { fontSize: "0.625rem", padding: "0.125rem 0.5rem" },
  md: { fontSize: "0.75rem", padding: "0.25rem 0.75rem" },
  lg: { fontSize: "1rem", padding: "0.375rem 1rem" },
};

export const FlightStateBadge = React.memo(function FlightStateBadge({
  state,
  size = "md",
  id,
}: FlightStateBadgeProps) {
  const { t } = useTranslation();
  const colors = STATE_COLORS[state];
  const sizeStyle = SIZE_MAP[size];

  return (
    <span
      id={id}
      className="flight-state-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: "9999px",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
        ...sizeStyle,
      }}
    >
      {t(I18N_KEYS[state])}
    </span>
  );
});
