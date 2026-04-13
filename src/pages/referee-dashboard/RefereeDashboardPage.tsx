import { useTranslation } from "react-i18next";
import { PanelContainer } from "@shared/ui";

/**
 * Referee Dashboard — Clean competition display for judges.
 * Placeholder: will be populated with widgets in Phase 8.
 */
export function RefereeDashboardPage() {
  const { t } = useTranslation();

  return (
    <div id="referee-dashboard-page">
      <PanelContainer title={t("dashboard.referee.title")}>
        <p
          className="font-telemetry"
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.8125rem",
          }}
        >
          {t("app.title")} v0.1.0 — {t("dashboard.referee.scientificData")}
        </p>
      </PanelContainer>
    </div>
  );
}

