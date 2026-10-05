import type { ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import { DashboardLayout } from "../layouts/DashboardLayout";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { VisitorsPage } from "../pages/visitors/VisitorsPage";
import { PassesPage } from "../pages/passes/PassesPage";
import { AccessControlPage } from "../pages/access/AccessControlPage";
import { OrganizationsPage } from "../pages/organizations/OrganizationsPage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage";
import { OwnerDashboardPage } from "../pages/owner/OwnerDashboardPage";
import { getStoredUser, getToken } from "../auth/session";
import { KiosksPage } from "../pages/kiosks/KiosksPage";

function EmptyModule({
  title
}: {
  title: string;
}) {
  return (
    <div
      style={{
        padding: "32px",
        color: "#F8F8FF"
      }}
    >
      <h1>{title}</h1>
      <p style={{ color: "#8FA0B8" }}>
        This module will display real data from the
        SMARTPASS360 API. No mock data is being used.
      </p>
    </div>
  );
}

function RequireBuilding({ children }: { children: ReactNode }) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.scope === "OWNER") return <Navigate to="/owner" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function RequireOwner({ children }: { children: ReactNode }) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.scope !== "OWNER") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/owner" element={<RequireOwner><OwnerDashboardPage /></RequireOwner>} />
      <Route element={<RequireBuilding><DashboardLayout /></RequireBuilding>}>
        <Route index element={<DashboardPage />} />

        <Route
  path="visitors"
  element={<VisitorsPage />}
/>

       <Route
  path="passes"
  element={<PassesPage />}
/>

        <Route
  path="access"
  element={<AccessControlPage />}
/>

      <Route
  path="organizations"
  element={<OrganizationsPage />}
/>

        <Route path="kiosks" element={<KiosksPage />} />

        <Route
          path="users"
          element={<EmptyModule title="Users" />}
        />

        <Route
          path="reports"
          element={<EmptyModule title="Reports" />}
        />

        <Route
          path="settings"
          element={<SettingsPage />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}