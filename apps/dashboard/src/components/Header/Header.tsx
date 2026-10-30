import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";

export function Header() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  async function toggleNotifications() {
    const next = !notificationsEnabled;
    // Dispatch first, synchronously within the button click, so the notification
    // component can unlock Web Audio before the browser's autoplay gate closes.
    window.dispatchEvent(new CustomEvent("smartpass360:visitor-alert-settings", { detail: { enabled: next } }));
    setNotificationsEnabled(next);
    if (next && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // In-page alert and sound remain available if browser notifications are denied.
      }
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header">

      <div className="header-left">

        <div className="search-box">
          <button className="search-box__trigger" type="button" onClick={() => navigate("/search")} aria-label="Open Intelligent Search"><span className="search-box__icon">⌕</span><span>Search people, phones, companies, departments, passes…</span></button>
        </div>

      </div>

      <div className="header-right">

        <div className="header-info">

          <span className="label">
            Organization
          </span>

          <strong>
            —
          </strong>

        </div>

        <div className="header-info">

          <span className="label">
            Today
          </span>

          <strong>
            {time.toLocaleDateString()}
          </strong>

        </div>

        <div className="header-info">

          <span className="label">
            Time
          </span>

          <strong>
            {time.toLocaleTimeString()}
          </strong>

        </div>

        <div className="online-dot"/>

        <button
          className={notificationsEnabled ? "notification-button notification-button--enabled" : "notification-button"}
          type="button"
          onClick={() => void toggleNotifications()}
          aria-label={notificationsEnabled ? "Disable visitor sound notifications" : "Enable visitor sound notifications"}
          aria-pressed={notificationsEnabled}
          title={notificationsEnabled ? "Visitor sound notifications enabled" : "Enable visitor sound notifications"}
        >
          🔔
        </button>

        <div className="profile">

          <div className="avatar">
            SP
          </div>

        </div>

      </div>

    </header>
  );
}