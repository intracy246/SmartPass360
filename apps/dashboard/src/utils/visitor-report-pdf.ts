import { apiRequest } from "../api/api-client";
import { getCurrentBuilding, type BuildingSettings } from "../api/building-api";

export type ReportPeriod = "today" | "week" | "month";

export type VisitorReportVisit = {
  id: string;
  visitorId?: string;
  fullName: string;
  phone?: string | null;
  company?: string | null;
  organization?: { id: string; name: string } | null;
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose?: string | null;
  registeredAt: string;
  source?: string | null;
  status: string;
  approvedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  pass?: { passNumber?: string | null } | null;
};

export type ReportOrganization = {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
};

type ReportResponse = {
  success: boolean;
  period: ReportPeriod;
  count: number;
  data: VisitorReportVisit[];
};

type OrganizationResponse = {
  success: boolean;
  data: ReportOrganization[];
};

export type OrganizationReportSummary = {
  organization: ReportOrganization;
  visitors: number;
  visits: number;
  entered: number;
  exited: number;
  pending: number;
  rejected: number;
};

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: "Daily",
  week: "Weekly",
  month: "Monthly"
};

function dateKeyInDarEsSalaam(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const get = (name: string) => parts.find((part) => part.type === name)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function addDays(dateKey: string, days: number) {
  const parts = dateKey.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
}

function dateKeyForUtc(dateKey: string) {
  return new Date(dateKey + "T00:00:00.000Z");
}

export function formatReportDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatReportDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function getReportRangeLabel(period: ReportPeriod, now = new Date()) {
  const today = dateKeyInDarEsSalaam(now);
  let start = today;
  let endExclusive = addDays(today, 1);

  if (period === "week") {
    const weekday = dateKeyForUtc(today).getUTCDay();
    const daysFromMonday = (weekday + 6) % 7;
    start = addDays(today, -daysFromMonday);
    endExclusive = addDays(start, 7);
  } else if (period === "month") {
    const date = dateKeyForUtc(today);
    start = date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-01";
    endExclusive = date.getUTCMonth() === 11
      ? String(date.getUTCFullYear() + 1) + "-01-01"
      : date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 2).padStart(2, "0") + "-01";
  }

  const lastDay = addDays(endExclusive, -1);
  return start === lastDay
    ? formatReportDate(start + "T12:00:00.000Z")
    : formatReportDate(start + "T12:00:00.000Z") + " – " + formatReportDate(lastDay + "T12:00:00.000Z");
}

