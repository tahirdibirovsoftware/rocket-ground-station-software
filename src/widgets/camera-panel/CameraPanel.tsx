/**
 * CameraPanel — Live Native USB Camera video feed widget.
 *
 * Captures USB webcam frames directly from V4L2/FFmpeg via Rust Tauri IPC.
 * Strictly ignores internal/built-in cameras for auto-connection & recovery.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Camera, CameraOff, RefreshCw, Settings } from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { useTauriEvent } from "@shared/hooks";
import { PanelContainer } from "@shared/ui";

export interface CameraDeviceInfo {
  id: String;
  name: String;
  is_usb: boolean;
}

export const CameraPanel = React.memo(function CameraPanel() {
  const { t } = useTranslation();
  const lastFrameTimeRef = useRef<number>(0);

  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [cameraLabel, setCameraLabel] = useState<string>("");
  const [devicesList, setDevicesList] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

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
        // USB camera found -> connect to it
        await connectToDevice(String(usbDev.id));
      } else {
        // NO USB camera connected -> stop any active stream & display waiting status
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

      // If streaming, but no frame arrived for > 2.5s, stream died (e.g. unplugged)
      if (frameSrc && now - lastFrameTimeRef.current > 2500) {
        setFrameSrc(null);
        setError("USB Camera disconnected. Reconnect camera to resume.");
        scanDevices();
      } else if (!frameSrc && !isScanning) {
        // Periodically poll to auto-detect USB camera re-plug
        scanDevices();
      }
    }, 2000);

    return () => clearInterval(watchdog);
  }, [frameSrc, isScanning, scanDevices]);

  // Initial scan & mount
  useEffect(() => {
    scanDevices();

    return () => {
      // Stop camera stream on unmount
      invoke(IPC_COMMANDS.STOP_CAMERA).catch(() => {});
    };
  }, []);

  return (
    <PanelContainer
      id="camera-panel"
      title={t("dashboard.team.payloadCamera", "Payload Camera Feed")}
      icon={<Camera size={14} />}
      headerRight={
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Video feed viewport */}
        <div
          style={{
            width: "100%",
            height: 190,
            position: "relative",
            borderRadius: "0.25rem",
            backgroundColor: "var(--color-bg-tertiary)",
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
                  objectFit: "cover",
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
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  color: "var(--color-status-nominal)",
                  border: "1px solid rgba(0, 255, 136, 0.3)",
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
                LIVE
              </div>
              {/* Camera Label Overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.625rem",
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <CameraOff size={28} style={{ color: "var(--color-text-muted)" }} />
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                {isScanning
                  ? t("dashboard.team.cameraScanning", "Scanning Devices...")
                  : t("dashboard.team.cameraDisconnected", "Camera Disconnected")}
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  color: "var(--color-text-muted)",
                  maxWidth: 240,
                  lineHeight: "1.3",
                }}
              >
                {error ||
                  t(
                    "dashboard.team.cameraHint",
                    "Connect an external USB payload/rocket camera to start the feed.",
                  )}
              </span>
            </div>
          )}
        </div>

        {/* Manual selector dropdown (toggled ONLY via settings button) */}
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
    </PanelContainer>
  );
});
