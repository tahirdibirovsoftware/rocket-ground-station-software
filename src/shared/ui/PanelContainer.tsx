/**
 * PanelContainer — Dark bordered panel used to wrap dashboard widgets.
 *
 * Provides consistent spacing, borders, and optional glow effects.
 */
import React from "react";

interface PanelContainerProps {
  /** Panel title (rendered in header bar). */
  title?: string;
  /** Optional icon rendered left of the title. */
  icon?: React.ReactNode;
  /** Glow variant for status highlighting. */
  glow?: "green" | "red" | "none";
  /** Extra CSS class. */
  className?: string;
  /** Custom inline style. */
  style?: React.CSSProperties;
  /** Panel content. */
  children: React.ReactNode;
  /** Optional right-side header content (controls, badges, etc.). */
  headerRight?: React.ReactNode;
  /** HTML id for testing. */
  id?: string;
  /** Compact layout — tighter header/body padding for dense dashboards. */
  dense?: boolean;
}

export const PanelContainer = React.memo(function PanelContainer({
  title,
  icon,
  glow = "none",
  className = "",
  style,
  children,
  headerRight,
  id,
  dense = false,
}: PanelContainerProps) {
  const glowClass =
    glow === "green"
      ? "panel-glow-green"
      : glow === "red"
        ? "panel-glow-red"
        : "";

  return (
    <div
      id={id}
      className={`panel-container ${glowClass} ${className}`}
      style={{
        backgroundColor: "var(--color-bg-panel)",
        border: "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-panel)",
        boxShadow: "var(--shadow-panel)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        ...style,
      }}
    >
      {title && (
        <div
          className="panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: dense ? "0.4rem 0.75rem" : "0.625rem 0.875rem",
            borderBottom: "1px solid var(--color-border-default)",
            backgroundColor: "var(--color-bg-secondary)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {icon && (
              <span style={{ color: "var(--color-text-muted)", display: "flex" }}>
                {icon}
              </span>
            )}
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-text-secondary)",
              }}
            >
              {title}
            </span>
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div
        className="panel-body"
        style={{
          padding: dense ? "0.5rem 0.75rem" : "var(--spacing-panel)",
          flex: 1,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
});
