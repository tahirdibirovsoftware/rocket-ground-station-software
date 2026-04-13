import { useTranslation } from "react-i18next";
import { ConnectionPanel } from "@widgets/connection-panel";
import { AvionicsSummary } from "@widgets/avionics-summary";
import { PayloadSummary } from "@widgets/payload-summary";
import { SystemHealth } from "@widgets/system-health";
import { FlightTimeline } from "@widgets/flight-timeline";

/**
 * Team Dashboard — Technical diagnostics view for the engineering team.
 *
 * Layout:
 * - Top row: Flight Timeline (full width)
 * - Main grid: Avionics | Payload | Connection + Health
 */
export function TeamDashboardPage() {
  const { t } = useTranslation();

  return (
    <div
      id="team-dashboard-page"
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
        {t("dashboard.team.title")}
      </h1>

      {/* Flight Timeline — full width */}
      <FlightTimeline />

      {/* Main grid: 3-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.75rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Column 1: Rocket avionics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <AvionicsSummary />
        </div>

        {/* Column 2: Payload scientific */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <PayloadSummary />
        </div>

        {/* Column 3: Connection + Health */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <ConnectionPanel />
          <SystemHealth />
        </div>
      </div>
    </div>
  );
}
