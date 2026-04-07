import { useTranslation } from "react-i18next";

/**
 * Referee Dashboard — Clean competition display for judges.
 * Placeholder: will be populated with widgets in Phase 8.
 */
export function RefereeDashboardPage() {
  const { t } = useTranslation();

  return (
    <div
      id="referee-dashboard-page"
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
          {t("dashboard.referee.title")}
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-status-info)" }}>
          {t("app.title")} v0.1.0
        </p>
      </div>
    </div>
  );
}
