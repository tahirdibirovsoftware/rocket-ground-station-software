import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Mountain,
  Zap,
  Gauge,
  Activity,
  Radio,
  ArrowUpRight,
  ArrowDown,
  Compass,
} from "lucide-react";
import { ConnectionPanel } from "@widgets/connection-panel";
import { AvionicsSummary } from "@widgets/avionics-summary";
import { PayloadSummary } from "@widgets/payload-summary";
import { DroneSummary } from "@widgets/drone-summary";
import { DroneControl } from "@widgets/drone-control";
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
  selectRocketPacketCount,
  selectLatestRocketPacket,
} from "@entities/rocket-packet";
import {
  selectDroneAltitudeHistory,
  selectDroneVelocityHistory,
  selectDronePressureHistory,
  selectDronePacketCount,
  selectDroneStatus,
} from "@entities/drone-packet";
import {
  selectPayloadAltitudeHistory,
  selectPayloadVelocityHistory,
  selectPayloadGForceHistory,
  selectPayloadPacketCount,
  selectPayloadStatus,
} from "@entities/payload-packet";
import {
  resolveMissionStream,
  type StreamSourceMode,
} from "@shared/lib";

/** Rocket charts panel - isolated subscriptions */
const RocketCharts = React.memo(function RocketCharts() {
  const { t } = useTranslation();
  const altitudeData = useAppSelector(selectRocketAltitudeHistory);
  const velocityData = useAppSelector(selectRocketVelocityHistory);
  const rawPressureData = useAppSelector(selectRocketPressureHistory);
  const pressureData = useMemo(() => rawPressureData.map((p) => ({ t: p.t, v: p.p1 })), [rawPressureData]);

  return (
    <>
      <TelemetryChart
        id="chart-altitude"
        title={t("telemetry.altitude")}
        icon={<Mountain size={14} />}
        data={altitudeData}
        color="rgb(0, 255, 136)"
        unit={t("units.meters")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-velocity"
        title={t("telemetry.velocity")}
        icon={<Zap size={14} />}
        data={velocityData}
        color="rgb(255, 170, 0)"
        unit={t("units.metersPerSecond")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-third"
        title={t("telemetry.pressure1", "Pressure 1")}
        icon={<Gauge size={14} />}
        data={pressureData}
        color="rgb(51, 153, 255)"
        unit={t("units.hectopascals", "hPa")}
        flex
        minHeight={70}
      />
    </>
  );
});

/** Payload charts panel - isolated subscriptions */
const PayloadCharts = React.memo(function PayloadCharts() {
  const { t } = useTranslation();
  const altitudeData = useAppSelector(selectPayloadAltitudeHistory);
  const velocityData = useAppSelector(selectPayloadVelocityHistory);
  const gForceData = useAppSelector(selectPayloadGForceHistory);

  return (
    <>
      <TelemetryChart
        id="chart-altitude"
        title={t("telemetry.altitude")}
        icon={<Mountain size={14} />}
        data={altitudeData}
        color="rgb(0, 255, 136)"
        unit={t("units.meters")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-velocity"
        title={t("telemetry.velocity")}
        icon={<Zap size={14} />}
        data={velocityData}
        color="rgb(255, 170, 0)"
        unit={t("units.metersPerSecond")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-third"
        title={t("droneTelemetry.gForce", "G-Force")}
        icon={<Activity size={14} />}
        data={gForceData}
        color="rgb(255, 102, 178)"
        unit="g"
        flex
        minHeight={70}
      />
    </>
  );
});

/** Drone charts panel - isolated subscriptions */
const DroneCharts = React.memo(function DroneCharts() {
  const { t } = useTranslation();
  const altitudeData = useAppSelector(selectDroneAltitudeHistory);
  const velocityData = useAppSelector(selectDroneVelocityHistory);
  const pressureData = useAppSelector(selectDronePressureHistory);

  return (
    <>
      <TelemetryChart
        id="chart-altitude"
        title={t("telemetry.altitude")}
        icon={<Mountain size={14} />}
        data={altitudeData}
        color="rgb(0, 255, 136)"
        unit={t("units.meters")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-velocity"
        title={t("telemetry.velocity")}
        icon={<Zap size={14} />}
        data={velocityData}
        color="rgb(255, 170, 0)"
        unit={t("units.metersPerSecond")}
        flex
        minHeight={70}
      />
      <TelemetryChart
        id="chart-third"
        title={t("telemetry.pressure1", "Pressure 1")}
        icon={<Gauge size={14} />}
        data={pressureData}
        color="rgb(51, 153, 255)"
        unit={t("units.hectopascals", "hPa")}
        flex
        minHeight={70}
      />
    </>
  );
});

const TeamChartsSection = React.memo(function TeamChartsSection({
  activeStream,
}: {
  activeStream: "rocket" | "payload" | "drone";
}) {
  switch (activeStream) {
    case "payload":
      return <PayloadCharts />;
    case "drone":
      return <DroneCharts />;
    case "rocket":
    default:
      return <RocketCharts />;
  }
});

/**
 * Team Dashboard — Technical diagnostics view for the engineering team.
 *
 * Single-viewport layout (no scrolling anywhere):
 * - Left rail: Connection, Drone Control, System Health + Drone Telemetry
 * - Center column: Avionics/Payload summaries + Stream Switcher + 3 flexible-height charts
 * - Right media column: Satellite Map + Payload Camera filling the viewport
 */
export function TeamDashboardPage() {
  const { t } = useTranslation();

  const rocketCount = useAppSelector(selectRocketPacketCount);
  const payloadCount = useAppSelector(selectPayloadPacketCount);
  const droneCount = useAppSelector(selectDronePacketCount);
  const latestRocket = useAppSelector(selectLatestRocketPacket);
  const droneStatus = useAppSelector(selectDroneStatus);
  const payloadStatus = useAppSelector(selectPayloadStatus);

  const [streamSource, setStreamSource] = useState<StreamSourceMode>("auto");

  // Dynamically resolve active telemetry stream based on flight mission phase
  const { activeStream, missionStage } = useMemo(
    () =>
      resolveMissionStream({
        streamSource,
        rocketCount,
        payloadCount,
        droneCount,
        latestRocket,
        droneStatus,
        payloadStatus,
      }),
    [
      streamSource,
      rocketCount,
      payloadCount,
      droneCount,
      latestRocket,
      droneStatus,
      payloadStatus,
    ]
  );

  return (
    <div
      id="team-dashboard-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Flight Timeline — full width */}
      <FlightTimeline />

      {/* Main 3-pane layout: control rail | telemetry | media */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left control rail — fixed width */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            width: 260,
            minWidth: 240,
            minHeight: 0,
            overflowY: "auto",
            paddingRight: "0.25rem",
            flexShrink: 0,
          }}
        >
          <ConnectionPanel />
          <DroneControl />
          <SystemHealth />
          <DroneSummary />
        </div>

        {/* Center column — telemetry + charts, no scroll */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            flex: 1,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <AvionicsSummary />
            <PayloadSummary />
          </div>
          {/* Stream Selector Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.25rem 0.5rem",
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "0.25rem",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.6875rem",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Radio size={12} style={{ color: "var(--color-status-nominal)" }} />
              <span style={{ fontWeight: 600 }}>
                {t("dashboard.team.chartStream", "CHART STREAM")}:
              </span>
              <span
                style={{
                  color: "var(--color-status-info)",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span>{activeStream.toUpperCase()}</span>
                {streamSource === "auto" && (
                  <span
                    style={{
                      padding: "0.05rem 0.35rem",
                      fontSize: "0.5625rem",
                      fontWeight: 800,
                      borderRadius: "0.2rem",
                      backgroundColor:
                        missionStage === "descent"
                          ? "rgba(0, 255, 136, 0.15)"
                          : missionStage === "ascent"
                          ? "rgba(255, 170, 0, 0.15)"
                          : "rgba(0, 200, 255, 0.15)",
                      color:
                        missionStage === "descent"
                          ? "var(--color-status-nominal)"
                          : missionStage === "ascent"
                          ? "var(--color-status-warning)"
                          : "var(--color-status-info)",
                      border:
                        missionStage === "descent"
                          ? "1px solid rgba(0, 255, 136, 0.3)"
                          : missionStage === "ascent"
                          ? "1px solid rgba(255, 170, 0, 0.3)"
                          : "1px solid rgba(0, 200, 255, 0.3)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {missionStage === "ascent" && <ArrowUpRight size={10} />}
                    {missionStage === "descent" && <ArrowDown size={10} />}
                    {missionStage === "standby" && <Compass size={10} />}
                    {t(
                      `dashboard.team.stage.${missionStage}`,
                      `AUTO: ${missionStage.toUpperCase()}`
                    )}
                  </span>
                )}
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.25rem" }}>
              {(["auto", "rocket", "payload", "drone"] as const).map((source) => {
                const isSelected = streamSource === source;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setStreamSource(source)}
                    style={{
                      padding: "0.15rem 0.5rem",
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      borderRadius: "0.2rem",
                      border: isSelected
                        ? "1px solid var(--color-status-info)"
                        : "1px solid var(--color-border-default)",
                      backgroundColor: isSelected
                        ? "rgba(0, 200, 255, 0.15)"
                        : "var(--color-bg-tertiary)",
                      color: isSelected
                        ? "var(--color-status-info)"
                        : "var(--color-text-muted)",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    {t(`chartStream.${source}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <TeamChartsSection activeStream={activeStream} />
        </div>

        {/* Right media column — map + camera, no scroll */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            flex: 1,
            minWidth: 320,
            minHeight: 0,
          }}
        >
          <TelemetryMap style={{ flex: 1, minHeight: 0 }} />
          <CameraPanel style={{ flex: 1, minHeight: 0, maxHeight: "48%" }} />
        </div>
      </div>
    </div>
  );
}
