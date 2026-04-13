/**
 * ConnectionPanel — Serial port connection controls and mock mode toggle.
 *
 * Provides port selection, baud rate config, connect/disconnect buttons,
 * and mock data generator controls.
 */
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Plug, Unplug, Play, Square, RotateCcw } from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { PanelContainer, StatusIndicator } from "@shared/ui";
import { useAppSelector, useAppDispatch } from "@app/store";
import {
  selectConnectionMode,
  selectIsConnected,
  connectionLoading,
  connectionError,
} from "@entities/connection";

export const ConnectionPanel = React.memo(function ConnectionPanel() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectConnectionMode);
  const isConnected = useAppSelector(selectIsConnected);

  const [rocketPort, setRocketPort] = useState("/dev/ttyUSB0");
  const [payloadPort, setPayloadPort] = useState("/dev/ttyUSB1");
  const [baudRate, setBaudRate] = useState("115200");

  const handleConnect = useCallback(async () => {
    dispatch(connectionLoading());
    try {
      await invoke(IPC_COMMANDS.CONNECT_SERIAL, {
        rocketPort,
        payloadPort,
        baudRate: parseInt(baudRate, 10),
      });
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch, rocketPort, payloadPort, baudRate]);

  const handleDisconnect = useCallback(async () => {
    try {
      await invoke(IPC_COMMANDS.DISCONNECT_SERIAL);
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch]);

  const handleStartMock = useCallback(async () => {
    dispatch(connectionLoading());
    try {
      await invoke(IPC_COMMANDS.START_MOCK);
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch]);

  const handleStopMock = useCallback(async () => {
    try {
      await invoke(IPC_COMMANDS.STOP_MOCK);
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch]);

  const handleResetMock = useCallback(async () => {
    try {
      await invoke(IPC_COMMANDS.RESET_MOCK);
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch]);

  const statusVariant =
    mode === "disconnected" ? "muted" : mode === "mock" ? "info" : "nominal";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.375rem 0.5rem",
    fontSize: "0.75rem",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--color-bg-tertiary)",
    border: "1px solid var(--color-border-default)",
    borderRadius: "0.25rem",
    color: "var(--color-text-primary)",
    outline: "none",
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.75rem",
    fontSize: "0.6875rem",
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    border: "1px solid var(--color-border-default)",
    borderRadius: "0.25rem",
    cursor: "pointer",
    transition: "all 100ms ease",
  };

  return (
    <PanelContainer
      id="connection-panel"
      title={t("connection.title")}
      icon={<Plug size={14} />}
      headerRight={<StatusIndicator variant={statusVariant} size={8} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Serial Ports */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            <label style={labelStyle}>Rocket {t("connection.port")}</label>
            <input
              style={inputStyle}
              value={rocketPort}
              onChange={(e) => setRocketPort(e.target.value)}
              disabled={isConnected}
            />
          </div>
          <div>
            <label style={labelStyle}>Payload {t("connection.port")}</label>
            <input
              style={inputStyle}
              value={payloadPort}
              onChange={(e) => setPayloadPort(e.target.value)}
              disabled={isConnected}
            />
          </div>
        </div>

        {/* Baud Rate */}
        <div>
          <label style={labelStyle}>{t("connection.baudRate")}</label>
          <select
            style={inputStyle}
            value={baudRate}
            onChange={(e) => setBaudRate(e.target.value)}
            disabled={isConnected}
          >
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
          </select>
        </div>

        {/* Connect / Disconnect */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!isConnected ? (
            <button
              style={{
                ...buttonStyle,
                backgroundColor: "rgba(0, 255, 136, 0.1)",
                color: "var(--color-status-nominal)",
                borderColor: "var(--color-status-nominal)",
              }}
              onClick={handleConnect}
            >
              <Plug size={12} /> {t("connection.connect")}
            </button>
          ) : (
            <button
              style={{
                ...buttonStyle,
                backgroundColor: "rgba(255, 51, 102, 0.1)",
                color: "var(--color-status-critical)",
                borderColor: "var(--color-status-critical)",
              }}
              onClick={handleDisconnect}
            >
              <Unplug size={12} /> {t("connection.disconnect")}
            </button>
          )}
        </div>

        {/* Mock Controls */}
        <div
          style={{
            borderTop: "1px solid var(--color-border-default)",
            paddingTop: "0.75rem",
          }}
        >
          <label style={labelStyle}>{t("connection.mockMode")}</label>
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem" }}>
            <button
              style={{
                ...buttonStyle,
                backgroundColor: "rgba(51, 153, 255, 0.1)",
                color: "var(--color-status-info)",
                borderColor: "var(--color-status-info)",
              }}
              onClick={handleStartMock}
              disabled={isConnected}
            >
              <Play size={12} /> {t("connection.startMock")}
            </button>
            <button
              style={{
                ...buttonStyle,
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-secondary)",
              }}
              onClick={handleStopMock}
              disabled={mode !== "mock"}
            >
              <Square size={12} /> {t("connection.stopMock")}
            </button>
            <button
              style={{
                ...buttonStyle,
                backgroundColor: "var(--color-bg-tertiary)",
                color: "var(--color-text-secondary)",
              }}
              onClick={handleResetMock}
            >
              <RotateCcw size={12} /> {t("connection.resetMock")}
            </button>
          </div>
        </div>
      </div>
    </PanelContainer>
  );
});

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.625rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
  marginBottom: "0.25rem",
};
