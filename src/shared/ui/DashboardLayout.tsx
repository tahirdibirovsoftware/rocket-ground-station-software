/**
 * DashboardLayout — App shell layout with sidebar navigation and top status bar.
 *
 * Provides the persistent chrome around page content:
 * - Top bar: app title, connection status, clock
 * - Sidebar: navigation links (Team, Referee)
 * - Main area: page content (Outlet slot)
 */
import React, { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Radio,
  Gauge,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ROUTES } from "@shared/config/constants";
import { StatusIndicator, type StatusVariant } from "./StatusIndicator";
import { useAppSelector } from "@app/store";
import { selectConnectionMode } from "@entities/connection";
import { TelemetryBridge } from "@features/telemetry-bridge";

export const DashboardLayout = React.memo(function DashboardLayout() {
  const connectionMode = useAppSelector(selectConnectionMode);
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const statusVariant: StatusVariant =
    connectionMode === "disconnected"
      ? "muted"
      : connectionMode === "mock"
        ? "info"
        : "nominal";

  const statusLabel =
    connectionMode === "disconnected"
      ? t("connection.disconnected")
      : connectionMode === "mock"
        ? t("connection.mockMode")
        : t("connection.connected");

  const navItems = [
    {
      to: ROUTES.TEAM_DASHBOARD,
      label: t("nav.teamDashboard"),
      icon: <Activity size={18} />,
    },
    {
      to: ROUTES.REFEREE_DASHBOARD,
      label: t("nav.refereeDashboard"),
      icon: <Gauge size={18} />,
    },
  ];

  return (
    <div
      id="dashboard-layout"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── Top Status Bar ── */}
      <header
        id="top-status-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 40,
          padding: "0 1rem",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-default)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Radio size={16} style={{ color: "var(--color-status-nominal)" }} />
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "0.04em",
            }}
          >
            {t("app.title")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <StatusIndicator variant={statusVariant} label={statusLabel} size={8} />
          <span
            className="font-telemetry"
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
            }}
          >
            {clock.toLocaleTimeString("en-GB", { hour12: false })}
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ── Sidebar Navigation ── */}
        <nav
          id="sidebar-nav"
          style={{
            width: collapsed ? 48 : 180,
            backgroundColor: "var(--color-bg-secondary)",
            borderRight: "1px solid var(--color-border-default)",
            display: "flex",
            flexDirection: "column",
            transition: "width 150ms ease",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, paddingTop: "0.5rem" }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: collapsed ? "0.625rem 0.9rem" : "0.625rem 1rem",
                  margin: "0.125rem 0.375rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  color: isActive
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  backgroundColor: isActive
                    ? "var(--color-bg-tertiary)"
                    : "transparent",
                  borderLeft: isActive
                    ? "2px solid var(--color-status-nominal)"
                    : "2px solid transparent",
                  transition: "all 100ms ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                })}
              >
                <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.5rem",
              margin: "0.375rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </nav>

        {/* ── Main Content ── */}
        <main
          id="main-content"
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0.75rem",
            minHeight: 0,
          }}
        >
          <TelemetryBridge />
          <Outlet />
        </main>
      </div>
    </div>
  );
});
