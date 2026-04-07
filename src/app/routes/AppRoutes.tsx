import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@shared/config/constants";
import { TeamDashboardPage } from "@pages/team-dashboard/TeamDashboardPage";
import { RefereeDashboardPage } from "@pages/referee-dashboard/RefereeDashboardPage";

/**
 * Application route definitions.
 * Two primary dashboard views: Team (technical) and Referee (competition).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTES.ROOT}
        element={<Navigate to={ROUTES.TEAM_DASHBOARD} replace />}
      />
      <Route
        path={ROUTES.TEAM_DASHBOARD}
        element={<TeamDashboardPage />}
      />
      <Route
        path={ROUTES.REFEREE_DASHBOARD}
        element={<RefereeDashboardPage />}
      />
    </Routes>
  );
}
