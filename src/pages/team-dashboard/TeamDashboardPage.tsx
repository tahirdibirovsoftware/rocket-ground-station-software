import { useTranslation } from "react-i18next";

/**
 * Team Dashboard — Technical diagnostics view for the engineering team.
 * Placeholder: will be populated with widgets in Phase 7.
 */
export function TeamDashboardPage() {
  const { t } = useTranslation();

  return (
    <div
      id="team-dashboard-page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--font-mono)",
        color: "var(--color-text-secondary)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            color: "var(--color-text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          {t("dashboard.team.title")}
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-status-nominal)" }}>
          {t("app.title")} v0.1.0
        </p>
      </div>
    </div>
  );
}
