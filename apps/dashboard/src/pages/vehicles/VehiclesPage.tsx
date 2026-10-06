import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveVehicleRequest,
  denyVehicleRequest,
  getVehicleEvents,
  getVehicleRequests,
  getVehicles
} from "../../api/vehicle-access-api";

import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";

import "./VehiclesPage.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function VehiclesPage() {
  const queryClient = useQueryClient();

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    refetchInterval: 5000
  });

  const requestsQuery = useQuery({
    queryKey: ["vehicle-access-requests"],
    queryFn: getVehicleRequests,
    refetchInterval: 3000
  });

  const eventsQuery = useQuery({
    queryKey: ["vehicle-access-events"],
    queryFn: () => getVehicleEvents(1, 50),
    refetchInterval: 5000
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      requestId,
      decision
    }: {
      requestId: string;
      decision: "APPROVE" | "DENY";
    }) => {
      return decision === "APPROVE"
        ? approveVehicleRequest(requestId)
        : denyVehicleRequest(requestId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vehicle-access-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicle-access-events"] })
      ]);
    }
  });

  const vehicles = vehiclesQuery.data?.data ?? [];
  const requests = requestsQuery.data?.data ?? [];
  const events = eventsQuery.data?.data ?? [];

  return (
    <div className="vehicles-page">
      <header className="vehicles-page__header">
        <div>
          <p className="vehicles-page__eyebrow">Vehicle Access</p>
          <h1>Vehicles</h1>
          <p>
            Registered Permanent Pass vehicles can be recognized by ANPR and
            authorized automatically. Unknown vehicles remain locked until
            Security approves them.
          </p>
        </div>
      </header>

      <div className="vehicles-page__metrics">
        <GlassCard title="Registered vehicles" subtitle="Building-scoped vehicle registry" accent="blue">
          <strong className="vehicles-page__metric">{vehicles.length}</strong>
        </GlassCard>
        <GlassCard title="Waiting approval" subtitle="Unknown or low-confidence detections" accent="violet">
          <strong className="vehicles-page__metric">{requests.length}</strong>
        </GlassCard>
      </div>

      <GlassCard
        title="Security approval queue"
        subtitle="ANPR detections that require a human decision."
        accent="violet"
      >
        {requestsQuery.isPending ? (
          <div className="vehicles-page__state">Loading vehicle requests...</div>
        ) : requestsQuery.isError ? (
          <div className="vehicles-page__state vehicles-page__state--error">
            Vehicle approval queue is unavailable.
          </div>
        ) : requests.length === 0 ? (
          <div className="vehicles-page__state">
            No vehicles are waiting for Security approval.
          </div>
        ) : (
          <div className="vehicles-table-wrap">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Gate</th>
                  <th>Direction</th>
                  <th>Confidence</th>
                  <th>Detected</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.plateNumber}</strong></td>
                    <td>{item.gate?.name ?? "—"}</td>
                    <td>{item.direction}</td>
                    <td>
                      {item.confidence == null
                        ? "—"
                        : `${Math.round(item.confidence * 100)}%`}
                    </td>
                    <td>{formatDate(item.detectedAt)}</td>
                    <td>{item.reason.replaceAll("_", " ")}</td>
                    <td>
                      <div className="vehicles-page__actions">
                        <GlassButton
                          type="button"
                          disabled={reviewMutation.isPending}
                          onClick={() => {
                            reviewMutation.mutate({
                              requestId: item.id,
                              decision: "APPROVE"
                            });
                          }}
                        >
                          Approve & Open Gate
                        </GlassButton>
                        <GlassButton
                          type="button"
                          variant="secondary"
                          disabled={reviewMutation.isPending}
                          onClick={() => {
                            reviewMutation.mutate({
                              requestId: item.id,
                              decision: "DENY"
                            });
                          }}
                        >
                          Deny
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard
        title="Registered vehicles"
        subtitle="Vehicles explicitly linked to Permanent Pass holders."
        accent="blue"
      >
        {vehiclesQuery.isPending ? (
          <div className="vehicles-page__state">Loading registered vehicles...</div>
        ) : vehiclesQuery.isError ? (
          <div className="vehicles-page__state vehicles-page__state--error">
            Vehicle registry is unavailable.
          </div>
        ) : vehicles.length === 0 ? (
          <div className="vehicles-page__state">
            No Permanent Pass vehicles are registered yet.
          </div>
        ) : (
          <div className="vehicles-table-wrap">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Holder</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Vehicle state</th>
                  <th>Last entry</th>
                  <th>Last exit</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle: any) => (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.plateNumber}</strong></td>
                    <td>{vehicle.holder?.fullName ?? "—"}</td>
                    <td>{vehicle.organization?.name ?? "—"}</td>
                    <td>{vehicle.isActive ? "ACTIVE" : "INACTIVE"}</td>
                    <td>{vehicle.isCurrentlyInside ? "INSIDE" : "OUTSIDE"}</td>
                    <td>{formatDate(vehicle.lastEntryAt)}</td>
                    <td>{formatDate(vehicle.lastExitAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard
        title="Recent vehicle access events"
        subtitle="Real ANPR authorization and Security review audit events."
        accent="violet"
      >
        {eventsQuery.isPending ? (
          <div className="vehicles-page__state">Loading vehicle access history...</div>
        ) : eventsQuery.isError ? (
          <div className="vehicles-page__state vehicles-page__state--error">
            Vehicle access history is unavailable.
          </div>
        ) : events.length === 0 ? (
          <div className="vehicles-page__state">
            No vehicle access events have been recorded.
          </div>
        ) : (
          <div className="vehicles-table-wrap">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Holder</th>
                  <th>Organization</th>
                  <th>Gate</th>
                  <th>Direction</th>
                  <th>Decision</th>
                  <th>Action</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.plateNumber}</strong></td>
                    <td>{event.holderName ?? "—"}</td>
                    <td>{event.organizationName ?? "—"}</td>
                    <td>{event.gateName ?? "—"}</td>
                    <td>{event.direction}</td>
                    <td>{event.decision}</td>
                    <td>{event.action}</td>
                    <td>{formatDate(event.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
