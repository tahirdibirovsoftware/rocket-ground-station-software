/**
 * TelemetryValue — Displays a single labelled telemetry reading.
 *
 * Shows a small label, a large mono-spaced number, and an optional unit.
 * Used in avionics/payload summary panels and referee dashboard.
 */
import React from "react";

interface TelemetryValueProps {
  /** Field label (e.g., "Altitude"). */
  label: string;
  /** Numeric or string value. */
  value: string | number;
  /** Unit suffix (e.g., "m", "m/s"). */
  unit?: string;
  /** Size variant. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Override value color. */
  color?: string;
  /** HTML id for testing. */
  id?: string;
}

const SIZE_MAP = {
  sm: { value: "1rem", label: "0.625rem", unit: "0.625rem" },
  md: { value: "1.25rem", label: "0.6875rem", unit: "0.6875rem" },
  lg: { value: "1.75rem", label: "0.75rem", unit: "0.75rem" },
  xl: { value: "2.5rem", label: "0.875rem", unit: "0.875rem" },
};

export const TelemetryValue = React.memo(function TelemetryValue({
  label,
  value,
  unit,
  size = "md",
  color,
  id,
}: TelemetryValueProps) {
  const sizes = SIZE_MAP[size];

  return (
    <div id={id} className="telemetry-value" style={{ lineHeight: 1.2 }}>
      <div
        style={{
          fontSize: sizes.label,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-muted)",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
        }}
      >
        <span
          className="font-telemetry"
          style={{
            fontSize: sizes.value,
            fontWeight: 700,
            color: color ?? "var(--color-text-primary)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: sizes.unit,
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});
