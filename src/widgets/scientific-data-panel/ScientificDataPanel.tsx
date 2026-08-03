/**
 * ScientificDataPanel — Premium aerospace 5 Hz scientific payload telemetry display for Referees.
 *
 * Prominently displays the latest scientific sensor value with real-time Min/Max/Avg stats
 * and a full-bleed Canvas-based sparkline chart optimized for continuous 5 Hz mutations.
 */
import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Beaker, Activity } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectLatestPayloadPacket,
  selectPayloadPacketCount,
  selectScientificDataHistory,
} from "@entities/payload-packet";

/** Draw a smooth high-contrast sparkline chart on a canvas element. */
function drawSparkline(
  canvas: HTMLCanvasElement,
  data: { t: number; v: number }[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;

  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Take up to last 150 data points (~30 seconds at 5 Hz)
  const points = data.slice(-150);
  const values = points.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Background Grid Lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.25);
  ctx.lineTo(w, h * 0.25);
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w, h * 0.5);
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w, h * 0.75);
  ctx.stroke();

  // Gradient fill under curve
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(0, 200, 255, 0.35)");
  gradient.addColorStop(1, "rgba(0, 200, 255, 0.0)");

  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < points.length; i++) {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((values[i] - min) / range) * (h * 0.8) - h * 0.1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw stroke line
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((values[i] - min) / range) * (h * 0.8) - h * 0.1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#00c8ff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00c8ff";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0; // Reset shadow

  // Draw current live value dot
  if (points.length > 0) {
    const lastX = w - 4;
    const lastY =
      h -
      ((values[values.length - 1] - min) / range) * (h * 0.8) -
      h * 0.1;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#00c8ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export const ScientificDataPanel = React.memo(function ScientificDataPanel() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestPayloadPacket);
  const count = useAppSelector(selectPayloadPacketCount);
  const history = useAppSelector(selectScientificDataHistory);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute Min, Max, Avg statistics
  const stats = useMemo(() => {
    if (history.length === 0) return { min: "---", max: "---", avg: "---" };
    const vals = history.map((d) => d.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      min: min.toFixed(3),
      max: max.toFixed(3),
      avg: avg.toFixed(3),
    };
  }, [history]);

  useEffect(() => {
    if (canvasRef.current && history.length > 1) {
      drawSparkline(canvasRef.current, history);
    }
  }, [history]);

  return (
    <PanelContainer
      id="scientific-data-panel"
      title={t("dashboard.referee.scientificData", "Payload Scientific Telemetry")}
      icon={<Beaker size={16} />}
      headerRight={
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity size={13} style={{ color: "#00c8ff" }} />
          <span
            className="font-telemetry"
            style={{ fontSize: "0.6875rem", color: "#00c8ff", fontWeight: 700 }}
          >
            {count} pkts @ 5 Hz
          </span>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          height: "100%",
          justifyContent: "space-between",
        }}
      >
        {/* Main Sensor Value & Statistics Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "1rem",
            alignItems: "center",
            backgroundColor: "var(--color-bg-tertiary)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "0.375rem",
            padding: "0.75rem 1rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 2,
              }}
            >
              LIVE SCIENTIFIC SENSOR DATA
            </div>
            <TelemetryValue
              label={t("telemetry.scientificData")}
              value={latest && typeof latest.temp === "number" ? latest.temp.toFixed(3) : "---"}
              size="xl"
              color="#00c8ff"
            />
          </div>

          {/* Min / Max / Avg Stats Pill */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono)",
              backgroundColor: "var(--color-bg-secondary)",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>MIN:</span>
              <strong style={{ color: "var(--color-text-primary)" }}>{stats.min}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>MAX:</span>
              <strong style={{ color: "var(--color-status-nominal)" }}>{stats.max}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--color-text-muted)" }}>AVG:</span>
              <strong style={{ color: "#00c8ff" }}>{stats.avg}</strong>
            </div>
          </div>
        </div>

        {/* Full-Bleed Canvas Chart */}
        <div
          style={{
            flex: 1,
            minHeight: 120,
            backgroundColor: "var(--color-bg-tertiary)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "0.375rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
            }}
          />
        </div>
      </div>
    </PanelContainer>
  );
});
