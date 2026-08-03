import { useTranslation } from "react-i18next";
import { Mountain, Zap, Gauge } from "lucide-react";
import { ConnectionPanel } from "@widgets/connection-panel";
import { AvionicsSummary } from "@widgets/avionics-summary";
import { PayloadSummary } from "@widgets/payload-summary";
import { DroneSummary } from "@widgets/drone-summary";
import { SystemHealth } from "@widgets/system-health";
import { FlightTimeline } from "@widgets/flight-timeline";
import { TelemetryChart } from "@widgets/charts";
import { TelemetryMap } from "@widgets/map";
import { CameraPanel } from "@widgets/camera-panel";
import { useAppSelector } from "@app/store";
import {
  selectRocketAltitudeHistory,
  selectRocketVelocityHistory,
  selectRocketPressureHistory,
} from "@entities/rocket-packet";

/**
 * Team Dashboard — Technical diagnostics view for the engineering team.
 *
 * Layout:
 * - Top row: Flight Timeline (full width)
 * - Main grid: Avionics + Charts | Payload + Map | Connection + Health + Drone + Camera
 */
export function TeamDashboardPage() {
  const { t } = useTranslation();
  const altitudeData = useAppSelector(selectRocketAltitudeHistory);
  const velocityData = useAppSelector(selectRocketVelocityHistory);
  const pressureData = useAppSelector(selectRocketPressureHistory);

  // Map pressure data to single-value chart format (pressure)
  const pressureChartData = pressureData.map((p) => ({ t: p.t, v: p.p1 }));

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
          overflow: "auto",
        }}
      >
        {/* Column 1: Rocket avionics + Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <AvionicsSummary />
          <TelemetryChart
            id="chart-altitude"
            title={t("telemetry.altitude")}
            icon={<Mountain size={14} />}
            data={altitudeData}
            color="rgb(0, 255, 136)"
            unit={t("units.meters")}
            height={160}
          />
          <TelemetryChart
            id="chart-velocity"
            title={t("telemetry.velocity")}
            icon={<Zap size={14} />}
            data={velocityData}
            color="rgb(255, 170, 0)"
            unit={t("units.metersPerSecond")}
            height={160}
          />
        </div>

        {/* Column 2: Payload + Pressure chart + Map */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <PayloadSummary />
          <TelemetryChart
            id="chart-pressure"
            title={t("telemetry.pressure1")}
            icon={<Gauge size={14} />}
            data={pressureChartData}
            color="rgb(51, 153, 255)"
            unit={t("units.hectopascals")}
            height={160}
          />
          <TelemetryMap />
        </div>

        {/* Column 3: Connection + Health + Drone + Camera */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, minHeight: 0 }}>
          <ConnectionPanel />
          <SystemHealth />
          <DroneSummary />
          <CameraPanel style={{ flex: 1, minHeight: 260 }} />
        </div>
      </div>
    </div>
  );
}
