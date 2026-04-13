import { useTranslation } from "react-i18next";
import { FlightStateHero } from "@widgets/flight-state-hero";
import { DualGpsPanel } from "@widgets/dual-gps-panel";
import { ScientificDataPanel } from "@widgets/scientific-data-panel";

/**
 * Referee Dashboard — Clean, high-contrast display for competition judges.
 *
 * Layout: 2x2 quadrant grid
 * - Top-left: Flight State Hero (massive state label + altitude/velocity)
 * - Top-right: Dual GPS Panel (rocket vs payload coordinates)
 * - Bottom-left: Scientific Data Panel (5 Hz sensor + sparkline)
 * - Bottom-right: Map placeholder (Phase 9)
 *
 * Design rules:
 * - Large typography (readable from 3+ meters)
 * - Maximum 6 data fields visible
 * - NO debug info, NO raw hex, NO packet counts
 */
export function RefereeDashboardPage() {
  const { t } = useTranslation();

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
      {/* Page header */}
      <h1
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        {t("dashboard.referee.title")}
      </h1>

      {/* 2x2 Quadrant Grid */}
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

        {/* Q2: Dual GPS */}
        <DualGpsPanel />

        {/* Q3: Scientific Data */}
        <ScientificDataPanel />

        {/* Q4: Map (Phase 9 placeholder) */}
        <div
          id="map-placeholder"
          style={{
            backgroundColor: "var(--color-bg-panel)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-panel)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-muted)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Map — Phase 9
        </div>
      </div>
    </div>
  );
}
