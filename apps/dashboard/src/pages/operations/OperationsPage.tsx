import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveAndIssueVisitorPass,
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
import { printVisitorPass } from "../../utils/visitor-pass-print";
import { downloadVisitorPassImage } from "../../utils/visitor-pass-image";

import "./OperationsPage.css";

type IssuedVisitorTicket = {
  passNumber: string;
  qrValue: string;
  fullName: string;
  organizationName: string;
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose?: string | null;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function OperationsPage() {
  const queryClient = useQueryClient();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [visitorNotice, setVisitorNotice] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<IssuedVisitorTicket | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  const previousPendingIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const visitorsQuery = useQuery({
    queryKey: ["visitor-operations"],
    queryFn: getVisitorOperations,
    refetchInterval: 2500,
    refetchIntervalInBackground: true
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

  useEffect(() => {
    const pending = visitorsQuery.data?.data.pending ?? [];
    if (visitorsQuery.isError || visitorsQuery.isPending) return;

    const currentIds = new Set(pending.map((visit) => visit.id));
    const previousIds = previousPendingIds.current;

    // Establish a baseline at page load. Only newly observed visit IDs trigger an alert.
    if (previousIds) {
      const arrivals = pending.filter((visit) => !previousIds.has(visit.id));
      if (arrivals.length > 0) {
        const names = arrivals.slice(0, 3).map((visit) => visit.fullName).join(", ");
        setVisitorNotice(
          `${arrivals.length} new visitor${arrivals.length === 1 ? "" : "s"} waiting for approval${names ? `: ${names}` : ""}`
        );

        if (notificationEnabled) {
          try {
            const context = audioContextRef.current ?? new AudioContext();
            audioContextRef.current = context;
            if (context.state === "suspended") await context.resume();

            const startAt = context.currentTime;
            [0, 0.24, 0.48].forEach((offset, index) => {
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              oscillator.type = "sine";
              oscillator.frequency.value = index === 1 ? 1046 : 880;
              gain.gain.setValueAtTime(0.0001, startAt + offset);
              gain.gain.exponentialRampToValueAtTime(0.16, startAt + offset + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18);
              oscillator.connect(gain);
              gain.connect(context.destination);
              oscillator.start(startAt + offset);
              oscillator.stop(startAt + offset + 0.2);
            });
          } catch (error) {
            console.warn("SmartPass360 notification sound could not play.", error);
          }

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("SmartPass360 · Visitor waiting", {
              body: arrivals.length === 1
                ? `${arrivals[0].fullName} is waiting for approval.`
                : `${arrivals.length} visitors are waiting for approval.`,
              icon: "/favicon.svg"
            });
          }
        }
      } else if (pending.length === 0) {
        setVisitorNotice(null);
      }
    }

    previousPendingIds.current = currentIds;
  }, [visitorsQuery.data?.data.pending, visitorsQuery.isError, visitorsQuery.isPending, notificationEnabled]);

  async function enableVisitorAlerts() {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();

      // Brief silent oscillator unlocks audio playback within this explicit user gesture.
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.02);
      setNotificationEnabled(true);
    } catch {
      setNotificationEnabled(true);
    }
  }

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
      decision === "APPROVE" ? approveAndIssueVisitorPass(visitId) : denyVisitor(visitId),
    onSuccess: async (response, variables) => {
      if (variables.decision === "APPROVE") {
        const pass = response.data.pass;
        setIssuedTicket(pass);
        setTicketError(null);
        const printWindow = window.open("", "_blank", "width=420,height=720");
        if (printWindow) {
          try {
            await printVisitorPass(pass, printWindow);
          } catch (error) {
            setTicketError(error instanceof Error ? error.message : "Pass issued, but printing failed. Use Print ticket below.");
          }
        } else {
          setTicketError("Pass issued successfully, but the browser blocked the print window. Allow pop-ups, then use Print ticket below.");
        }
      }
      await refresh();
    }
  });
  const visitorCheckout = useMutation({
    mutationFn: checkOutVisitor,
    onSuccess: refresh
  });
  const vehicleReview = useMutation<
    { data: import("../../api/vehicle-access-api").VehicleAccessRequest; action: "UNLOCK" | "KEEP_LOCKED" },
    Error,
    { requestId: string; decision: "APPROVE" | "DENY" }
  >({
    mutationFn: ({ requestId, decision }) =>
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
        <div className="operations-page__header-actions">
        <button
          type="button"
          className={notificationEnabled ? "operations-page__alert-toggle is-enabled" : "operations-page__alert-toggle"}
          onClick={() => void enableVisitorAlerts()}
        >
          {notificationEnabled ? "🔔 Alerts enabled" : "🔔 Enable sound alerts"}
        </button>
        <div className="operations-page__live"><span /> LIVE</div>
      </div>
      </header>

      {actionError ? <div className="operations-page__error">{actionError}</div> : null}
      {visitorNotice ? (
        <div className="operations-page__visitor-notice" role="status">
          <span className="operations-page__visitor-notice-icon">🔔</span>
          <div>
            <strong>Visitor approval required</strong>
            <span>{visitorNotice}</span>
          </div>
          <button type="button" onClick={() => setVisitorNotice(null)} aria-label="Dismiss notification">×</button>
        </div>
      ) : null}
      {issuedTicket ? (
        <section className="operations-page__issued-ticket" aria-label="Issued visitor ticket">
          <div className="operations-page__issued-ticket-copy">
            <span>PASS ISSUED · VALID FOR 24 HOURS</span>
            <h3>{issuedTicket.fullName}</h3>
            <p>{issuedTicket.organizationName} · {issuedTicket.passNumber}</p>
            <p>Valid until {new Date(issuedTicket.validUntil).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}</p>
          </div>
          <img src={issuedTicket.qrValue} alt="Visitor pass QR code" />
          <div className="operations-page__ticket-actions">
            <button type="button" disabled={ticketBusy} onClick={async () => {
              setTicketBusy(true);
              setTicketError(null);
              try { await printVisitorPass(issuedTicket); }
              catch (error) { setTicketError(error instanceof Error ? error.message : "Unable to print ticket."); }
              finally { setTicketBusy(false); }
            }}>Print ticket</button>
            <button type="button" disabled={ticketBusy} onClick={async () => {
              setTicketBusy(true);
              setTicketError(null);
              try { await downloadVisitorPassImage(issuedTicket); }
              catch (error) { setTicketError(error instanceof Error ? error.message : "Unable to download ticket."); }
              finally { setTicketBusy(false); }
            }}>Download PNG</button>
            <button type="button" disabled={ticketBusy} onClick={() => setIssuedTicket(null)}>Close</button>
          </div>
        </section>
      ) : null}
      {ticketError ? <div className="operations-page__error" role="alert">{ticketError}</div> : null}

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
