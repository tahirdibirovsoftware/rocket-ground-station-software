import { Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "@shared/config/constants";
import { DashboardLayout } from "@shared/ui";
import { TeamDashboardPage } from "@pages/team-dashboard/TeamDashboardPage";
import { RefereeDashboardPage } from "@pages/referee-dashboard/RefereeDashboardPage";

/**
 * Application route definitions.
 * Both dashboard views are nested inside the DashboardLayout shell
 * (sidebar + top bar + Outlet).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path={ROUTES.ROOT}
        element={<Navigate to={ROUTES.TEAM_DASHBOARD} replace />}
      />
      <Route element={<DashboardLayout />}>
        <Route
          path={ROUTES.TEAM_DASHBOARD}
          element={<TeamDashboardPage />}
        />
        <Route
          path={ROUTES.REFEREE_DASHBOARD}
          element={<RefereeDashboardPage />}
        />
      </Route>
    </Routes>
  );
}
