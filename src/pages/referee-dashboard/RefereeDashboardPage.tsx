/**
 * RefereeDashboardPage — Clean, high-contrast, ultra-premium display for competition judges.
 *
 * Layout: 2x2 quadrant grid with mission control header bar
 * - Top-left: Flight State Hero (stepper, state badge, max alt, velocity)
 * - Top-right: Tri-System GPS Positioning (Rocket, Payload, Drone + separation vector)
 * - Bottom-left: Scientific Telemetry (5 Hz live reading, Min/Max/Avg, full-bleed sparkline)
 * - Bottom-right: Tactical Satellite Map (Rocket, Payload, Drone markers + trajectories)
 */
import { useTranslation } from "react-i18next";
import { Radio, Award } from "lucide-react";
import { FlightStateHero } from "@widgets/flight-state-hero";
import { DualGpsPanel } from "@widgets/dual-gps-panel";
import { ScientificDataPanel } from "@widgets/scientific-data-panel";
import { TelemetryMap } from "@widgets/map";
import { useAppSelector } from "@app/store";
import { selectConnectionMode } from "@entities/connection";

export function RefereeDashboardPage() {
  const { t } = useTranslation();
  const connectionMode = useAppSelector(selectConnectionMode);

  return (
    <div
      id="referee-dashboard-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        height: "100%",
      }}
    >
      {/* ── Mission Control Referee Banner Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.875rem",
          backgroundColor: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "0.375rem",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Award size={18} style={{ color: "var(--color-status-nominal)" }} />
          <div>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 800,
                color: "var(--color-text-primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}
            >
              {t("dashboard.referee.title", "REFEREE MISSION CONTROL MONITOR")}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
              Official TEKNOFEST A4 Rocket Competition Judge Evaluation View
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {/* Signal Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.6875rem", fontFamily: "var(--font-mono)" }}>
            <Radio size={14} style={{ color: connectionMode === "disconnected" ? "var(--color-status-critical)" : "var(--color-status-nominal)" }} />
            <span style={{ color: "var(--color-text-secondary)" }}>
              RFD Link: <strong style={{ color: connectionMode === "disconnected" ? "var(--color-status-critical)" : "var(--color-status-nominal)" }}>{connectionMode.toUpperCase()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── 2x2 Quadrant Grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "0.75rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Q1: Flight State Hero */}
        <FlightStateHero />

        {/* Q2: Tri-System GPS Positioning */}
        <DualGpsPanel />

        {/* Q3: Scientific Telemetry */}
        <ScientificDataPanel />

        {/* Q4: Tactical Map */}
        <TelemetryMap />
      </div>
    </div>
  );
}
