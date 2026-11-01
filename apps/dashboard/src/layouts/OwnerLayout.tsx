import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";
import "./OwnerLayout.css";
import { useTheme } from "../theme/ThemeProvider";

const items = [
  { to: "/owner", label: "Overview", end: true },
  { to: "/owner/buildings", label: "Buildings" },
  { to: "/owner/organizations", label: "Organizations" }
];

export function OwnerLayout() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="owner-shell">
      <aside className="owner-sidebar">
        <div className="owner-sidebar__brand">
          <div className="owner-sidebar__logo"><img src="/branding/smartpass360-logo.png" alt="SmartPass360" /></div>
          <div><strong>SmartPass360</strong><span>SmartCycle Owner</span></div>
        </div>
        <div className="owner-sidebar__powered-by"><span>Powered by</span><img src="/branding/smartcycle360-logo.png" alt="SmartCycle360 Technologies Limited" /></div>
        <nav className="owner-sidebar__nav">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? "owner-sidebar__link active" : "owner-sidebar__link"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="owner-sidebar__mobile-signout" type="button" onClick={() => { clearSession(); navigate("/login", { replace: true }); }}>Sign out</button>
        <div className="owner-sidebar__footer">
          <span>Platform administration</span>
          <button type="button" onClick={() => { clearSession(); navigate("/login", { replace: true }); }}>Sign out</button>
        </div>
      </aside>
      <section className="owner-shell__content"><button className="theme-toggle owner-theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "light"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}><span className="theme-toggle__icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span></button><Outlet /></section>
    </div>
  );
}
