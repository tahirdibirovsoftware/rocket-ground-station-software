import { useTranslation } from "react-i18next";
import { PanelContainer } from "@shared/ui";

/**
 * Team Dashboard — Technical diagnostics view for the engineering team.
 * Placeholder: will be populated with widgets in Phase 7.
 */
export function TeamDashboardPage() {
  const { t } = useTranslation();

  return (
    <div id="team-dashboard-page">
      <PanelContainer title={t("dashboard.team.title")}>
        <p
          className="font-telemetry"
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.8125rem",
          }}
        >
          {t("app.title")} v0.1.0 — {t("dashboard.team.diagnostics")}
        </p>
      </PanelContainer>
    </div>
  );
}