export function summarizeVisitorReport(
  organizations: ReportOrganization[],
  visits: VisitorReportVisit[]
): OrganizationReportSummary[] {
  const allOrganizations = [...organizations];
  for (const visit of visits) {
    const organization = visit.organization;
    if (organization && !allOrganizations.some((item) => item.id === organization.id)) {
      allOrganizations.push({ id: organization.id, name: organization.name });
    }
  }

  return allOrganizations
    .map((organization) => {
      const organizationVisits = visits.filter((visit) => visit.organization?.id === organization.id);
      return {
        organization,
        visitors: new Set(organizationVisits.map((visit) => visit.visitorId || visit.id)).size,
        visits: organizationVisits.length,
        entered: organizationVisits.filter((visit) => Boolean(visit.checkedInAt)).length,
        exited: organizationVisits.filter((visit) => Boolean(visit.checkedOutAt)).length,
        pending: organizationVisits.filter((visit) => visit.status === "PENDING_APPROVAL").length,
        rejected: organizationVisits.filter((visit) => ["REJECTED", "DENIED"].includes(visit.status)).length
      };
    })
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeLogoUrl(value?: string | null) {
  if (!value) return "";
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)) return value;
  if (/^https:\/\//i.test(value)) return value;
  return "";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function reportHtml(
  period: ReportPeriod,
  building: BuildingSettings,
  visits: VisitorReportVisit[],
  organizations: ReportOrganization[]
) {
  const summary = summarizeVisitorReport(organizations, visits);
  const uniqueVisitors = new Set(visits.map((visit) => visit.visitorId || visit.id)).size;
  const entered = visits.filter((visit) => Boolean(visit.checkedInAt)).length;
  const exited = visits.filter((visit) => Boolean(visit.checkedOutAt)).length;
  const periodTitle = REPORT_PERIOD_LABELS[period] + " Visitor Report";
  const logoUrl = safeLogoUrl(building.logoUrl);
  const logo = logoUrl
    ? '<img class="building-logo" src="' + escapeHtml(logoUrl) + '" alt="Building logo">'
    : '<div class="building-logo-fallback">SP</div>';

  const summaryRows = summary.map((item) =>
    "<tr><td><strong>" + escapeHtml(item.organization.name) + "</strong>" +
    (item.organization.code ? '<div class="muted">' + escapeHtml(item.organization.code) + "</div>" : "") +
    "</td><td class=\"num\">" + item.visitors + "</td><td class=\"num\">" + item.visits +
    "</td><td class=\"num\">" + item.entered + "</td><td class=\"num\">" + item.exited +
    "</td><td class=\"num\">" + item.pending + "</td><td class=\"num\">" + item.rejected + "</td></tr>"
  ).join("");

  const detailRows = visits.map((visit, index) =>
    "<tr><td>" + (index + 1) + "</td><td><strong>" + escapeHtml(visit.fullName) +
    "</strong><div class=\"muted\">" + escapeHtml(visit.phone || "—") + "</div></td><td>" +
    escapeHtml(visit.organization?.name || "—") + "</td><td>" + escapeHtml(visit.purpose || "—") +
    "</td><td>" + escapeHtml(formatReportDateTime(visit.registeredAt)) + "</td><td>" +
    escapeHtml(statusLabel(visit.status)) + "</td><td>" +
    escapeHtml(formatReportDateTime(visit.checkedInAt)) + "</td><td>" +
    escapeHtml(formatReportDateTime(visit.checkedOutAt)) + "</td><td>" +
    escapeHtml(visit.pass?.passNumber || "—") + "</td></tr>"
  ).join("");

  const organizationSummary = summaryRows ||
    '<tr><td colspan="7" class="empty">No organizations are configured for this building.</td></tr>';
  const visitDetails = detailRows ||
    '<tr><td colspan="9" class="empty">No visitor registrations were recorded during this period.</td></tr>';
  const totals = "<tr class=\"total-row\"><td><strong>TOTAL</strong></td><td class=\"num\">" +
    uniqueVisitors + "</td><td class=\"num\">" + visits.length + "</td><td class=\"num\">" +
    entered + "</td><td class=\"num\">" + exited + "</td><td class=\"num\">" +
    visits.filter((visit) => visit.status === "PENDING_APPROVAL").length + "</td><td class=\"num\">" +
    visits.filter((visit) => ["REJECTED", "DENIED"].includes(visit.status)).length + "</td></tr>";

  const css = [
    "@page{size:A4 landscape;margin:12mm 10mm 18mm}",
    "*{box-sizing:border-box}",
    "body{margin:0;padding:0 0 18mm;font-family:Arial,Helvetica,sans-serif;color:#142033;font-size:10px;line-height:1.4;background:#fff}",
    ".report-header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1b6a58;padding:0 0 14px;margin-bottom:16px}",
    ".building-logo{width:74px;height:74px;object-fit:contain;border-radius:10px}",
    ".building-logo-fallback{width:74px;height:74px;border-radius:10px;background:#123d35;color:#fff;display:flex;align-items:center;justify-content:center;font-size:25px;font-weight:800}",
    ".heading{flex:1}.brand{font-size:10px;letter-spacing:2px;font-weight:800;color:#1b6a58}.heading h1{font-size:24px;line-height:1.15;margin:3px 0 6px;color:#12263b}.heading p{margin:2px 0;color:#526071}.right{text-align:right;min-width:145px}.right strong{font-size:12px}.muted{color:#667386;font-size:8px;margin-top:2px}",
    ".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.kpi{border:1px solid #dbe5e9;border-radius:8px;padding:11px 13px;background:#f7faf9}.kpi span{display:block;font-size:9px;color:#607081;text-transform:uppercase;letter-spacing:.7px}.kpi strong{display:block;margin-top:4px;font-size:23px;color:#164c40}",
    "h2{font-size:14px;margin:17px 0 8px;color:#123d35;page-break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:auto;margin-bottom:14px}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#173f37;color:white;text-align:left;font-size:8px;letter-spacing:.2px;padding:8px 7px}td{border:1px solid #dce4e7;padding:7px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f6f9f8}.num{text-align:center;font-variant-numeric:tabular-nums}.total-row{background:#e9f4ef!important;font-weight:700}.total-row td{border-top:2px solid #1b6a58}.empty{text-align:center;padding:18px;color:#667386}",
    ".details td{font-size:8px}.details th{font-size:7.5px}.details td:nth-child(1){width:24px;text-align:center}.details td:nth-child(2){min-width:105px}.details td:nth-child(4){min-width:100px}.details td:nth-child(5),.details td:nth-child(7),.details td:nth-child(8){min-width:100px}",
    ".report-footer{position:fixed;bottom:-12mm;left:0;right:0;border-top:1px solid #cfdbdc;padding:6px 0 0;display:flex;justify-content:space-between;align-items:center;color:#65766f;font-size:8px}.report-footer strong{color:#1b6a58;letter-spacing:.4px}.no-data{color:#667386}",
    "@media screen{body{max-width:1200px;margin:24px auto;padding:28px 30px 70px;box-shadow:0 2px 30px #1233}.report-footer{bottom:20px;left:30px;right:30px}}",
    "@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}"
  ].join("");

  return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>SmartPass360-" + escapeHtml(periodTitle.replaceAll(" ", "-")) + "-" + escapeHtml(dateKeyInDarEsSalaam(new Date())) + "</title><style>" + css + "</style></head><body>" +
    '<header class="report-header">' + logo + '<div class="heading"><div class="brand">SMARTPASS360 · VISITOR ACCESS INTELLIGENCE</div>' +
    "<h1>" + escapeHtml(building.name) + "</h1><p><strong>" + escapeHtml(periodTitle) + "</strong> · Reporting period: " +
    escapeHtml(getReportRangeLabel(period)) + "</p><p>" + escapeHtml([building.address, building.city, building.country].filter(Boolean).join(", ") || building.code) +
    "</p></div><div class=\"right\"><strong>Official Report</strong><div class=\"muted\">Generated: " +
    escapeHtml(formatReportDateTime(new Date())) + "</div><div class=\"muted\">Time zone: East Africa Time (EAT)</div></div></header>" +
    '<section class="kpis"><div class="kpi"><span>Total visits</span><strong>' + visits.length +
    '</strong></div><div class="kpi"><span>Unique visitors</span><strong>' + uniqueVisitors +
    '</strong></div><div class="kpi"><span>Visitors entered</span><strong>' + entered +
    '</strong></div><div class="kpi"><span>Visitors exited</span><strong>' + exited +
    "</strong></div></section>" +
    "<h2>Organization Summary</h2><p class=\"no-data\">Counts are based on visit registrations created within the selected reporting period. Unique visitors are counted once per organization for this period.</p>" +
    '<table><thead><tr><th>Organization</th><th>Unique visitors</th><th>Total visits</th><th>Entered</th><th>Exited</th><th>Pending approval</th><th>Rejected / denied</th></tr></thead><tbody>' +
    organizationSummary + totals + "</tbody></table>" +
    "<h2>Visitor Register</h2><table class=\"details\"><thead><tr><th>No.</th><th>Visitor / phone</th><th>Organization</th><th>Purpose of visit</th><th>Registered (EAT)</th><th>Status</th><th>Entry (EAT)</th><th>Exit (EAT)</th><th>Pass number</th></tr></thead><tbody>" +
    visitDetails + "</tbody></table>" +
    '<footer class="report-footer"><span>Confidential · For authorized building management use</span><span><strong>SmartPass360</strong> by SmartCycle360</span></footer>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},450);});</script></body></html>';
}

function showPopupMessage(popup: Window, message: string) {
  if (popup.closed) return;
  popup.document.open();
  popup.document.write(
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>SmartPass360 report</title>" +
    "<style>body{font-family:Arial,sans-serif;padding:32px;color:#132b3d}h1{color:#176b58}p{line-height:1.6}</style></head><body>" +
    "<h1>SmartPass360 report</h1><p>" + escapeHtml(message) + "</p><p>You can close this window and retry the export.</p></body></html>"
  );
  popup.document.close();
}

export async function exportVisitorReportPdf(period: ReportPeriod) {
  // Open a window directly inside the user click to avoid browser popup blocking.
  const popup = window.open("", "_blank");
  if (!popup) {
    throw new Error("Allow pop-ups for SmartPass360 so the report can open for saving as PDF.");
  }

  popup.document.open();
  popup.document.write("<!doctype html><html><head><title>Preparing SmartPass360 report</title></head><body style=\"font-family:Arial,sans-serif;padding:32px;color:#173f37\"><h1>Preparing report…</h1><p>Fetching approved building data and visitor records.</p></body></html>");
  popup.document.close();

  try {
    const [report, buildingResponse, organizationsResponse] = await Promise.all([
      apiRequest<ReportResponse>("/visitors/report?period=" + encodeURIComponent(period)),
      getCurrentBuilding(),
      apiRequest<OrganizationResponse>("/organizations?page=1&pageSize=100")
    ]);

    const building = buildingResponse.data;
    if (!building?.id || !building.name) {
      throw new Error("Building details could not be loaded. Check the building settings and try again.");
    }

    const html = reportHtml(period, building, report.data ?? [], organizationsResponse.data ?? []);
    if (popup.closed) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The visitor report could not be generated.";
    showPopupMessage(popup, message);
    throw error;
  }
}
