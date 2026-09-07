/**
 * TelemetryMap — Leaflet map showing rocket, payload, and drone GPS tracks.
 */
import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PanelContainer } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectRocketGps, selectRocketHistory } from "@entities/rocket-packet";
import { selectPayloadGps, selectPayloadHistory } from "@entities/payload-packet";
import { selectDroneGps, selectDroneHistory } from "@entities/drone-packet";

import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths (bundler strips them)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ROCKET_ICON = new L.DivIcon({
  className: "",
  html: `<div style="
    width: 14px; height: 14px; border-radius: 50%;
    background: #ff3366; border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(255,51,102,0.6);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const PAYLOAD_ICON = new L.DivIcon({
  className: "",
  html: `<div style="
    width: 14px; height: 14px; border-radius: 50%;
    background: #3399ff; border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(51,153,255,0.6);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const DRONE_ICON = new L.DivIcon({
  className: "",
  html: `<div style="
    width: 14px; height: 14px; border-radius: 50%;
    background: #00ff88; border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(0,255,136,0.6);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Default center: Teknofest Aksaray Rocket Launch Base */
const DEFAULT_CENTER: L.LatLngTuple = [38.3687, 34.0370];

function isValidGpsCoord(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return Math.abs(lat) > 0.005 && Math.abs(lng) > 0.005 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

interface TelemetryMapProps {
  style?: React.CSSProperties;
}

/**
 * MapTrackAll — keeps every active GPS source (rocket, payload, drone)
 * in view. Fits bounds to all markers on first fix and re-fits whenever
 * a tracked point leaves the current view.
 */
function MapTrackAll({ points }: { points: L.LatLngTuple[] }) {
  const map = useMap();
  const didInit = useRef(false);

  useEffect(() => {
    // Force Leaflet to recalculate container dimensions when component mounts or flex resizes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (points.length === 0) return;

    if (!didInit.current) {
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
      } else {
        map.setView(points[0], 14);
      }
      didInit.current = true;
      return;
    }

    // Only re-center when a tracked source actually leaves the viewport
    const bounds = map.getBounds();
    const allInside = points.every(([lat, lng]) => bounds.contains([lat, lng]));
    if (!allInside) {
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), {
          padding: [48, 48],
          maxZoom: 16,
          animate: true,
          duration: 0.5,
        });
      } else {
        map.panTo(points[0], { animate: true, duration: 0.5 });
      }
    }
  }, [map, points]);

  return null;
}

export const TelemetryMap = React.memo(function TelemetryMap({ style }: TelemetryMapProps) {
  const { t } = useTranslation();
  const rocketGps = useAppSelector(selectRocketGps);
  const payloadGps = useAppSelector(selectPayloadGps);
  const droneGps = useAppSelector(selectDroneGps);

  const rocketHistory = useAppSelector(selectRocketHistory);
  const payloadHistory = useAppSelector(selectPayloadHistory);
  const droneHistory = useAppSelector(selectDroneHistory);

  // Build polyline arrays (last 200 points for performance)
  const rocketTrail: L.LatLngTuple[] = rocketHistory
    .slice(-200)
    .filter((p) => isValidGpsCoord(p.latitude, p.longitude))
    .map((p) => [p.latitude, p.longitude]);

  const payloadTrail: L.LatLngTuple[] = payloadHistory
    .slice(-200)
    .filter((p) => isValidGpsCoord(p.latitude, p.longitude))
    .map((p) => [p.latitude, p.longitude]);

  const droneTrail: L.LatLngTuple[] = droneHistory
    .slice(-200)
    .filter((p) => isValidGpsCoord(p.latitude, p.longitude))
    .map((p) => [p.latitude, p.longitude]);

  const rocketHasFix = !!(rocketGps && isValidGpsCoord(rocketGps.lat, rocketGps.lng));
  const payloadHasFix = !!(payloadGps && isValidGpsCoord(payloadGps.lat, payloadGps.lng));
  const droneHasFix = !!(droneGps && isValidGpsCoord(droneGps.lat, droneGps.lng));

  // Active GPS sources (rocket → payload → drone), only with valid fixes
  const trackedPoints: L.LatLngTuple[] = [
    ...(rocketHasFix ? [[rocketGps!.lat, rocketGps!.lng] as L.LatLngTuple] : []),
    ...(payloadHasFix ? [[payloadGps!.lat, payloadGps!.lng] as L.LatLngTuple] : []),
    ...(droneHasFix ? [[droneGps!.lat, droneGps!.lng] as L.LatLngTuple] : []),
  ];

  // Determine initial center
  const initialCenter: L.LatLngTuple = trackedPoints[0] ?? DEFAULT_CENTER;

  return (
    <PanelContainer
      id="telemetry-map"
      title={t("dashboard.referee.mapTitle", "Map")}
      icon={<MapPin size={14} />}
      style={style}
    >
      <div style={{ position: "relative", height: "100%", width: "100%", borderRadius: "0.25rem", overflow: "hidden", display: "flex" }}>
        {/* On-Map GPS Status HUD */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            backgroundColor: "rgba(10, 15, 25, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "4px",
            padding: "4px 8px",
            backdropFilter: "blur(4px)",
            pointerEvents: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "0.625rem",
          }}
        >
          {/* Rocket GPS Status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#ff3366", fontWeight: 700 }}>ROCKET (AA)</span>
            <span
              style={{
                color:
                  rocketHistory.length === 0
                    ? "var(--color-text-muted)"
                    : rocketHasFix
                    ? "var(--color-status-nominal)"
                    : "var(--color-status-warning)",
                fontWeight: 600,
              }}
            >
              {rocketHistory.length === 0
                ? t("mapHud.noSignal", "NO SIGNAL")
                : rocketHasFix
                ? t("mapHud.gpsLocked", "3D FIX")
                : t("mapHud.indoorsNoFix", "INDOORS (0 SATS)")}
            </span>
          </div>

          {/* Payload GPS Status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#3399ff", fontWeight: 700 }}>PAYLOAD (BB)</span>
            <span
              style={{
                color:
                  payloadHistory.length === 0
                    ? "var(--color-text-muted)"
                    : payloadHasFix
                    ? "var(--color-status-nominal)"
                    : "var(--color-status-warning)",
                fontWeight: 600,
              }}
            >
              {payloadHistory.length === 0
                ? t("mapHud.noSignal", "NO SIGNAL")
                : payloadHasFix
                ? t("mapHud.gpsLocked", "3D FIX")
                : t("mapHud.indoorsNoFix", "INDOORS (0 SATS)")}
            </span>
          </div>

          {/* Drone GPS Status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#00ff88", fontWeight: 700 }}>DRONE (CC)</span>
            <span
              style={{
                color:
                  droneHistory.length === 0
                    ? "var(--color-text-muted)"
                    : droneHasFix
                    ? "var(--color-status-nominal)"
                    : "var(--color-status-warning)",
                fontWeight: 600,
              }}
            >
              {droneHistory.length === 0
                ? t("mapHud.noSignal", "NO SIGNAL")
                : droneHasFix
                ? t("mapHud.gpsLocked", "3D FIX")
                : t("mapHud.indoorsNoFix", "INDOORS (0 SATS)")}
            </span>
          </div>
        </div>

        <MapContainer
          center={initialCenter}
          zoom={trackedPoints.length > 0 ? 14 : 10}
          style={{ height: "100%", width: "100%", flex: 1, background: "var(--color-bg-tertiary)" }}
          attributionControl={false}
          zoomControl={true}
        >
          {/* Satellite Tiles for desert missions */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          {/* Track all active GPS sources (rocket, payload, drone) */}
          <MapTrackAll points={trackedPoints} />

          {/* Rocket trail */}
          {rocketTrail.length > 1 && (
            <Polyline
              positions={rocketTrail}
              color="#ff3366"
              weight={3}
              opacity={0.7}
              dashArray="6 4"
            />
          )}

          {/* Payload trail */}
          {payloadTrail.length > 1 && (
            <Polyline
              positions={payloadTrail}
              color="#3399ff"
              weight={3}
              opacity={0.7}
              dashArray="6 4"
            />
          )}

          {/* Drone trail */}
          {droneTrail.length > 1 && (
            <Polyline
              positions={droneTrail}
              color="#00ff88"
              weight={3}
              opacity={0.7}
              dashArray="6 4"
            />
          )}

          {/* Rocket marker */}
          {rocketHasFix && (
            <Marker
              position={[rocketGps!.lat, rocketGps!.lng]}
              icon={ROCKET_ICON}
            />
          )}

          {/* Payload marker */}
          {payloadHasFix && (
            <Marker
              position={[payloadGps!.lat, payloadGps!.lng]}
              icon={PAYLOAD_ICON}
            />
          )}

          {/* Drone marker */}
          {droneHasFix && (
            <Marker
              position={[droneGps!.lat, droneGps!.lng]}
              icon={DRONE_ICON}
            />
          )}
        </MapContainer>
      </div>
    </PanelContainer>
  );
});
