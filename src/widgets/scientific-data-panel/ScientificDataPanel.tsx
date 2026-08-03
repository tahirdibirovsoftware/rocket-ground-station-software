/**
 * ScientificDataPanel — Live 5 Hz scientific sensor display for referees.
 *
 * Shows the latest scientific sensor value prominently with a
 * mini sparkline of recent readings rendered on a canvas.
 */
import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Beaker } from "lucide-react";
import { PanelContainer, TelemetryValue } from "@shared/ui";
import { useAppSelector } from "@app/store";
import {
  selectLatestPayloadPacket,
  selectPayloadPacketCount,
  selectScientificDataHistory,
} from "@entities/payload-packet";

/** Draw a sparkline on a canvas element. */
function drawSparkline(
  canvas: HTMLCanvasElement,
  data: { t: number; v: number }[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Use last 100 points for the sparkline
  const points = data.slice(-100);
  const values = points.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Draw gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(51, 153, 255, 0.3)");
  gradient.addColorStop(1, "rgba(51, 153, 255, 0.02)");

  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < points.length; i++) {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((values[i] - min) / range) * (h * 0.85) - h * 0.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Fill under curve
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((values[i] - min) / range) * (h * 0.85) - h * 0.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(51, 153, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw latest point
  if (points.length > 0) {
    const lastX = w;
    const lastY =
      h -
      ((values[values.length - 1] - min) / range) * (h * 0.85) -
      h * 0.05;
    ctx.beginPath();
    ctx.arc(lastX - 2, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(51, 153, 255, 1)";
    ctx.fill();
  }
}

export const ScientificDataPanel = React.memo(function ScientificDataPanel() {
  const { t } = useTranslation();
  const latest = useAppSelector(selectLatestPayloadPacket);
  const count = useAppSelector(selectPayloadPacketCount);
  const history = useAppSelector(selectScientificDataHistory);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && history.length > 1) {
      drawSparkline(canvasRef.current, history);
    }
  }, [history]);

  return (
    <PanelContainer
      id="scientific-data-panel"
      title={t("dashboard.referee.scientificData")}
      icon={<Beaker size={14} />}
      headerRight={
        <span
          className="font-telemetry"
          style={{ fontSize: "0.625rem", color: "var(--color-text-muted)" }}
        >
          {count} @ 5{t("units.hertz")}
        </span>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        {/* Large current value */}
        <TelemetryValue
          label={t("telemetry.scientificData")}
          value={latest && typeof latest.temp === "number" ? latest.temp.toFixed(3) : "---"}
          size="xl"
          color="var(--color-status-info)"
        />

        {/* Sparkline canvas */}
        <canvas
          ref={canvasRef}
          width={360}
          height={80}
          style={{
            width: "100%",
            maxWidth: 360,
            height: 80,
            borderRadius: "0.25rem",
            backgroundColor: "var(--color-bg-tertiary)",
          }}
        />

        {/* Timestamp */}
        <span
          className="font-telemetry"
          style={{
            fontSize: "0.6875rem",
            color: "var(--color-text-muted)",
          }}
        >
          T+{latest && typeof latest.timestampMs === "number" ? `${(latest.timestampMs / 1000).toFixed(1)}s` : "---"}
        </span>
      </div>
    </PanelContainer>
  );
});
