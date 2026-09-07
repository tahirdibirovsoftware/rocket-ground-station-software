/**
 * ConnectionPanel — Serial port connection controls and mock mode toggle.
 */
import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Plug, Unplug, Play, Square, RotateCcw, AlertCircle } from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { PanelContainer, StatusIndicator } from "@shared/ui";
import { useAppSelector, useAppDispatch } from "@app/store";
import {
  connectionLoading,
  connectionError,
} from "@entities/connection";

export const ConnectionPanel = React.memo(function ConnectionPanel() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const connState = useAppSelector((state) => state.connection);

  const rfdConnected = !!connState.rfdPort;
  const isMock = connState.mode === "mock";
  const anyConnected = rfdConnected;

  const [rfdPortInput, setRfdPortInput] = useState("");
  const [rfdBaud, setRfdBaud] = useState("115200");
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const fetchPorts = async () => {
      try {
        const ports = await invoke<any[]>(IPC_COMMANDS.LIST_SERIAL_PORTS);
        if (active) setAvailablePorts(ports || []);
      } catch (e) {
        console.error("Failed to list ports", e);
      }
    };
    
    fetchPorts();
    const interval = setInterval(fetchPorts, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const connectRfd = async () => {
    if (!rfdPortInput) throw new Error("RFD port not selected");
    await invoke(IPC_COMMANDS.CONNECT_RFD, {
      port: rfdPortInput,
      baudRate: parseInt(rfdBaud, 10),
    });
  };

  const handleGlobalToggle = useCallback(async () => {
    dispatch(connectionLoading());
    try {
      if (anyConnected) {
        if (rfdConnected) await invoke(IPC_COMMANDS.DISCONNECT_RFD);
      } else {
        if (rfdPortInput) {
          await connectRfd();
        } else {
          dispatch(connectionError("Please select RFD serial port."));
        }
      }
    } catch (e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch, rfdConnected, anyConnected, rfdPortInput, rfdBaud]);

  const toggleRfd = useCallback(async () => {
    dispatch(connectionLoading());
    try {
      if (rfdConnected) {
        await invoke(IPC_COMMANDS.DISCONNECT_RFD);
      } else {
        await connectRfd();
      }
    } catch(e) {
      dispatch(connectionError(String(e)));
    }
  }, [dispatch, rfdConnected, rfdPortInput, rfdBaud]);

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
    connState.mode === "disconnected" ? "muted" : isMock ? "info" : "nominal";

  const renderPortOptions = () => [
    <option key="none" value="">None / Disconnected</option>,
    ...availablePorts.map((p) => {
      const label = p.manufacturer ? `${p.path} (${p.manufacturer})` : p.path;
      return <option key={p.path} value={p.path}>{label}</option>;
    })
  ];

  const renderBaudOptions = () => (
    <>
      <option value="9600">9600</option>
      <option value="19200">19200</option>
      <option value="38400">38400</option>
      <option value="57600">57600</option>
      <option value="115200">115200</option>
    </>
  );

  return (
    <PanelContainer
      id="connection-panel"
      title={t("connection.title")}
      icon={<Plug size={14} />}
      dense
      headerRight={<StatusIndicator variant={statusVariant} size={8} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        
        {/* Global Error Banner */}
        {connState.error && (
           <div style={errorBannerStyle}>
              <AlertCircle size={12} /> {connState.error}
           </div>
        )}

        {/* Global Controls */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderBottom: "1px solid var(--color-border-default)",
          paddingBottom: "0.75rem",
        }}>
          {!anyConnected ? (
              <button
                style={{
                  ...buttonStyle,
                  backgroundColor: "rgba(0, 255, 136, 0.1)",
                  color: "var(--color-status-nominal)",
                  borderColor: "var(--color-status-nominal)",
                }}
                onClick={handleGlobalToggle}
                disabled={isMock}
              >
                <Plug size={12} /> CONNECT RFD
              </button>
            ) : (
              <button
                style={{
                  ...buttonStyle,
                  backgroundColor: "rgba(255, 51, 102, 0.1)",
                  color: "var(--color-status-critical)",
                  borderColor: "var(--color-status-critical)",
                }}
                onClick={handleGlobalToggle}
              >
                <Unplug size={12} /> DISCONNECT RFD
              </button>
          )}

          <div style={{ display: "flex", gap: "0.375rem" }}>
             <button style={mockButtonStyle} onClick={handleStartMock} disabled={anyConnected || isMock}>
               <Play size={12} /> START MOCK
             </button>
             <button style={mockButtonStyle} onClick={handleStopMock} disabled={!isMock}>
               <Square size={12} /> STOP
             </button>
             <button style={mockButtonStyle} onClick={handleResetMock}>
               <RotateCcw size={12} />
             </button>
          </div>
        </div>

        {/* RFD Receiver Card */}
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label style={labelStyle}>RFD Serial Port</label>
              <select style={inputStyle} value={rfdPortInput} onChange={(e) => setRfdPortInput(e.target.value)} disabled={rfdConnected || isMock}>
                {renderPortOptions()}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Baud Rate</label>
              <select style={inputStyle} value={rfdBaud} onChange={(e) => setRfdBaud(e.target.value)} disabled={rfdConnected || isMock}>
                {renderBaudOptions()}
              </select>
            </div>
          </div>
          <div style={{ marginTop: "0.5rem" }}>
             <button style={rfdConnected ? disconnectBtnStyle : connectBtnStyle} onClick={toggleRfd} disabled={isMock || (!rfdPortInput && !rfdConnected)}>
               {rfdConnected ? <Unplug size={12}/> : <Plug size={12}/>}
               {rfdConnected ? " DISCONNECT RFD RECEIVER" : " CONNECT RFD RECEIVER"}
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-tertiary)",
  border: "1px solid var(--color-border-active)",
  borderRadius: "0.375rem",
  padding: "0.5rem",
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

const connectBtnStyle: React.CSSProperties = {
  ...buttonStyle,
  width: "100%",
  justifyContent: "center",
  backgroundColor: "rgba(0, 255, 136, 0.05)",
  color: "var(--color-status-nominal)",
  borderColor: "var(--color-border-default)",
};

const disconnectBtnStyle: React.CSSProperties = {
  ...buttonStyle,
  width: "100%",
  justifyContent: "center",
  backgroundColor: "rgba(255, 51, 102, 0.05)",
  color: "var(--color-status-critical)",
  borderColor: "rgba(255, 51, 102, 0.3)",
};

const mockButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "var(--color-bg-tertiary)",
  color: "var(--color-text-secondary)",
  padding: "0.375rem 0.5rem",
};

const errorBannerStyle: React.CSSProperties = {
  backgroundColor: "rgba(255, 51, 102, 0.1)",
  color: "var(--color-status-critical)",
  border: "1px solid rgba(255, 51, 102, 0.3)",
  padding: "0.375rem 0.5rem",
  borderRadius: "0.25rem",
  fontSize: "0.6875rem",
  fontFamily: "var(--font-mono)",
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
};
