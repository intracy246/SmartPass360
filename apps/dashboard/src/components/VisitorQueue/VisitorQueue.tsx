import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/api-client";
import { printVisitorPass } from "../../utils/visitor-pass-print";
import { downloadVisitorPassImage } from "../../utils/visitor-pass-image";
import { exportVisitorReportPdf, type ReportPeriod } from "../../utils/visitor-report-pdf";
import "./VisitorQueue.css";

type IssuedQueueTicket = {
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

type ApproveAndPrintInput = {
  visitId: string;
  printWindow: Window;
};

type QueueVisit = {
  id: string;
  visitorId?: string;
  fullName: string;
  phone?: string | null;
  company?: string | null;
  vehicleNumber?: string | null;
  organization: { id?: string; name: string };
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose: string;
  registeredAt: string;
  source: string;
  status: string;
  approvedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  pass?: { passNumber: string; status?: string } | null;
};

const reportPeriodLabels: Record<ReportPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month"
};

function darEsSalaamDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function todayInDarEsSalaam() {
  return darEsSalaamDateKey(new Date());
}

export function VisitorQueue() {
  const queryClient = useQueryClient();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("today");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<IssuedQueueTicket | null>(null);
  const [ticketActionError, setTicketActionError] = useState<string | null>(null);
  const [ticketAction, setTicketAction] = useState<"print" | "download" | null>(null);

  const queue = useQuery({
    queryKey: ["visitor-queue", "today"],
    queryFn: () => apiRequest<{ data: QueueVisit[]; period?: string }>("/visitors?period=today"),
    refetchInterval: 3000
  });

  // Defensive display filter: if an older API deployment still returns historical rows,
  // keep the live Reception queue limited to today's Tanzania-local registrations.
  const todayVisits = (queue.data?.data ?? []).filter(
    (visit) => darEsSalaamDateKey(visit.registeredAt) === todayInDarEsSalaam()
  );

  const approval = useMutation({
    mutationFn: ({ visitId }: ApproveAndPrintInput) =>
      apiRequest<{ success: boolean; data: { pass: IssuedQueueTicket } }>(
        `/visitors/${encodeURIComponent(visitId)}/approve-and-issue`,
        { method: "POST" }
      ),
    onSuccess: async (response, variables) => {
      const pass = response.data.pass;
      setIssuedTicket(pass);
      setTicketActionError(null);

      if (!variables.printWindow.closed) {
        setTicketAction("print");
        try {
          await printVisitorPass({
            passNumber: pass.passNumber,
            qrValue: pass.qrValue,
            fullName: pass.fullName,
            organizationName: pass.organizationName,
            departmentOrOffice: pass.departmentOrOffice ?? undefined,
            hostName: pass.hostName ?? undefined,
            purpose: pass.purpose ?? undefined,
            issuedAt: pass.issuedAt,
            validUntil: pass.validUntil
          }, variables.printWindow);
        } catch (error) {
          setTicketActionError(error instanceof Error ? error.message : "The pass was approved, but automatic printing failed.");
        } finally {
          setTicketAction(null);
        }
      } else {
        setTicketActionError("The pass was approved, but the browser blocked automatic printing. Check the printer connection/default printer, then select Print ticket below to retry.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["visitor-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["visitor-operations"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-summary"] })
      ]);
    },
    onError: (_error, variables) => {
      if (!variables.printWindow.closed) {
        variables.printWindow.close();
      }
    }
  });

  function approveAndPrint(visitId: string) {
    setTicketActionError(null);
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) {
      setTicketActionError("The pass was not approved because the browser blocked the print window. Allow pop-ups for SmartPass360, then try again.");
      return;
    }

    // Reserve a window during this user click to satisfy browser popup policies.
    // Approval is intentionally not submitted if a printable window cannot be created.
    printWindow.document.open();
    printWindow.document.write("<!doctype html><html><head><title>SmartPass360</title></head><body style='font-family:Arial,sans-serif;padding:24px;color:#173f37'><h2>SmartPass360</h2><p>Approving the visit and preparing its printable access pass…</p></body></html>");
    printWindow.document.close();
    approval.mutate({ visitId, printWindow });
  }

  async function printIssuedTicket() {
    if (!issuedTicket) return;
    setTicketAction("print");
    setTicketActionError(null);
    try {
      await printVisitorPass({
        passNumber: issuedTicket.passNumber,
        qrValue: issuedTicket.qrValue,
        fullName: issuedTicket.fullName,
        organizationName: issuedTicket.organizationName,
        departmentOrOffice: issuedTicket.departmentOrOffice ?? undefined,
        hostName: issuedTicket.hostName ?? undefined,
        purpose: issuedTicket.purpose ?? undefined,
        issuedAt: issuedTicket.issuedAt,
        validUntil: issuedTicket.validUntil
      });
    } catch (error) {
      setTicketActionError(error instanceof Error ? error.message : "The visitor ticket could not be printed.");
    } finally {
      setTicketAction(null);
    }
  }

  async function downloadIssuedTicket() {
    if (!issuedTicket) return;
    setTicketAction("download");
    setTicketActionError(null);
    try {
      await downloadVisitorPassImage(issuedTicket);
    } catch (error) {
      setTicketActionError(error instanceof Error ? error.message : "The visitor ticket image could not be saved.");
    } finally {
      setTicketAction(null);
    }
  }

  async function exportReport() {
    setIsExporting(true);
    setExportError(null);

    try {
      await exportVisitorReportPdf(reportPeriod);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export the visitor PDF report.");
    } finally {
      setIsExporting(false);
    }
  }
  return (
    <section className="visitor-queue" aria-label="Reception and Security visitor queue">
      <header className="visitor-queue__header">
        <div className="visitor-queue__heading">
          <h2>Reception / Security queue</h2>
          <p>Today's registrations · refreshes every 3 seconds · new list starts at midnight (Dar es Salaam time).</p>
          <p className="visitor-queue__retention-note">Older visits remain saved securely and can be exported by date range.</p>
        </div>

        <div className="visitor-queue__tools">
          <button type="button" className="visitor-queue__refresh" onClick={() => void queue.refetch()} disabled={queue.isFetching}>
            {queue.isFetching ? "Refreshing…" : "Refresh queue"}
          </button>
          <label className="visitor-queue__period">
            <span>Report period</span>
            <select
              value={reportPeriod}
              onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)}
              aria-label="Select visitor report period"
            >
              {Object.entries(reportPeriodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="visitor-queue__export"
            onClick={() => void exportReport()}
            disabled={isExporting}
          >
            {isExporting ? "Preparing PDF…" : `Export PDF · ${reportPeriodLabels[reportPeriod]}`}
          </button>
        </div>
      </header>

      {exportError && <p className="visitor-queue__error" role="alert">{exportError}</p>}
      {issuedTicket && (
        <section className="visitor-queue__issued-ticket" aria-label="Approved visitor ticket">
          <div className="visitor-queue__issued-ticket-copy">
            <span>PASS ISSUED · VALID FOR 24 HOURS</span>
            <h3>{issuedTicket.fullName}</h3>
            <p>{issuedTicket.organizationName} · {issuedTicket.passNumber}</p>
            <p>Valid until {new Date(issuedTicket.validUntil).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}</p>
            <small>The approval action has triggered automatic printing. Use Print ticket only if you need to reprint; Download PNG is available for records.</small>
          </div>
          <img src={issuedTicket.qrValue} alt="Approved visitor ticket QR code" />
          <div className="visitor-queue__ticket-actions">
            <button type="button" onClick={() => void printIssuedTicket()} disabled={ticketAction !== null}>
              {ticketAction === "print" ? "Preparing print…" : "Print ticket"}
            </button>
            <button type="button" onClick={() => void downloadIssuedTicket()} disabled={ticketAction !== null}>
              {ticketAction === "download" ? "Creating image…" : "Download PNG"}
            </button>
            <button type="button" className="visitor-queue__ticket-dismiss" onClick={() => setIssuedTicket(null)} disabled={ticketAction !== null}>
              Close
            </button>
          </div>
        </section>
      )}
      {ticketActionError && <p className="visitor-queue__error" role="alert">{ticketActionError}</p>}
      {(queue.error || approval.error) && (
        <p className="visitor-queue__error" role="alert">{(queue.error || approval.error)?.message}</p>
      )}
      {queue.isPending && <p>Loading today's visits…</p>}
      {todayVisits.length === 0 && !queue.isPending && <p>No visits registered today. Previous days are preserved in reports.</p>}

      <div className="visitor-queue__scroll">
        <table>
          <thead>
            <tr>
              <th>Visitor / phone</th>
              <th>Organization / destination</th>
              <th>Purpose</th>
              <th>Registered / source</th>
              <th>Status / pass</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {todayVisits.map((visit) => (
              <tr key={visit.id}>
                <td><strong>{visit.fullName}</strong><br />{visit.phone || "—"}</td>
                <td>{visit.organization.name}<br />{visit.departmentOrOffice || "—"}<br />{visit.hostName || "—"}</td>
                <td>{visit.purpose || "—"}</td>
                <td>{new Date(visit.registeredAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}<br />{visit.source}</td>
                <td>
                  <strong>{visit.status.replaceAll("_", " ")}</strong><br />
                  {visit.pass?.passNumber || "—"}
                  {visit.checkedInAt && <div>Entry: {new Date(visit.checkedInAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}</div>}
                  {visit.checkedOutAt && <div>Exit: {new Date(visit.checkedOutAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}</div>}
                </td>
                <td>
                  {visit.status === "PENDING_APPROVAL"
                    ? (
                      <button
                        type="button"
                        disabled={approval.isPending}
                        onClick={() => approveAndPrint(visit.id)}
                      >
                        Approve & Print Ticket
                      </button>
                    )
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
