import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getApiHealth } from "../../api/health-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";
import "./DashboardPage.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const healthQuery = useQuery({
    queryKey: ["api-health"],
    queryFn: getApiHealth,
    refetchInterval: 30_000
  });

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p className="dashboard-page__eyebrow">
            Visitor Access Intelligence
          </p>

          <h1>Operations Overview</h1>

          <p className="dashboard-page__description">
            Monitor visitor movement, QR passes and access
            control activity from one operational surface.
          </p>
        </div>

        <div className="dashboard-page__actions">
          <GlassButton variant="secondary">
            Export Report
          </GlassButton>

          <GlassButton
            type="button"
            onClick={() => navigate("/visitors?mode=register#register-visitor")}
          >
            Register Visitor
          </GlassButton>
        </div>
      </header>

      <section className="dashboard-page__stats">
        <GlassCard accent="blue">
          <span className="stat-card__label">
            Visitors inside
          </span>

          <strong className="stat-card__value">0</strong>

          <span className="stat-card__note">
            Awaiting live visitor endpoint
          </span>
        </GlassCard>

        <GlassCard accent="violet">
          <span className="stat-card__label">
            Active passes
          </span>

          <strong className="stat-card__value">0</strong>

          <span className="stat-card__note">
            No pass records loaded
          </span>
        </GlassCard>

        <GlassCard accent="cyan">
          <span className="stat-card__label">
            Access events today
          </span>

          <strong className="stat-card__value">0</strong>

          <span className="stat-card__note">
            Waiting for access API
          </span>
        </GlassCard>

        <GlassCard accent="green">
          <span className="stat-card__label">
            Gates online
          </span>

          <strong className="stat-card__value">0</strong>

          <span className="stat-card__note">
            Gate service not connected
          </span>
        </GlassCard>
      </section>

      <section className="dashboard-page__grid">
        <GlassCard
          title="Live visitor activity"
          subtitle="Visitor movement will appear here when the visit API is connected."
          accent="violet"
        >
          <div className="empty-state">
            <div className="empty-state__icon">⌁</div>
            <strong>No live visitor records</strong>
            <p>
              This area does not use sample data. Records will
              appear only after the API returns real visits.
            </p>
          </div>
        </GlassCard>

        <GlassCard
          title="System status"
          subtitle="Current backend connectivity."
          accent="green"
        >
          <div className="system-status">
            <div
              className={[
                "system-status__indicator",
                healthQuery.isSuccess
                  ? "system-status__indicator--online"
                  : "system-status__indicator--offline"
              ].join(" ")}
            />

            <div>
              <span>SMARTPASS360 API</span>

              <strong>
                {healthQuery.isPending && "Checking..."}

                {healthQuery.isSuccess &&
                  healthQuery.data.status}

                {healthQuery.isError && "OFFLINE"}
              </strong>
            </div>
          </div>

          {healthQuery.isSuccess && (
            <div className="system-status__details">
              <div>
                <span>Version</span>
                <strong>{healthQuery.data.version}</strong>
              </div>

              <div>
                <span>Environment</span>
                <strong>
                  {healthQuery.data.environment}
                </strong>
              </div>
            </div>
          )}
        </GlassCard>
      </section>
    </div>
  );
}
