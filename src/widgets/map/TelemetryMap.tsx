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

/** Default center: Turkey (competition region). */
const DEFAULT_CENTER: L.LatLngTuple = [39.92, 32.85];

interface TelemetryMapProps {
  style?: React.CSSProperties;
}

/** Auto-center the map on the latest rocket position and handle resize invalidation. */
function MapAutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const didCenter = useRef(false);

  useEffect(() => {
    // Force Leaflet to recalculate container dimensions when component mounts or flex resizes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (lat !== 0 && lng !== 0) {
      if (!didCenter.current) {
        map.setView([lat, lng], 14);
        didCenter.current = true;
      } else {
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
      }
    }
  }, [map, lat, lng]);

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
    .filter((p) => p.latitude !== 0 && p.longitude !== 0)
    .map((p) => [p.latitude, p.longitude]);

  const payloadTrail: L.LatLngTuple[] = payloadHistory
    .slice(-200)
    .filter((p) => p.latitude !== 0 && p.longitude !== 0)
    .map((p) => [p.latitude, p.longitude]);

  const droneTrail: L.LatLngTuple[] = droneHistory
    .slice(-200)
    .filter((p) => p.latitude !== 0 && p.longitude !== 0)
    .map((p) => [p.latitude, p.longitude]);

  // Determine initial center
  const initialCenter: L.LatLngTuple =
    rocketGps && rocketGps.lat !== 0
      ? [rocketGps.lat, rocketGps.lng]
      : DEFAULT_CENTER;

  return (
    <PanelContainer
      id="telemetry-map"
      title={t("dashboard.referee.mapTitle", "Map")}
      icon={<MapPin size={14} />}
      style={style}
    >
      <div style={{ height: "100%", width: "100%", minHeight: 250, borderRadius: "0.25rem", overflow: "hidden", display: "flex" }}>
        <MapContainer
          center={initialCenter}
          zoom={rocketGps && rocketGps.lat !== 0 ? 14 : 10}
          style={{ height: "100%", width: "100%", flex: 1, background: "var(--color-bg-tertiary)" }}
          attributionControl={false}
          zoomControl={true}
        >
          {/* Satellite Tiles for desert missions */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          {/* Auto-center on rocket */}
          {rocketGps && (
            <MapAutoCenter lat={rocketGps.lat} lng={rocketGps.lng} />
          )}

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
          {rocketGps && rocketGps.lat !== 0 && (
            <Marker
              position={[rocketGps.lat, rocketGps.lng]}
              icon={ROCKET_ICON}
            />
          )}

          {/* Payload marker */}
          {payloadGps && payloadGps.lat !== 0 && (
            <Marker
              position={[payloadGps.lat, payloadGps.lng]}
              icon={PAYLOAD_ICON}
            />
          )}

          {/* Drone marker */}
          {droneGps && droneGps.lat !== 0 && (
            <Marker
              position={[droneGps.lat, droneGps.lng]}
              icon={DRONE_ICON}
            />
          )}
        </MapContainer>
      </div>
    </PanelContainer>
  );
});
