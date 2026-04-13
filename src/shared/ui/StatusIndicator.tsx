/**
 * StatusIndicator — Pulsing dot that conveys system state.
 *
 * Used in connection panels, system health displays, and headers.
 * Uses Lucide icons for supplementary states — no emojis.
 */
import React from "react";

export type StatusVariant = "nominal" | "warning" | "critical" | "info" | "muted";

interface StatusIndicatorProps {
  variant: StatusVariant;
  /** Optional label displayed next to the dot. */
  label?: string;
  /** Animate with a pulse. Default: true for nominal/critical */
  pulse?: boolean;
  /** Size in pixels. Default: 10 */
  size?: number;
}

const VARIANT_COLORS: Record<StatusVariant, string> = {
  nominal: "var(--color-status-nominal)",
  warning: "var(--color-status-warning)",
  critical: "var(--color-status-critical)",
  info: "var(--color-status-info)",
  muted: "var(--color-status-muted)",
};

export const StatusIndicator = React.memo(function StatusIndicator({
  variant,
  label,
  pulse,
  size = 10,
}: StatusIndicatorProps) {
  const shouldPulse =
    pulse ?? (variant === "nominal" || variant === "critical");
  const color = VARIANT_COLORS[variant];

  return (
    <span
      className="status-indicator"
      style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
    >
      <span
        className={
          shouldPulse
            ? variant === "critical"
              ? "animate-pulse-critical"
              : "animate-pulse-nominal"
            : ""
        }
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 ${size * 0.6}px ${color}`,
          flexShrink: 0,
        }}
      />
      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
});
