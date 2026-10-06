import { NavLink, useNavigate } from "react-router-dom";
import { clearSession } from "../../auth/session";

import "./Sidebar.css";

const navigationItems = [
  {
    label: "Overview",
    path: "/",
    symbol: "◈"
  },
  {
    label: "Live Operations",
    path: "/operations",
    symbol: "◌"
  },
  {
    label: "Visitors",
    path: "/visitors",
    symbol: "◎"
  },
  {
    label: "Passes",
    path: "/passes",
    symbol: "◇"
  },
  {
    label: "Access Control",
    path: "/access",
    symbol: "⌁"
  },
  {
    label: "Gate Setup",
    path: "/gate-setup",
    symbol: "⊞"
  },
  {
    label: "Organizations",
    path: "/organizations",
    symbol: "▦"
  },
  {
    label: "Kiosks",
    path: "/kiosks",
    symbol: "▣"
  },
  {
    label: "Vehicles",
    path: "/vehicles",
    symbol: "▤"
  },
  {
    label: "Users",
    path: "/users",
    symbol: "◉"
  },
  {
    label: "Reports",
    path: "/reports",
    symbol: "▥"
  },
  {
    label: "Settings",
    path: "/settings",
    symbol: "⚙"
  }
];

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">SP</div>

        <div>
          <strong>SMARTPASS360</strong>
          <span>Access Intelligence</span>
        </div>
      </div>

      <nav className="sidebar__navigation">
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              [
                "sidebar__link",
                isActive
                  ? "sidebar__link--active"
                  : ""
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <span className="sidebar__symbol">
              {item.symbol}
            </span>

            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__system-dot" />

        <div>
          <strong>System connected</strong>
          <span>SmartPass360 API</span>
        </div>

        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate("/login", { replace: true });
          }}
          style={{
            marginLeft: "auto",
            border: 0,
            background: "transparent",
            color: "#8fa0b8",
            cursor: "pointer"
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}