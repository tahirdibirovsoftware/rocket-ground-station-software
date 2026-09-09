/**
 * DroneControl — Ground-station engine control for the drone (CC) system.
 *
 * Sends ARM ('1') / DISARM ('0') bytes over the RFD serial downlink.
 * The Teensy drone echoes its real armed state in telemetry, so the
 * panel reflects ground truth from the latest CC packet.
 */
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { invoke } from "@tauri-apps/api/core";
import { Power, ShieldOff, ShieldCheck, AlertTriangle, Radio } from "lucide-react";
import { IPC_COMMANDS } from "@shared/config/constants";
import { PanelContainer, StatusIndicator } from "@shared/ui";
import { useAppSelector } from "@app/store";
import { selectLatestDronePacket } from "@entities/drone-packet";
import { selectConnectionMode } from "@entities/connection";

const DroneControlLabels = (t: TFunction) => {
  const flightStateLabel = (code: number) => {
    switch (code) {
      case 0:
        return t("droneFlightState.standby", "STANDBY");
      case 1:
        return t("droneFlightState.launched", "LAUNCHED");
      case 2:
        return t("droneFlightState.descending", "DESCENDING");
      case 3:
      case 4:
        return t("droneFlightState.landed", "LANDED");
      default:
        return t("droneControl.unknownState", { code });
    }
  };
  const armedLabel = (a: boolean) => (a ? t("droneControl.ackArmed") : t("droneControl.ackDisarmed"));
  return { flightStateLabel, armedLabel };
};

