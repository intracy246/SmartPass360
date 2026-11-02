import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { Header } from "../components/Header/Header";
import { VisitorNotifications } from "../components/VisitorNotifications/VisitorNotifications";
import { getStoredUser } from "../auth/session";
import { heartbeatGuardSession } from "../api/auth-api";
import "./DashboardLayout.css";

export function DashboardLayout() {
  useEffect(() => {
    const user = getStoredUser();
    if (user?.scope !== "BUILDING" || !user.guardSessionId) return;
    const sendHeartbeat = () => { void heartbeatGuardSession().catch((error) => console.warn("Guard presence heartbeat failed.", error)); };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <VisitorNotifications />
      <main className="dashboard-layout__content">
        <Header />
        <Outlet />
      </main>
    </div>
  );
}
