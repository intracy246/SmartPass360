import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../../api/api-client";
import { getCurrentBuilding } from "../../api/building-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import {
  exportVisitorReportPdf,
  formatReportDateTime,
  getReportRangeLabel,
  summarizeVisitorReport,
  getAllReportOrganizations,
  type ReportOrganization,
  type ReportPeriod,
  type VisitorReportVisit
} from "../../utils/visitor-report-pdf";

import "./ReportsPage.css";

type ReportResponse = {
  success: boolean;
  period: ReportPeriod;
  count: number;
  data: VisitorReportVisit[];
};

const periodOptions: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Daily report — today" },
  { value: "week", label: "Weekly report — Monday to Sunday" },
  { value: "month", label: "Monthly report — calendar month" }
];

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const dailyReportQuery = useQuery({
    queryKey: ["visitor-report", "today"],
    queryFn: () => apiRequest<ReportResponse>("/visitors/report?period=today"),
    staleTime: 15_000
  });

  const weeklyReportQuery = useQuery({
    queryKey: ["visitor-report", "week"],
    queryFn: () => apiRequest<ReportResponse>("/visitors/report?period=week"),
    staleTime: 15_000
  });

  const monthlyReportQuery = useQuery({
    queryKey: ["visitor-report", "month"],
    queryFn: () => apiRequest<ReportResponse>("/visitors/report?period=month"),
    staleTime: 15_000
  });

  const reportQuery = period === "today"
    ? dailyReportQuery
    : period === "week"
      ? weeklyReportQuery
      : monthlyReportQuery;

  const buildingQuery = useQuery({
    queryKey: ["building-settings"],
    queryFn: getCurrentBuilding,
    staleTime: 60_000
  });

  const organizationsQuery = useQuery({
    queryKey: ["report-organizations"],
    queryFn: getAllReportOrganizations,
    staleTime: 60_000
  });

  const visits = reportQuery.data?.data ?? [];
  const dailyVisits = dailyReportQuery.data?.data ?? [];
  const weeklyVisits = weeklyReportQuery.data?.data ?? [];
  const monthlyVisits = monthlyReportQuery.data?.data ?? [];
  const organizations = organizationsQuery.data ?? [];

  const comparisonOrganizations = useMemo(() => {
    const all = [...organizations];
    for (const visit of [...dailyVisits, ...weeklyVisits, ...monthlyVisits]) {
      const item = visit.organization;
      if (item && !all.some((organization) => organization.id === item.id)) {
        all.push({ id: item.id, name: item.name });
      }
    }
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations, dailyVisits, weeklyVisits, monthlyVisits]);

  const summaries = useMemo(
    () => summarizeVisitorReport(organizations, visits),
    [organizations, visits]
  );
  const organizationsVisited = summaries.filter((item) => item.visitors > 0).length;
  const entered = visits.filter((visit) => Boolean(visit.checkedInAt)).length;
  const exited = visits.filter((visit) => Boolean(visit.checkedOutAt)).length;
  const isLoading = dailyReportQuery.isPending || weeklyReportQuery.isPending ||
    monthlyReportQuery.isPending || buildingQuery.isPending || organizationsQuery.isPending;
  const reportError = dailyReportQuery.error || weeklyReportQuery.error || monthlyReportQuery.error ||
    buildingQuery.error || organizationsQuery.error;
  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      await exportVisitorReportPdf(period);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The PDF report could not be generated.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="reports-page">
      <header className="reports-page__header">
        <div>
          <p className="reports-page__eyebrow">Analytics & Records</p>
          <h1>Visitor Reports</h1>
          <p className="reports-page__description">
            Review visitor activity by day, week, or month. Reports include every organization in this building,
            organization-level visitor counts, and the detailed visitor register.
          </p>
        </div>
        <div className="reports-page__header-actions">
          <GlassButton
            type="button"
            variant="secondary"
            onClick={() => void Promise.all([dailyReportQuery.refetch(), weeklyReportQuery.refetch(), monthlyReportQuery.refetch(), buildingQuery.refetch(), organizationsQuery.refetch()])}
            disabled={isLoading}
          >
            Refresh data
          </GlassButton>
          <GlassButton type="button" onClick={() => void handleExport()} disabled={isExporting || isLoading}>
            {isExporting ? "Preparing PDF…" : "Download PDF"}
          </GlassButton>
        </div>
      </header>

      <section className="reports-page__filters" aria-label="Report filters">
        <label>
          <span>Reporting period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="reports-page__range">
          <span>Selected range</span>
          <strong>{getReportRangeLabel(period)}</strong>
        </div>
        <div className="reports-page__building">
          <span>Building</span>
          <strong>{buildingQuery.data?.data.name ?? (buildingQuery.isPending ? "Loading…" : "Unavailable")}</strong>
        </div>
      </section>

      {exportError && <p className="reports-page__error" role="alert">{exportError}</p>}
      {reportError && (
        <div className="reports-page__error" role="alert">
          {reportError.message}
          <button type="button" onClick={() => void Promise.all([reportQuery.refetch(), buildingQuery.refetch(), organizationsQuery.refetch()])}>
            Try again
          </button>
        </div>
      )}

      <section className="reports-page__metrics" aria-label="Visitor report summary">
        <article className="reports-page__metric">
          <span>Visitors registered</span>
          <strong>{isLoading ? "—" : visits.length}</strong>
          <small>Visitor registrations during this period</small>
        </article>
        <article className="reports-page__metric">
          <span>Organizations visited</span>
          <strong>{isLoading ? "—" : organizationsVisited}</strong>
          <small>Organizations with at least one visitor</small>
        </article>
        <article className="reports-page__metric">
          <span>Entered</span>
          <strong>{isLoading ? "—" : entered}</strong>
          <small>Visits with a recorded entry</small>
        </article>
        <article className="reports-page__metric">
          <span>Exited</span>
          <strong>{isLoading ? "—" : exited}</strong>
          <small>Visits with a recorded exit</small>
        </article>
      </section>

      <section className="reports-page__section">
        <div className="reports-page__section-heading">
          <div>
            <h2>Organization Summary</h2>
            <p>Each organization assigned to this building is shown, including organizations with zero visits during this period.</p>
          </div>
          <span>{summaries.length} organizations</span>
        </div>
        {isLoading ? (
          <p className="reports-page__state">Loading organization totals…</p>
        ) : (
          <div className="reports-page__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Visitors registered</th>
                  <th>Entered</th>
                  <th>Exited</th>
                  <th>Pending</th>
                  <th>Rejected / denied</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((item) => (
                  <tr key={item.organization.id}>
                    <td>
                      <strong>{item.organization.name}</strong>
                      <small>{item.organization.code ?? (item.organization.isActive === false ? "Inactive" : "")}</small>
                    </td>
                    <td>{item.visitors}</td>
                    <td>{item.entered}</td>
                    <td>{item.exited}</td>
                    <td>{item.pending}</td>
                    <td>{item.rejected}</td>
                  </tr>
                ))}
                <tr className="reports-page__total-row">
                  <td><strong>TOTAL</strong></td>
                  <td>{visits.length}</td>
                  <td>{entered}</td>
                  <td>{exited}</td>
                  <td>{visits.filter((visit) => visit.status === "PENDING_APPROVAL").length}</td>
                  <td>{visits.filter((visit) => ["REJECTED", "DENIED"].includes(visit.status)).length}</td>
                </tr>
                {summaries.length === 0 && (
                  <tr><td colSpan={6} className="reports-page__empty">No organizations are assigned to this building.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reports-page__section">
        <div className="reports-page__section-heading">
          <div>
            <h2>Visitor Register</h2>
            <p>Detailed registrations included in the selected reporting period, displayed in East Africa Time (EAT).</p>
          </div>
          <span>{visits.length} records</span>
        </div>
        {isLoading ? (
          <p className="reports-page__state">Loading visitor records…</p>
        ) : visits.length === 0 ? (
          <p className="reports-page__empty reports-page__empty--block">No visitor registrations were recorded during this period. You can still export the zero-activity report as PDF.</p>
        ) : (
          <div className="reports-page__table-wrap">
            <table className="reports-page__visits-table">
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Organization</th>
                  <th>Purpose</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Pass number</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id}>
                    <td><strong>{visit.fullName}</strong><small>{visit.phone || "—"}</small></td>
                    <td>{visit.organization?.name ?? "—"}</td>
                    <td>{visit.purpose || "—"}</td>
                    <td>{formatReportDateTime(visit.registeredAt)}</td>
                    <td><span className={"reports-page__status reports-page__status--" + visit.status.toLowerCase()}>{statusLabel(visit.status)}</span></td>
                    <td>{formatReportDateTime(visit.checkedInAt)}</td>
                    <td>{formatReportDateTime(visit.checkedOutAt)}</td>
                    <td>{visit.pass?.passNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="reports-page__footer">
        <span>Building-level reporting · East Africa Time (EAT)</span>
        <strong>SmartPass360 by SmartCycle360</strong>
      </footer>
    </div>
  );
}
