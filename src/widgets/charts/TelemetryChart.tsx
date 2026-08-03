/**
 * TelemetryChart — Canvas-based telemetry chart with rolling window.
 *
 * Renders a time-series chart using HTML5 Canvas for high-frequency
 * updates (5 Hz) without DOM thrashing. Supports configurable:
 * - Title, color, unit
 * - Rolling 60-second window
 * - Auto-scaling Y axis
 */
import React, { useRef, useEffect, useCallback } from "react";
import { PanelContainer } from "@shared/ui";

export interface ChartDataPoint {
  /** Timestamp in ms. */
  t: number;
  /** Value. */
  v: number;
}

interface TelemetryChartProps {
  /** Panel title. */
  title: string;
  /** Panel icon. */
  icon?: React.ReactNode;
  /** Data series. */
  data: ChartDataPoint[];
  /** Line color. */
  color?: string;
  /** Y-axis unit label. */
  unit?: string;
  /** Canvas height in pixels. */
  height?: number;
  /** HTML id. */
  id?: string;
}

function drawChart(
  canvas: HTMLCanvasElement,
  data: ChartDataPoint[],
  color: string,
  unit: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (data.length < 2) {
    ctx.fillStyle = "rgba(100, 116, 139, 0.5)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Awaiting data...", w / 2, h / 2);
    return;
  }

  // Use rolling 60-second window, or start from first point if total session time < 60s
  const firstT = data[0].t;
  const lastT = data[data.length - 1].t;
  const windowMs = 60000;
  const startT = lastT - firstT < windowMs ? firstT : lastT - windowMs;
  const visible = data.filter((d) => d.t >= startT);
  if (visible.length < 2) return;

  const values = visible.map((d) => d.v);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;

  const padLeft = 52;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 20;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  // Grid lines
  ctx.strokeStyle = "rgba(30, 41, 59, 0.8)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const val = maxV - (rangeV / 4) * i;
    const y = padTop + (plotH / 4) * i;
    ctx.fillText(val.toFixed(1), padLeft - 4, y + 3);
  }

  // X-axis time labels
  ctx.textAlign = "center";
  const tRange = lastT - startT;
  for (let i = 0; i <= 3; i++) {
    const tVal = startT + (tRange / 3) * i;
    const x = padLeft + (plotW / 3) * i;
    ctx.fillText(`${(tVal / 1000).toFixed(0)}s`, x, h - 4);
  }

  // Unit label
  ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
  ctx.font = "8px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(unit, padLeft + 2, padTop + 10);

  // Line + gradient fill
  const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  const baseColor = color;
  gradient.addColorStop(0, baseColor.replace(")", ", 0.25)").replace("rgb", "rgba"));
  gradient.addColorStop(1, baseColor.replace(")", ", 0.02)").replace("rgb", "rgba"));

  ctx.beginPath();
  let firstX = 0;
  for (let i = 0; i < visible.length; i++) {
    const x = padLeft + ((visible[i].t - startT) / tRange) * plotW;
    const y = padTop + plotH - ((visible[i].v - minV) / rangeV) * plotH;
    if (i === 0) {
      ctx.moveTo(x, y);
      firstX = x;
    } else {
      ctx.lineTo(x, y);
    }
  }

  // Fill
  const lastX = padLeft + ((visible[visible.length - 1].t - startT) / tRange) * plotW;
  ctx.lineTo(lastX, padTop + plotH);
  ctx.lineTo(firstX, padTop + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Stroke
  ctx.beginPath();
  for (let i = 0; i < visible.length; i++) {
    const x = padLeft + ((visible[i].t - startT) / tRange) * plotW;
    const y = padTop + plotH - ((visible[i].v - minV) / rangeV) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Latest value dot
  const lastVal = visible[visible.length - 1];
  const dotX = padLeft + ((lastVal.t - startT) / tRange) * plotW;
  const dotY = padTop + plotH - ((lastVal.v - minV) / rangeV) * plotH;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export const TelemetryChart = React.memo(function TelemetryChart({
  title,
  icon,
  data,
  color = "rgb(0, 255, 136)",
  unit = "",
  height = 180,
  id,
}: TelemetryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    if (canvasRef.current) {
      drawChart(canvasRef.current, data, color, unit);
    }
  }, [data, color, unit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    render();
  }, [render]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      render();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  return (
    <PanelContainer id={id} title={title} icon={icon}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height,
          borderRadius: "0.25rem",
          display: "block",
        }}
      />
    </PanelContainer>
  );
});
