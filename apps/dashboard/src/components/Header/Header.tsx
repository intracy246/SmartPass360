import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../../theme/ThemeProvider";
import { getStoredUser } from "../../auth/session";
import { getVisitorOperations } from "../../api/visitor-api";
import "./Header.css";

const READ_KEY = "smartpass360.notifications.read";
function readIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const user = getStoredUser();
  const readKey = user?.guardSessionId ? `${READ_KEY}.${user.guardSessionId}` : READ_KEY;
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => readIds(readKey));
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const operations = useQuery({ queryKey: ["visitor-operations"], queryFn: getVisitorOperations, refetchInterval: 5000 });
  const pending = operations.data?.data.pending ?? [];
  const unreadCount = useMemo(() => pending.filter((visit) => !readNotificationIds.includes(visit.id)).length, [pending, readNotificationIds]);
  const initials = (user?.guardName ?? "SP").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "SP";

  useEffect(() => {
    const interval = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // A new guard session gets its own read-state; load it when the active identity changes.
  useEffect(() => setReadNotificationIds(readIds(readKey)), [readKey]);

  function persistRead(ids: string[]) {
    const next = [...new Set(ids)].slice(-500);
    setReadNotificationIds(next);
    window.localStorage.setItem(readKey, JSON.stringify(next));
  }

  function markRead(id: string) {
    persistRead([...readNotificationIds, id]);
    setNotificationsOpen(false);
    navigate("/operations");
  }

  function markAllRead() {
    persistRead([...readNotificationIds, ...pending.map((visit) => visit.id)]);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.dispatchEvent(new CustomEvent("smartpass360:visitor-alert-settings", { detail: { enabled: next } }));
    if (next && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <div className="search-box">
          <button className="search-box__trigger" type="button" onClick={() => navigate("/search")} aria-label="Open Intelligent Search">
            <span className="search-box__icon">⌕</span><span>Search people, phones, companies, departments, passes…</span>
          </button>
        </div>
      </div>
      <div className="header-right">
        <div className="header-info"><span className="label">Organization</span><strong>—</strong></div>
        <div className="header-info"><span className="label">Today</span><strong>{time.toLocaleDateString()}</strong></div>
        <div className="header-info"><span className="label">Time</span><strong>{time.toLocaleTimeString()}</strong></div>
        <div className="online-dot" />
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "light"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <span className="theme-toggle__icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <div className="header-notifications">
          <button className="notification-button" type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Open notifications" aria-expanded={notificationsOpen}>
            🔔{unreadCount > 0 && <span className="notification-button__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
          {notificationsOpen && <section className="notification-popover" aria-label="Notifications">
            <div className="notification-popover__header"><div><strong>Notifications</strong><span>{unreadCount} unread · {pending.length} require action</span></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</button></div>
            <div className="notification-popover__filters"><span>Visitor approvals</span><button type="button" onClick={markAllRead} disabled={pending.length === 0}>Mark all read</button></div>
            {operations.isPending && <p className="notification-popover__empty">Loading notifications…</p>}
            {operations.isError && <p className="notification-popover__empty">Notifications could not be loaded. Retry from Live Operations.</p>}
            {!operations.isPending && !operations.isError && pending.length === 0 && <p className="notification-popover__empty">You are all caught up. No visitor approvals are waiting.</p>}
            <div className="notification-popover__list">{pending.map((visit) => {
              const unread = !readNotificationIds.includes(visit.id);
              return <button className={unread ? "notification-item unread" : "notification-item"} type="button" key={visit.id} onClick={() => markRead(visit.id)}>
                <span className="notification-item__dot"/><span className="notification-item__content"><strong>{visit.fullName}</strong><small>{visit.organization?.name ?? "Organization not specified"} · {visit.purpose || "Visitor registration"}</small><em>Waiting for Security approval</em></span><span className="notification-item__arrow">›</span>
              </button>;
            })}</div>
            <div className="notification-popover__footer"><button type="button" onClick={toggleSound}>{soundEnabled ? "Disable sound alerts" : "Enable sound alerts"}</button><button type="button" onClick={() => { setNotificationsOpen(false); navigate("/operations"); }}>Open Live Operations</button></div>
          </section>}
        </div>
        <button className="profile profile-button" type="button" onClick={() => navigate("/users")} title={user?.guardName ? `Signed in as ${user.guardName}` : "Guard profile"}>
          <span className="avatar">{initials}</span><span className="profile-name">{user?.guardName ?? "Profile"}</span>
        </button>
      </div>
    </header>
  );
}
