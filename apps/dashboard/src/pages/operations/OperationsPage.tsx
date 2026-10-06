import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveVisitor,
  checkOutVisitor,
  denyVisitor,
  getVisitorOperations
} from "../../api/visitor-api";
import {
  approveVehicleRequest,
  denyVehicleRequest,
  getVehicleRequests,
  getVehicles
} from "../../api/vehicle-access-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";

import "./OperationsPage.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function OperationsPage() {
  const queryClient = useQueryClient();

  const visitorsQuery = useQuery({
    queryKey: ["visitor-operations"],
    queryFn: getVisitorOperations,
    refetchInterval: 3000
  });
  const vehicleRequestsQuery = useQuery({
    queryKey: ["vehicle-access-requests"],
    queryFn: getVehicleRequests,
    refetchInterval: 3000
  });
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    refetchInterval: 5000
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["visitor-operations"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicle-access-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicle-access-events"] }),
      queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
      queryClient.invalidateQueries({ queryKey: ["operations-summary"] })
    ]);
  };

  const visitorReview = useMutation({
    mutationFn: ({ visitId, decision }: { visitId: string; decision: "APPROVE" | "DENY" }) =>
      decision === "APPROVE" ? approveVisitor(visitId) : denyVisitor(visitId),
    onSuccess: refresh
  });
  const visitorCheckout = useMutation({
    mutationFn: checkOutVisitor,
    onSuccess: refresh
  });
  const vehicleReview = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: string; decision: "APPROVE" | "DENY" }) =>
      decision === "APPROVE" ? approveVehicleRequest(requestId) : denyVehicleRequest(requestId),
    onSuccess: refresh
  });

  const pendingVisitors = visitorsQuery.data?.data.pending ?? [];
  const peopleInside = visitorsQuery.data?.data.inside ?? [];
  const pendingVehicles = vehicleRequestsQuery.data?.data ?? [];
  const registeredVehiclesInside = (vehiclesQuery.data?.data ?? []).filter((vehicle) => vehicle.isCurrentlyInside);
  const visitorVehiclesInside = peopleInside.filter((visit) => Boolean(visit.vehicleNumber));
  const vehiclesInsideCount = new Set([
    ...registeredVehiclesInside.map((vehicle) => vehicle.normalizedPlateNumber),
    ...visitorVehiclesInside.map((visit) => (visit.vehicleNumber ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase())
  ]).size;
  const actionError =
    visitorReview.error instanceof Error ? visitorReview.error.message :
    visitorCheckout.error instanceof Error ? visitorCheckout.error.message :
    vehicleReview.error instanceof Error ? vehicleReview.error.message : null;

  return (
    <div className="operations-page">
      <header className="operations-page__header">
        <div>
          <p className="operations-page__eyebrow">Security & Reception</p>
          <h1>Live Operations</h1>
          <p>One real-time workspace for visitor approvals, vehicle arrivals and occupancy inside this building.</p>
        </div>
        <div className="operations-page__live"><span /> LIVE</div>
      </header>

      {actionError ? <div className="operations-page__error">{actionError}</div> : null}

      <section className="operations-page__metrics">
        <GlassCard title="Visitors waiting" subtitle="Kiosk registrations awaiting review" accent="violet">
          <strong>{visitorsQuery.isPending ? "—" : pendingVisitors.length}</strong>
        </GlassCard>
        <GlassCard title="People inside" subtitle="Visitors currently checked in" accent="blue">
          <strong>{visitorsQuery.isPending ? "—" : peopleInside.length}</strong>
        </GlassCard>
        <GlassCard title="Vehicles waiting" subtitle="ANPR detections requiring Security" accent="violet">
          <strong>{vehicleRequestsQuery.isPending ? "—" : pendingVehicles.length}</strong>
        </GlassCard>
        <GlassCard title="Vehicles inside" subtitle="Authorized vehicles currently inside" accent="blue">
          <strong>{vehiclesQuery.isPending || visitorsQuery.isPending ? "—" : vehiclesInsideCount}</strong>
        </GlassCard>
      </section>

      <GlassCard title="Visitor approval queue" subtitle="Kiosk registrations waiting for Reception or Security." accent="violet">
        {visitorsQuery.isPending ? <div className="operations-page__state">Loading visitors...</div> :
        visitorsQuery.isError ? <div className="operations-page__state operations-page__state--error">Visitor operations are unavailable.</div> :
        pendingVisitors.length === 0 ? <div className="operations-page__state">No visitors are waiting for approval.</div> :
        <div className="operations-table-wrap"><table className="operations-table">
          <thead><tr><th>Visitor</th><th>Organization</th><th>Destination</th><th>Host</th><th>Vehicle</th><th>Registered</th><th>Actions</th></tr></thead>
          <tbody>{pendingVisitors.map((visit) => <tr key={visit.id}>
            <td><strong>{visit.fullName}</strong><span>{visit.phone ?? "—"}</span></td>
            <td>{visit.organization.name}</td>
            <td>{visit.departmentOrOffice ?? "—"}</td>
            <td>{visit.hostName ?? "—"}</td>
            <td>{visit.vehicleNumber ?? "—"}</td>
            <td>{formatDate(visit.registeredAt)}</td>
            <td><div className="operations-page__actions">
              <GlassButton type="button" disabled={visitorReview.isPending} onClick={() => visitorReview.mutate({ visitId: visit.id, decision: "APPROVE" })}>Approve Visitor</GlassButton>
              <GlassButton type="button" variant="secondary" disabled={visitorReview.isPending} onClick={() => visitorReview.mutate({ visitId: visit.id, decision: "DENY" })}>Deny</GlassButton>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
      </GlassCard>

      <GlassCard title="Vehicle approval queue" subtitle="Unknown or low-confidence ANPR arrivals remain locked until a decision." accent="violet">
        {vehicleRequestsQuery.isPending ? <div className="operations-page__state">Loading vehicle arrivals...</div> :
        vehicleRequestsQuery.isError ? <div className="operations-page__state operations-page__state--error">Vehicle approvals are unavailable.</div> :
        pendingVehicles.length === 0 ? <div className="operations-page__state">No vehicles are waiting for approval.</div> :
        <div className="operations-table-wrap"><table className="operations-table">
          <thead><tr><th>Plate</th><th>Gate</th><th>Direction</th><th>Confidence</th><th>Evidence</th><th>Detected</th><th>Actions</th></tr></thead>
          <tbody>{pendingVehicles.map((item) => <tr key={item.id}>
            <td><strong>{item.plateNumber}</strong><span>{item.reason.replaceAll("_", " ")}</span></td>
            <td>{item.gate?.name ?? "—"}</td><td>{item.direction}</td>
            <td>{item.confidence == null ? "—" : `${Math.round(item.confidence * 100)}%`}</td>
            <td>{item.snapshotUrl ? <a href={item.snapshotUrl} target="_blank" rel="noreferrer">View image</a> : "—"}</td>
            <td>{formatDate(item.detectedAt)}</td>
            <td><div className="operations-page__actions">
              <GlassButton type="button" disabled={vehicleReview.isPending} onClick={() => vehicleReview.mutate({ requestId: item.id, decision: "APPROVE" })}>Approve & Open Gate</GlassButton>
              <GlassButton type="button" variant="secondary" disabled={vehicleReview.isPending} onClick={() => vehicleReview.mutate({ requestId: item.id, decision: "DENY" })}>Deny</GlassButton>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
      </GlassCard>

      <div className="operations-page__inside-grid">
        <GlassCard title="People currently inside" subtitle="Live visitor occupancy for this building." accent="blue">
          {peopleInside.length === 0 ? <div className="operations-page__state">No visitors are currently inside.</div> :
          <div className="operations-page__inside-list">{peopleInside.map((visit) => <article key={visit.id}>
            <div><strong>{visit.fullName}</strong><span>{visit.organization.name} · {visit.pass?.passNumber ?? "Visitor"}</span><span>Entered {formatDate(visit.checkedInAt)}</span></div>
            <GlassButton type="button" variant="secondary" disabled={visitorCheckout.isPending} onClick={() => visitorCheckout.mutate(visit.id)}>Check out</GlassButton>
          </article>)}</div>}
        </GlassCard>

        <GlassCard title="Vehicles currently inside" subtitle="Authorized vehicle occupancy from ANPR state." accent="blue">
          {registeredVehiclesInside.length === 0 && visitorVehiclesInside.length === 0 ? <div className="operations-page__state">No vehicles are currently inside.</div> :
          <div className="operations-page__inside-list">
            {registeredVehiclesInside.map((vehicle) => <article key={vehicle.id}>
              <div><strong>{vehicle.plateNumber}</strong><span>Permanent vehicle · entered {formatDate(vehicle.lastEntryAt)}</span></div>
              <span className="operations-page__inside-badge">INSIDE</span>
            </article>)}
            {visitorVehiclesInside
              .filter((visit) => !registeredVehiclesInside.some((vehicle) =>
                vehicle.normalizedPlateNumber === (visit.vehicleNumber ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
              ))
              .map((visit) => <article key={`visitor-vehicle-${visit.id}`}>
                <div><strong>{visit.vehicleNumber}</strong><span>Visitor vehicle · {visit.fullName} · entered {formatDate(visit.checkedInAt)}</span></div>
                <span className="operations-page__inside-badge">INSIDE</span>
              </article>)}
          </div>}
        </GlassCard>
      </div>
    </div>
  );
}