export const DroneControl = React.memo(function DroneControl() {
  const { t } = useTranslation();
  const labels = DroneControlLabels(t);
  const latest = useAppSelector(selectLatestDronePacket);
  const connectionMode = useAppSelector(selectConnectionMode);
  const uplinkAcks = useAppSelector((state) => state.connection.uplinkAcks);
  const lastUplinkAck = useAppSelector((state) => state.connection.lastUplinkAck);

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isConnected = connectionMode !== "disconnected";
  const armed = latest?.armed ?? false;
  const stateCode = latest?.stateCode ?? 0;
  const throttleUs = latest?.throttleUs ?? 0;
  const esc2Us = latest?.esc2Us ?? throttleUs;

  // Command ACK from the flight controller: received "1"/"0" echoes over RF.
  const hasAck = uplinkAcks > 0;

  const sendCommand = useCallback(
    async (enable: boolean) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await invoke<string>(IPC_COMMANDS.SET_DRONE_ENGINE, {
          enabled: enable,
        });
        setNotice(result);
        setTimeout(() => setNotice(null), 4000);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleArm = useCallback(() => {
    sendCommand(true);
  }, [sendCommand]);

  const handleDisarm = useCallback(() => {
    sendCommand(false);
  }, [sendCommand]);

  return (
    <PanelContainer
      id="drone-control"
      title={t("droneControl.title", "Drone Engine Control")}
      icon={<Power size={14} />}
      dense
      headerRight={
        <StatusIndicator
          variant={!isConnected ? "muted" : armed ? "critical" : "nominal"}
          size={8}
          label={armed ? t("droneControl.stateArmed") : t("droneControl.stateDisabled")}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {/* Live drone state readout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0.5rem",
          }}
        >
          <div style={readoutStyle}>
            <div style={readoutLabelStyle}>{t("droneControl.state", "Flight State")}</div>
            <div
              style={{
                ...readoutValueStyle,
                color:
                  stateCode === 2
                    ? "var(--color-status-nominal)"
                    : stateCode === 1
                      ? "var(--color-status-warning)"
                      : stateCode === 3 || stateCode === 4
                        ? "var(--color-status-info)"
                        : "var(--color-text-muted)",
              }}
            >
              {labels.flightStateLabel(stateCode)}
            </div>
          </div>
          <div style={readoutStyle}>
            <div style={readoutLabelStyle}>{t("droneControl.armed", "Armed")}</div>
            <div
              style={{
                ...readoutValueStyle,
                color: armed ? "var(--color-status-critical)" : "var(--color-status-nominal)",
              }}
            >
              {armed ? t("droneControl.yes") : t("droneControl.no")}
            </div>
          </div>
          <div style={readoutStyle}>
            <div style={readoutLabelStyle}>{t("droneTelemetry.dualEscMotors", "Motors (M1 / M2)")}</div>
            <div
              style={{
                ...readoutValueStyle,
                color: latest?.outputsActive
                  ? "var(--color-status-nominal)"
                  : "var(--color-text-secondary)",
                fontSize: "0.6875rem",
                letterSpacing: "-0.01em",
              }}
            >
              {latest
                ? `M1: ${throttleUs || (latest.outputsActive ? 1480 : 1000)} | M2: ${esc2Us || (latest.outputsActive ? 1480 : 1000)} µs`
                : "---"}
            </div>
          </div>
        </div>

        {/* 4-Stage Drone Flight State Progression */}
        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            padding: "0.3125rem",
            backgroundColor: "var(--color-bg-tertiary)",
            borderRadius: "0.25rem",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {[
            { code: 0, label: t("droneFlightState.standby", "STANDBY") },
            { code: 1, label: t("droneFlightState.launched", "LAUNCHED") },
            { code: 2, label: t("droneFlightState.descending", "DESCENDING") },
            { code: 3, label: t("droneFlightState.landed", "LANDED") },
          ].map((step) => {
            const isCurrent = stateCode === step.code || (step.code === 3 && stateCode === 4);
            const isPast = stateCode > step.code && !(step.code === 3 && stateCode === 4);
            return (
              <div
                key={step.code}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "0.25rem 0.125rem",
                  borderRadius: "0.1875rem",
                  fontSize: "0.5625rem",
                  fontFamily: "var(--font-mono)",
                  fontWeight: isCurrent ? 700 : 500,
                  letterSpacing: "0.03em",
                  color: isCurrent
                    ? step.code === 2
                      ? "var(--color-status-nominal)"
                      : step.code === 1
                        ? "var(--color-status-warning)"
                        : step.code === 3
                          ? "var(--color-status-info)"
                          : "var(--color-text-primary)"
                    : isPast
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-muted)",
                  backgroundColor: isCurrent
                    ? step.code === 2
                      ? "rgba(0, 255, 136, 0.18)"
                      : step.code === 1
                        ? "rgba(255, 170, 0, 0.18)"
                        : step.code === 3
                          ? "rgba(0, 200, 255, 0.18)"
                          : "rgba(255, 255, 255, 0.1)"
                    : isPast
                      ? "rgba(255, 255, 255, 0.04)"
                      : "transparent",
                  border: isCurrent
                    ? `1px solid ${
                        step.code === 2
                          ? "rgba(0, 255, 136, 0.5)"
                          : step.code === 1
                            ? "rgba(255, 170, 0, 0.5)"
                            : step.code === 3
                              ? "rgba(0, 200, 255, 0.5)"
                              : "rgba(255, 255, 255, 0.3)"
                      }`
                    : "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                {step.label}
              </div>
            );
          })}
        </div>

        {/* Error / notice banners */}
        {error && (
          <div style={bannerErrorStyle}>
            <AlertTriangle size={12} /> {error}
          </div>
        )}
        {notice && (
          <div style={bannerNoticeStyle}>
            <Radio size={12} /> {notice}
          </div>
        )}

        {/* Uplink command ACK status */}
        <div
          style={{
            ...bannerNoticeStyle,
            backgroundColor: connectionMode === "mock"
              ? "rgba(51, 153, 255, 0.08)"
              : hasAck
                ? lastUplinkAck
                  ? "rgba(255, 51, 102, 0.1)"
                  : "rgba(0, 255, 136, 0.08)"
                : "rgba(255, 255, 255, 0.03)",
            borderColor: connectionMode === "mock"
              ? "rgba(51, 153, 255, 0.25)"
              : hasAck
                ? lastUplinkAck
                  ? "rgba(255, 51, 102, 0.3)"
                  : "rgba(0, 255, 136, 0.25)"
                : "var(--color-border-default)",
            color: connectionMode === "mock"
              ? "var(--color-status-info)"
              : hasAck
                ? lastUplinkAck
                  ? "var(--color-status-critical)"
                  : "var(--color-status-nominal)"
                : "var(--color-text-muted)",
          }}
        >
          <Radio size={12} />
          {connectionMode === "mock"
            ? t("droneControl.ackMock", "SIMULATED ACK: commands applied to mock drone")
            : hasAck
              ? t("droneControl.echoLabel", {
                  state: labels.armedLabel(!!lastUplinkAck),
                  count: uplinkAcks,
                })
              : t("droneControl.ackWaiting", "UPLINK ECHO: WAITING (drone ACK '1'/'0' or payload sky/landed status)")}
        </div>

        {/* ARM / DISARM buttons */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            style={{
              ...actionButtonStyle,
              flex: 1,
              backgroundColor: "rgba(0, 255, 136, 0.12)",
              color: "var(--color-status-nominal)",
              borderColor: "rgba(0, 255, 136, 0.4)",
              opacity: !isConnected || busy || armed ? 0.5 : 1,
            }}
            onClick={handleArm}
            disabled={!isConnected || busy || armed}
          >
            <ShieldCheck size={14} /> {t("droneControl.armEngine", "ARM ENGINE")}
          </button>
          <button
            style={{
              ...actionButtonStyle,
              flex: 1,
              backgroundColor: "rgba(255, 51, 102, 0.12)",
              color: "var(--color-status-critical)",
              borderColor: "rgba(255, 51, 102, 0.4)",
              opacity: !isConnected || busy || !armed ? 0.5 : 1,
            }}
            onClick={handleDisarm}
            disabled={!isConnected || busy || !armed}
          >
            <ShieldOff size={14} /> {t("droneControl.disarmEngine", "DISARM ENGINE")}
          </button>
        </div>

        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          <Radio size={10} style={{ color: isConnected ? "var(--color-status-info)" : "var(--color-text-muted)" }} />
          {!isConnected
            ? t("droneControl.linkOffline", "RFD link offline — connect RFD or start Mock to control the drone.")
            : connectionMode === "mock"
              ? t("droneControl.mockHint", "Mock mode — commands are applied to the simulated drone.")
              : t("droneControl.rfdHint", "Commands sent over RFD downlink ('1' = ARM, '0' = DISARM).")}
        </div>
      </div>
    </PanelContainer>
  );
});

const readoutStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-tertiary)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "0.25rem",
  padding: "0.375rem 0.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  minWidth: 0,
  overflow: "hidden",
};

const readoutLabelStyle: React.CSSProperties = {
  fontSize: "0.5625rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const readoutValueStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const actionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.6875rem",
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  border: "1px solid var(--color-border-default)",
  borderRadius: "0.25rem",
  cursor: "pointer",
  transition: "all 100ms ease",
};

const bannerErrorStyle: React.CSSProperties = {
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

const bannerNoticeStyle: React.CSSProperties = {
  backgroundColor: "rgba(0, 255, 136, 0.08)",
  color: "var(--color-status-nominal)",
  border: "1px solid rgba(0, 255, 136, 0.25)",
  padding: "0.375rem 0.5rem",
  borderRadius: "0.25rem",
  fontSize: "0.6875rem",
  fontFamily: "var(--font-mono)",
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
};
