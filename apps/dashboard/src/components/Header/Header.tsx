import { useEffect, useState } from "react";
import "./Header.css";

export function Header() {
  const [time, setTime] = useState(new Date());

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
          <input
            placeholder="Search visitors, passes, organizations..."
          />
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

        <button className="notification-button">
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