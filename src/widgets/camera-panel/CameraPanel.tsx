/**
 * CameraPanel — Live Native USB Camera video feed widget.
 *
 * Captures USB webcam frames directly from V4L2/FFmpeg via Rust Tauri IPC.
 * Features auto-stretching high-definition viewport, full-screen expansion,
 * and high-contrast aerospace standby HUD when disconnected.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Camera, CameraOff, RefreshCw, Settings, Maximize2, Minimize2, Radio, Video } from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { useTauriEvent } from "@shared/hooks";
import { PanelContainer } from "@shared/ui";

export interface CameraDeviceInfo {
  id: String;
  name: String;
  is_usb: boolean;
}

export interface CameraPanelProps {
  style?: React.CSSProperties;
}

export const CameraPanel = React.memo(function CameraPanel({ style }: CameraPanelProps) {
  const { t } = useTranslation();
  const lastFrameTimeRef = useRef<number>(0);

  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [cameraLabel, setCameraLabel] = useState<string>("");
  const [devicesList, setDevicesList] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen to native JPEG frame events from Tauri backend
  useTauriEvent<string>("camera_frame", useCallback((dataUrl: string) => {
    setFrameSrc(dataUrl);
    setError(null);
    lastFrameTimeRef.current = Date.now();
  }, []));

  // Listen to disconnection events from Tauri backend
  useTauriEvent<void>("camera_disconnected", useCallback(() => {
    setFrameSrc(null);
    setError("USB Camera disconnected. Connect a USB payload camera to view feed.");
  }, []));

  // Connect to a camera device via Rust IPC
  const connectToDevice = useCallback(async (deviceId?: string) => {
    setIsScanning(true);
    setError(null);

    try {
      const activeDev = await invoke<CameraDeviceInfo>(IPC_COMMANDS.START_CAMERA, {
        device: deviceId || null,
      });

      setSelectedDeviceId(String(activeDev.id));
      setCameraLabel(String(activeDev.name));
      lastFrameTimeRef.current = Date.now();
    } catch (err: any) {
      console.error("Failed to start native camera stream:", err);
      setError(String(err));
      setFrameSrc(null);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Fetch available camera devices and strictly auto-connect ONLY to USB camera
  const scanDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      const cameras = await invoke<CameraDeviceInfo[]>(IPC_COMMANDS.LIST_CAMERAS);
      setDevicesList(cameras || []);

      if (!cameras || cameras.length === 0) {
        setError("No video input devices found on system.");
        setFrameSrc(null);
        return;
      }

      // Strictly find external USB camera
      const usbDev = cameras.find((c) => c.is_usb);

      if (usbDev) {
        await connectToDevice(String(usbDev.id));
      } else {
        await invoke(IPC_COMMANDS.STOP_CAMERA).catch(() => {});
        setFrameSrc(null);
        setSelectedDeviceId("");
        setError("No external USB camera detected. Plug in a USB payload camera.");
      }
    } catch (err: any) {
      console.error("Failed to list cameras:", err);
      setError(String(err));
      setFrameSrc(null);
    } finally {
      setIsScanning(false);
    }
  }, [connectToDevice]);

  // Watchdog & USB Auto-Reconnect Poller
  useEffect(() => {
    const watchdog = setInterval(() => {
      const now = Date.now();

      if (frameSrc && now - lastFrameTimeRef.current > 2500) {
        setFrameSrc(null);
        setError("USB Camera disconnected. Reconnect camera to resume.");
        scanDevices();
      } else if (!frameSrc && !isScanning) {
        scanDevices();
      }
    }, 2000);

    return () => clearInterval(watchdog);
  }, [frameSrc, isScanning, scanDevices]);

  // Initial scan & mount
  useEffect(() => {
    scanDevices();

    return () => {
      invoke(IPC_COMMANDS.STOP_CAMERA).catch(() => {});
    };
  }, []);

  return (
    <PanelContainer
      id="camera-panel"
      title={t("dashboard.team.payloadCamera", "Payload Camera Feed")}
      icon={<Camera size={14} />}
      style={style}
      headerRight={
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          {frameSrc && (
            <span
              style={{
                fontSize: "0.625rem",
                fontFamily: "var(--font-mono)",
                color: "var(--color-status-nominal)",
                backgroundColor: "rgba(0, 255, 136, 0.1)",
                border: "1px solid rgba(0, 255, 136, 0.2)",
                padding: "0.15rem 0.4rem",
                borderRadius: "0.2rem",
                marginRight: "0.25rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Video size={10} /> REC MP4
            </span>
          )}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            style={{
              background: "none",
              border: "none",
              color: isFullscreen ? "var(--color-status-nominal)" : "var(--color-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "0.25rem",
              borderRadius: "0.25rem",
            }}
            title="Toggle fullscreen video feed"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => setShowSelector((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              color: showSelector ? "var(--color-status-nominal)" : "var(--color-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "0.25rem",
              borderRadius: "0.25rem",
            }}
            title="Toggle camera selection"
          >
            <Settings size={12} />
          </button>
          <button
            onClick={scanDevices}
            disabled={isScanning}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "0.25rem",
              borderRadius: "0.25rem",
            }}
            title={t("dashboard.team.cameraRescan", "Rescan camera devices")}
          >
            <RefreshCw
              size={12}
              className={isScanning ? "animate-spin" : ""}
              style={{ color: "var(--color-text-secondary)" }}
            />
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%" }}>
        {/* Video feed viewport — Auto-stretching to fill panel height */}
        <div
          style={{
            flex: 1,
            minHeight: 260,
            width: "100%",
            position: "relative",
            borderRadius: "0.25rem",
            backgroundColor: "#050a14",
            overflow: "hidden",
            border: "1px solid var(--color-border-default)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {frameSrc ? (
            <>
              <img
                src={frameSrc}
                alt="Payload Camera Feed"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  backgroundColor: "#000",
                }}
              />
              {/* Live Overlay */}
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "var(--color-status-nominal)",
                  border: "1px solid rgba(0, 255, 136, 0.4)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "var(--color-status-nominal)",
                    boxShadow: "0 0 8px var(--color-status-nominal)",
                  }}
                />
                LIVE PAYLOAD FEED
              </div>

              {/* Camera Label Overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-secondary)",
                  maxWidth: "85%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                {cameraLabel}
              </div>
            </>
          ) : (
            /* High-Contrast Aerospace Standby HUD */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "1.5rem 1rem",
                textAlign: "center",
                width: "100%",
                height: "100%",
                background: "radial-gradient(circle at center, rgba(0,200,255,0.05) 0%, rgba(5,10,20,0.95) 70%)",
              }}
            >
              {/* Radar Icon Circle */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  border: "1.5px dashed rgba(148, 163, 184, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  boxShadow: "0 0 20px rgba(0,0,0,0.5)",
                }}
              >
                <CameraOff size={24} style={{ color: "var(--color-text-muted)" }} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {isScanning
                    ? t("dashboard.team.cameraScanning", "SCANNING USB PORTS...")
                    : t("dashboard.team.cameraDisconnected", "CAMERA STANDBY / DISCONNECTED")}
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--color-text-muted)",
                    maxWidth: 280,
                    lineHeight: "1.4",
                    marginTop: 4,
                  }}
                >
                  {error ||
                    t(
                      "dashboard.team.cameraHint",
                      "Connect an external USB payload camera. Auto-detect & session recording active.",
                    )}
                </div>
              </div>

              {/* Status Poller Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-muted)",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                <Radio size={10} style={{ color: "var(--color-status-info)" }} />
                <span>USB AUTO-DETECTOR POLLING ACTIVE</span>
              </div>
            </div>
          )}
        </div>

        {/* Manual selector dropdown */}
        {showSelector && devicesList.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              padding: "0.375rem",
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <label
              style={{
                fontSize: "0.5625rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-muted)",
              }}
            >
              Select Active Video Source
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => connectToDevice(e.target.value)}
              style={{
                width: "100%",
                padding: "0.25rem 0.5rem",
                fontSize: "0.6875rem",
                fontFamily: "var(--font-sans)",
                backgroundColor: "var(--color-bg-tertiary)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "0.2rem",
                color: "var(--color-text-secondary)",
                outline: "none",
              }}
            >
              <option value="">-- Choose Camera --</option>
              {devicesList.map((dev) => (
                <option key={String(dev.id)} value={String(dev.id)}>
                  {String(dev.name)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fullscreen Overlay Modal */}
      {isFullscreen && frameSrc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Minimize2 size={14} /> Exit Fullscreen
            </button>
          </div>
          <img
            src={frameSrc}
            alt="Fullscreen Payload Camera Feed"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </PanelContainer>
  );
});
