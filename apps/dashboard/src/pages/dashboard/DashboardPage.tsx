import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiHealth } from "../../api/health-api";
import { getOperationsSummary } from "../../api/access-api";
import {
  approveVehicleRequest,
  denyVehicleRequest,
  getVehicleRequests
} from "../../api/vehicle-access-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";
import "./DashboardPage.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const operationsQuery = useQuery({
    queryKey: ["operations-summary"],
    queryFn: getOperationsSummary,
    refetchInterval: 5_000
  });

  const operations = operationsQuery.data?.data;

  const vehicleRequestsQuery = useQuery({
    queryKey: ["vehicle-access-requests"],
    queryFn: getVehicleRequests,
    refetchInterval: 5_000
  });

  const approveVehicle = useMutation({
    mutationFn: approveVehicleRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicle-access-requests"] })
  });

  const denyVehicle = useMutation({
    mutationFn: denyVehicleRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicle-access-requests"] })
  });

  const pendingVehicles = vehicleRequestsQuery.data?.data ?? [];

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

          <strong className="stat-card__value">{operationsQuery.isPending ? "—" : operations?.visitorsInside ?? 0}</strong>

          <span className="stat-card__note">
            {operationsQuery.isError ? "Live count unavailable" : "Currently checked in"}
          </span>
        </GlassCard>

        <GlassCard accent="violet">
          <span className="stat-card__label">
            Active passes
          </span>

          <strong className="stat-card__value">{operationsQuery.isPending ? "—" : operations?.activePasses ?? 0}</strong>

          <span className="stat-card__note">
            Visitor + permanent credentials valid now
          </span>
        </GlassCard>

        <GlassCard accent="cyan">
          <span className="stat-card__label">
            Access events today
          </span>

          <strong className="stat-card__value">{operationsQuery.isPending ? "—" : operations?.accessEventsToday ?? 0}</strong>

          <span className="stat-card__note">
            Pedestrian + permanent + vehicle events
          </span>
        </GlassCard>

        <GlassCard accent="green">
          <span className="stat-card__label">
            Gates online
          </span>

          <strong className="stat-card__value">{operationsQuery.isPending ? "—" : operations?.gatesOnline ?? 0}</strong>

          <span className="stat-card__note">
            Active gates reporting ONLINE
          </span>
        </GlassCard>
      </section>


      <section className="dashboard-page__vehicle-approvals">
        <GlassCard
          title="Vehicle approvals"
          subtitle="Unknown or low-confidence vehicles waiting for Security approval."
          accent="cyan"
        >
          <div className="vehicle-approval__heading">
            <div>
              <strong>{pendingVehicles.length}</strong>
              <span> waiting for approval</span>
            </div>
            <GlassButton type="button" variant="secondary" onClick={() => navigate("/vehicles")}>
              View all vehicles
            </GlassButton>
          </div>

          {vehicleRequestsQuery.isPending ? (
            <p className="vehicle-approval__message">Loading vehicle arrivals...</p>
          ) : vehicleRequestsQuery.isError ? (
            <p className="vehicle-approval__message vehicle-approval__message--error">
              Vehicle approval queue is unavailable.
            </p>
          ) : pendingVehicles.length === 0 ? (
            <p className="vehicle-approval__message">No vehicles are waiting for Security approval.</p>
          ) : (
            <div className="vehicle-approval__list">
              {pendingVehicles.slice(0, 5).map((item) => (
                <article className="vehicle-approval__item" key={item.id}>
                  <div className="vehicle-approval__plate">
                    <strong>{item.plateNumber}</strong>
                    <span>{item.direction} · {item.gate?.name ?? "Gate"}</span>
                  </div>
                  <div className="vehicle-approval__meta">
                    <span>{new Date(item.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>{item.confidence == null ? item.reason : `ANPR ${Math.round(item.confidence * 100)}%`}</span>
                  </div>
                  <div className="vehicle-approval__actions">
                    <GlassButton
                      type="button"
                      variant="secondary"
                      disabled={denyVehicle.isPending || approveVehicle.isPending}
                      onClick={() => denyVehicle.mutate(item.id)}
                    >
                      Deny
                    </GlassButton>
                    <GlassButton
                      type="button"
                      disabled={approveVehicle.isPending || denyVehicle.isPending}
                      onClick={() => approveVehicle.mutate(item.id)}
                    >
                      Approve & Open
                    </GlassButton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      <section className="dashboard-page__grid">
        <GlassCard
          title="Live access activity"
          subtitle="Latest real pedestrian access decisions in this building."
          accent="violet"
        >
          {operationsQuery.isPending ? (
            <p className="operations-activity__message">Loading live activity...</p>
          ) : operationsQuery.isError ? (
            <p className="operations-activity__message operations-activity__message--error">Live operations are unavailable.</p>
          ) : !operations?.recentActivity.length ? (
            <div className="empty-state">
              <div className="empty-state__icon">⌁</div>
              <strong>No access activity yet</strong>
              <p>Real access events will appear here after a credential is scanned.</p>
            </div>
          ) : (
            <div className="operations-activity__list">
              {operations.recentActivity.map((event) => (
                <article className="operations-activity__item" key={`${event.kind}-${event.id}`}>
                  <div>
                    <strong>{event.name}</strong>
                    <span>{event.passNumber ?? event.kind.replace("_", " ")}</span>
                  </div>
                  <div>
                    <strong>{event.direction} · {event.decision}</strong>
                    <span>{event.gateName ?? "Access point"} · {new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
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
