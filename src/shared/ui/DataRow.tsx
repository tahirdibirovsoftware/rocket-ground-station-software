/**
 * DataRow — Compact key-value row for tabular data display.
 *
 * Used inside panels to show structured telemetry data in a
 * consistent layout (label left, value right).
 */
import React from "react";

interface DataRowProps {
  /** Label text. */
  label: string;
  /** Value (string or React node for custom formatting). */
  value: React.ReactNode;
  /** Optional: use monospace font for the value. Default: true */
  mono?: boolean;
  /** Optional: color override for the value text. */
  valueColor?: string;
  /** HTML id for testing. */
  id?: string;
}

export const DataRow = React.memo(function DataRow({
  label,
  value,
  mono = true,
  valueColor,
  id,
}: DataRowProps) {
  return (
    <div
      id={id}
      className="data-row"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.375rem 0",
        borderBottom: "1px solid var(--color-border-default)",
        fontSize: "0.8125rem",
      }}
    >
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "font-telemetry" : ""}
        style={{
          color: valueColor ?? "var(--color-text-primary)",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
});
