import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";
import "./OwnerLayout.css";

const items = [
  { to: "/owner", label: "Overview", end: true },
  { to: "/owner/buildings", label: "Buildings" },
  { to: "/owner/organizations", label: "Organizations" }
];

export function OwnerLayout() {
  const navigate = useNavigate();
  return (
    <div className="owner-shell">
      <aside className="owner-sidebar">
        <div className="owner-sidebar__brand">
          <div className="owner-sidebar__logo">SP</div>
          <div><strong>SmartPass360</strong><span>SmartCycle Owner</span></div>
        </div>
        <nav className="owner-sidebar__nav">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? "owner-sidebar__link active" : "owner-sidebar__link"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="owner-sidebar__footer">
          <span>Platform administration</span>
          <button type="button" onClick={() => { clearSession(); navigate("/login", { replace: true }); }}>Sign out</button>
        </div>
      </aside>
      <section className="owner-shell__content"><Outlet /></section>
    </div>
  );
}
