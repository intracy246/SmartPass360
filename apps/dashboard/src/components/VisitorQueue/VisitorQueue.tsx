import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/api-client";
import "./VisitorQueue.css";

type ReportPeriod = "today" | "week" | "month";

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

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet formula execution from untrusted visitor-entered text.
  if (/^[\u0000-\u0020]*[=+@-]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(visits: QueueVisit[], period: ReportPeriod) {
  const headers = [
    "Visit ID",
    "Visitor Name",
    "Phone",
    "Company",
    "Organization",
    "Department / Office",
    "Host",
    "Purpose",
    "Vehicle Registration",
    "Registered At (EAT)",
    "Registration Source",
    "Visit Status",
    "Approved At",
    "Checked In At",
    "Checked Out At",
    "Pass Number"
  ];

  const rows = visits.map((visit) => [
    visit.id,
    visit.fullName,
    visit.phone,
    visit.company,
    visit.organization?.name,
    visit.departmentOrOffice,
    visit.hostName,
    visit.purpose,
    visit.vehicleNumber,
    visit.registeredAt ? new Date(visit.registeredAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" }) : "",
    visit.source,
    visit.status,
    visit.approvedAt ? new Date(visit.approvedAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" }) : "",
    visit.checkedInAt ? new Date(visit.checkedInAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" }) : "",
    visit.checkedOutAt ? new Date(visit.checkedOutAt).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" }) : "",
    visit.pass?.passNumber
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  anchor.href = url;
  anchor.download = `smartpass360-visitors-${period}-${localDate}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisitorQueue() {
  const queryClient = useQueryClient();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("today");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["visitor-queue", "today"],
    queryFn: () => apiRequest<{ data: QueueVisit[]; period?: string }>("/visitors?period=today"),
    refetchInterval: 3000
  });

  const approval = useMutation({
    mutationFn: (visitId: string) =>
      apiRequest<{ success: boolean; data: { id: string; status: string } }>(
        `/visitors/${encodeURIComponent(visitId)}/approve`,
        { method: "POST" }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["visitor-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["visitor-operations"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-summary"] })
      ]);
    }
  });

  async function exportReport() {
    setIsExporting(true);
    setExportError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        period: ReportPeriod;
        count: number;
        data: QueueVisit[];
      }>(`/visitors/report?period=${reportPeriod}`);

      downloadCsv(response.data, reportPeriod);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export the visitor report.");
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
            {isExporting ? "Preparing report…" : `Export ${reportPeriodLabels[reportPeriod]}`}
          </button>
        </div>
      </header>

      {exportError && <p className="visitor-queue__error" role="alert">{exportError}</p>}
      {(queue.error || approval.error) && (
        <p className="visitor-queue__error" role="alert">{(queue.error || approval.error)?.message}</p>
      )}
      {queue.isPending && <p>Loading today's visits…</p>}
      {queue.data?.data.length === 0 && !queue.isPending && <p>No visits registered today. Previous days are preserved in reports.</p>}

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
            {queue.data?.data.map((visit) => (
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
                        onClick={() => approval.mutate(visit.id)}
                      >
                        {visit.source === "MOBILE_QR" ? "Approve & release QR ticket" : "Approve visitor"}
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
