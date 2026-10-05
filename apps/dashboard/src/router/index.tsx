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

export function AppRouter() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
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