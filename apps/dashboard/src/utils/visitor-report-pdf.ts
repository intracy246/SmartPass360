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
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
};

type VisitsByPeriod = Record<ReportPeriod, VisitorReportVisit[]>;

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

export function formatReportDateTime(value?: string | Date | null) {
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

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\\b[a-z]/g, (character) => character.toUpperCase());
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
        visitors: organizationVisits.length,
        visits: organizationVisits.length,
        entered: organizationVisits.filter((visit) => Boolean(visit.checkedInAt)).length,
        exited: organizationVisits.filter((visit) => Boolean(visit.checkedOutAt)).length,
        pending: organizationVisits.filter((visit) => visit.status === "PENDING_APPROVAL").length,
        rejected: organizationVisits.filter((visit) => ["REJECTED", "DENIED"].includes(visit.status)).length
      };
    })
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
}

type PdfLogo = { bytes: Uint8Array; width: number; height: number };
type PdfPage = { commands: string[]; y: number };
type PdfColumn = { title: string; width: number; align?: "left" | "center" | "right" };
type PdfTableRow = { cells: string[]; total?: boolean };

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PAGE_LEFT = 30;
const PAGE_RIGHT = 812;
const CONTENT_BOTTOM = 552;
const FOOTER_TOP = 565;

function toAsciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

const winAnsiSpecial: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86,
  "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
  "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
};

function normalizePdfText(value: unknown) {
  return String(value ?? "—")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("·", " | ")
    .replaceAll("\u00a0", " ")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfTextHex(value: unknown) {
  const text = normalizePdfText(value);
  const bytes: number[] = [];
  for (const character of text) {
    const code = character.codePointAt(0) ?? 63;
    if (code >= 32 && code <= 126) {
      bytes.push(code);
    } else if (code >= 160 && code <= 255) {
      bytes.push(code);
    } else if (winAnsiSpecial[character] !== undefined) {
      bytes.push(winAnsiSpecial[character]);
    } else {
      bytes.push(63);
    }
  }
  return "<" + bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase() + ">";
}

function wrapText(value: unknown, maxChars: number, maxLines = 5) {
  const text = normalizePdfText(value);
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if ((line + " " + word).length <= maxChars) {
      line += " " + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[.,;:]?$/, "") + "...";
    return clipped;
  }
  return lines;
}

function pdfNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function textCommand(value: unknown, x: number, top: number, size: number, bold = false, color = "0.10 0.16 0.20") {
  const baseline = PAGE_HEIGHT - top - size;
  const font = bold ? "F2" : "F1";
  return color + " rg BT /" + font + " " + pdfNumber(size) + " Tf 1 0 0 1 " +
    pdfNumber(x) + " " + pdfNumber(baseline) + " Tm " + pdfTextHex(value) + " Tj ET";
}

function rectCommand(x: number, top: number, width: number, height: number, fill: string, stroke = "0.82 0.87 0.88") {
  const bottom = PAGE_HEIGHT - top - height;
  return fill + " rg " + stroke + " RG 0.5 w " + pdfNumber(x) + " " + pdfNumber(bottom) + " " +
    pdfNumber(width) + " " + pdfNumber(height) + " re B";
}

function lineCommand(x1: number, top: number, x2: number, color = "0.80 0.86 0.86", thickness = 0.7) {
  const y = PAGE_HEIGHT - top;
  return color + " RG " + pdfNumber(thickness) + " w " + pdfNumber(x1) + " " + pdfNumber(y) +
    " m " + pdfNumber(x2) + " " + pdfNumber(y) + " l S";
}

async function loadLogoAsJpeg(logoUrl?: string | null): Promise<PdfLogo | null> {
  if (!logoUrl || (!logoUrl.startsWith("https://") && !logoUrl.startsWith("data:image/"))) return null;
  try {
    const response = await fetch(logoUrl, { mode: "cors", credentials: "omit" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 420 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    if (!base64) return null;
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, width, height };
  } catch {
    // Cross-origin logo storage may disallow canvas export; the PDF uses a branded fallback mark.
    return null;
  }
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function makeStreamObject(dictionary: string, stream: Uint8Array) {
  return concatBytes([
    toAsciiBytes(dictionary + "\nstream\n"),
    stream,
    toAsciiBytes("\nendstream")
  ]);
}

function buildPdfBytes(pageContents: string[][], logo: PdfLogo | null) {
  const objectStartId = logo ? 4 : 3;
  const contentIds = pageContents.map((_, index) => objectStartId + index * 2);
  const pageIds = pageContents.map((_, index) => objectStartId + index * 2 + 1);
  const pagesRootId = objectStartId + pageContents.length * 2;
  const catalogId = pagesRootId + 1;
  const objects: Uint8Array[] = [];

  function setObject(id: number, body: string | Uint8Array) {
    objects[id - 1] = typeof body === "string" ? toAsciiBytes(body) : body;
  }

  setObject(1, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  setObject(2, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  if (logo) {
    setObject(3, makeStreamObject(
      "<< /Type /XObject /Subtype /Image /Width " + logo.width + " /Height " + logo.height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + logo.bytes.length + " >>",
      logo.bytes
    ));
  }

  for (let index = 0; index < pageContents.length; index += 1) {
    const content = toAsciiBytes(pageContents[index].join("\n") + "\n");
    const contentId = contentIds[index];
    const pageId = pageIds[index];
    setObject(contentId, makeStreamObject("<< /Length " + content.length + " >>", content));

    const xObjectResource = logo ? "/XObject << /Im1 3 0 R >>" : "";
    setObject(pageId,
      "<< /Type /Page /Parent " + pagesRootId + " 0 R /MediaBox [0 0 " +
      PAGE_WIDTH + " " + PAGE_HEIGHT + "] /Resources << /Font << /F1 1 0 R /F2 2 0 R >> " +
      xObjectResource + " >> /Contents " + contentId + " 0 R >>"
    );
  }

  setObject(pagesRootId, "<< /Type /Pages /Kids [" + pageIds.map((id) => id + " 0 R").join(" ") +
    "] /Count " + pageIds.length + " >>");
  setObject(catalogId, "<< /Type /Catalog /Pages " + pagesRootId + " 0 R >>");

  const header = toAsciiBytes("%PDF-1.4\n%SP360\n");
  const pieces: Uint8Array[] = [header];
  const offsets = new Array(objects.length + 1).fill(0);
  let position = header.length;

  for (let id = 1; id <= objects.length; id += 1) {
    offsets[id] = position;
    const prefix = toAsciiBytes(id + " 0 obj\n");
    const suffix = toAsciiBytes("\nendobj\n");
    pieces.push(prefix, objects[id - 1], suffix);
    position += prefix.length + objects[id - 1].length + suffix.length;
  }

  const xrefOffset = position;
  let xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let id = 1; id <= objects.length; id += 1) {
    xref += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalogId +
    " 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n";
  pieces.push(toAsciiBytes(xref + trailer));
  return concatBytes(pieces);
}

class PdfReportComposer {
  private pages: PdfPage[] = [];
  private current!: PdfPage;
  private readonly building: BuildingSettings;
  private readonly period: ReportPeriod;
  private readonly logo: PdfLogo | null;

  constructor(building: BuildingSettings, period: ReportPeriod, logo: PdfLogo | null) {
    this.building = building;
    this.period = period;
    this.logo = logo;
    this.newPage(true);
  }

  getPageCommands() {
    this.addFooters();
    return this.pages.map((page) => page.commands);
  }

  private addPageHeader(page: PdfPage, firstPage: boolean) {
    const title = REPORT_PERIOD_LABELS[this.period] + " Visitor Report";
    const range = getReportRangeLabel(this.period);
    if (firstPage) {
      if (this.logo) {
        const width = Math.min(68, 68 * this.logo.width / Math.max(this.logo.width, this.logo.height));
        const height = Math.min(68, 68 * this.logo.height / Math.max(this.logo.width, this.logo.height));
        page.commands.push("q " + pdfNumber(width) + " 0 0 " + pdfNumber(height) + " " +
          PAGE_LEFT + " " + pdfNumber(PAGE_HEIGHT - 24 - height) + " cm /Im1 Do Q");
      } else {
        page.commands.push(rectCommand(PAGE_LEFT, 25, 60, 60, "0.07 0.27 0.23", "0.07 0.27 0.23"));
        page.commands.push(textCommand("SP", PAGE_LEFT + 15, 42, 24, true, "1 1 1"));
      }

      const titleX = 112;
      page.commands.push(textCommand("SMARTPASS360 | VISITOR ACCESS INTELLIGENCE", titleX, 24, 9, true, "0.10 0.40 0.33"));
      page.commands.push(textCommand(this.building.name, titleX, 41, 20, true, "0.08 0.16 0.23"));
      page.commands.push(textCommand(title + " | Reporting period: " + range, titleX, 68, 9.5, true, "0.20 0.28 0.35"));
      const address = [this.building.address, this.building.city, this.building.country].filter(Boolean).join(", ");
      page.commands.push(textCommand(address || this.building.code || "Building report", titleX, 84, 8.5, false, "0.35 0.41 0.46"));
      page.commands.push(textCommand("Generated: " + formatReportDateTime(new Date()) + " EAT", titleX, 97, 8, false, "0.35 0.41 0.46"));
      page.commands.push(lineCommand(PAGE_LEFT, 108, PAGE_RIGHT, "0.10 0.42 0.34", 2.2));
      page.y = 120;
    } else {
      if (this.logo) {
        const width = Math.min(32, 32 * this.logo.width / Math.max(this.logo.width, this.logo.height));
        const height = Math.min(32, 32 * this.logo.height / Math.max(this.logo.width, this.logo.height));
        page.commands.push("q " + pdfNumber(width) + " 0 0 " + pdfNumber(height) + " " +
          PAGE_LEFT + " " + pdfNumber(PAGE_HEIGHT - 17 - height) + " cm /Im1 Do Q");
      } else {
        page.commands.push(rectCommand(PAGE_LEFT, 17, 30, 30, "0.07 0.27 0.23", "0.07 0.27 0.23"));
        page.commands.push(textCommand("SP", PAGE_LEFT + 6, 24, 12, true, "1 1 1"));
      }
      page.commands.push(textCommand(this.building.name, 72, 18, 12, true, "0.08 0.16 0.23"));
      page.commands.push(textCommand(title + " | " + range, 72, 35, 8.5, false, "0.30 0.37 0.43"));
      page.commands.push(lineCommand(PAGE_LEFT, 55, PAGE_RIGHT, "0.10 0.42 0.34", 1.5));
      page.y = 67;
    }
  }

  private newPage(firstPage = false) {
    this.current = { commands: [], y: 0 };
    this.pages.push(this.current);
    this.addPageHeader(this.current, firstPage);
  }

  private ensureSpace(height: number) {
    if (this.current.y + height > CONTENT_BOTTOM) this.newPage(false);
  }

  private drawSectionTitle(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 34 : 24);
    this.current.commands.push(textCommand(title, PAGE_LEFT, this.current.y, 13, true, "0.07 0.25 0.22"));
    this.current.y += 19;
    if (subtitle) {
      this.current.commands.push(textCommand(subtitle, PAGE_LEFT, this.current.y, 7.6, false, "0.36 0.42 0.47"));
      this.current.y += 13;
    }
  }

  drawKpis(visits: VisitorReportVisit[], organizationsVisited: number, entered: number, exited: number) {
    const gap = 10;
    const width = (PAGE_RIGHT - PAGE_LEFT - gap * 3) / 4;
    const top = this.current.y;
    const values = [
      ["VISITS REGISTERED", String(visits.length)],
      ["ORGANIZATIONS VISITED", String(organizationsVisited)],
      ["ENTRY RECORDS", String(entered)],
      ["EXIT RECORDS", String(exited)]
    ];

    values.forEach(([label, value], index) => {
      const x = PAGE_LEFT + index * (width + gap);
      this.current.commands.push(rectCommand(x, top, width, 48, "0.96 0.98 0.97", "0.84 0.89 0.89"));
      this.current.commands.push(textCommand(label, x + 9, top + 7, 7, true, "0.35 0.43 0.47"));
      this.current.commands.push(textCommand(value, x + 9, top + 21, 19, true, "0.08 0.31 0.26"));
    });
    this.current.y += 60;
  }

  drawTable(sectionTitle: string, columns: PdfColumn[], rows: PdfTableRow[], subtitle?: string) {
    this.drawSectionTitle(sectionTitle, subtitle);
    const drawHeader = () => {
      const top = this.current.y;
      const headerHeight = 27;
      let x = PAGE_LEFT;
      columns.forEach((column) => {
        this.current.commands.push(rectCommand(x, top, column.width, headerHeight, "0.08 0.25 0.22", "0.08 0.25 0.22"));
        const lines = wrapText(column.title, Math.max(7, Math.floor((column.width - 10) / 4.5)), 2);
        lines.forEach((line, index) => {
          this.current.commands.push(textCommand(line, x + 5, top + 6 + index * 8, 7.2, true, "1 1 1"));
        });
        x += column.width;
      });
      this.current.y += headerHeight;
    };

    this.ensureSpace(35);
    drawHeader();

    rows.forEach((row, index) => {
      const fontSize = columns.length >= 8 ? 6.3 : 7.4;
      const maxLinesPerCell = columns.length >= 8 ? 3 : 4;
      const cellLines = columns.map((column, columnIndex) =>
        wrapText(row.cells[columnIndex] ?? "", Math.max(5, Math.floor((column.width - 10) / (fontSize * 0.52))), maxLinesPerCell)
      );
      const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
      const rowHeight = Math.max(22, maxLines * (fontSize + 2.1) + 7);

      if (this.current.y + rowHeight > CONTENT_BOTTOM) {
        this.newPage(false);
        drawHeader();
      }

      const top = this.current.y;
      let x = PAGE_LEFT;
      columns.forEach((column, columnIndex) => {
        const fill = row.total ? "0.88 0.95 0.91" : index % 2 === 0 ? "1 1 1" : "0.96 0.98 0.97";
        this.current.commands.push(rectCommand(x, top, column.width, rowHeight, fill, "0.84 0.88 0.89"));
        const lines = cellLines[columnIndex].slice(0, maxLinesPerCell);
        const textWidth = lines.reduce((max, line) => Math.max(max, line.length), 0);
        const unusedWidth = Math.max(0, Math.floor((column.width - 10) / (fontSize * 0.52)) - textWidth);
        const align = column.align ?? "left";
        const textX = align === "right"
          ? x + column.width - 5 - (textWidth * fontSize * 0.5)
          : align === "center"
            ? x + column.width / 2 - (textWidth * fontSize * 0.25)
            : x + 5;
        void unusedWidth;
        lines.forEach((line, lineIndex) => {
          this.current.commands.push(textCommand(line, textX, top + 4 + lineIndex * (fontSize + 2.1), fontSize, Boolean(row.total), row.total ? "0.08 0.30 0.25" : "0.10 0.16 0.20"));
        });
        x += column.width;
      });
      this.current.y += rowHeight;
    });
    this.current.y += 10;
  }

  private addFooters() {
    const totalPages = this.pages.length;
    this.pages.forEach((page, index) => {
      page.commands.push(lineCommand(PAGE_LEFT, FOOTER_TOP, PAGE_RIGHT, "0.80 0.86 0.86", 0.7));
      page.commands.push(textCommand("Confidential | For authorized building management use", PAGE_LEFT, FOOTER_TOP + 8, 7.3, false, "0.38 0.45 0.45"));
      page.commands.push(textCommand("SmartPass360 by SmartCycle360", 548, FOOTER_TOP + 8, 7.8, true, "0.10 0.42 0.34"));
      page.commands.push(textCommand("Page " + (index + 1) + " of " + totalPages, 756, FOOTER_TOP + 8, 7.3, false, "0.38 0.45 0.45"));
    });
  }
}

function safeFilename(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "building";
}

export async function getAllReportOrganizations() {
  const organizations: ReportOrganization[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await apiRequest<OrganizationResponse>(
      "/organizations?page=" + page + "&pageSize=100"
    );
    organizations.push(...(response.data ?? []));
    totalPages = response.meta?.totalPages ?? (response.data?.length === 100 ? page + 1 : page);
    page += 1;
  } while (page <= totalPages);

  return organizations;
}

export async function exportVisitorReportPdf(period: ReportPeriod) {
  const [daily, weekly, monthly, buildingResponse, organizations] = await Promise.all([
    apiRequest<ReportResponse>("/visitors/report?period=today"),
    apiRequest<ReportResponse>("/visitors/report?period=week"),
    apiRequest<ReportResponse>("/visitors/report?period=month"),
    getCurrentBuilding(),
    getAllReportOrganizations()
  ]);

  const visitsByPeriod: VisitsByPeriod = {
    today: daily.data ?? [],
    week: weekly.data ?? [],
    month: monthly.data ?? []
  };
  const visits = visitsByPeriod[period];
  const building = buildingResponse.data;

  if (!building?.id || !building.name) {
    throw new Error("Building details could not be loaded. Check building settings and retry.");
  }

  const allPeriodVisits = [...visitsByPeriod.today, ...visitsByPeriod.week, ...visitsByPeriod.month, ...visits];
  const organizationList = summarizeVisitorReport(organizations, allPeriodVisits).map((item) => item.organization);
  const selectedSummary = summarizeVisitorReport(organizationList, visits);
  const dailySummary = new Map(summarizeVisitorReport(organizationList, visitsByPeriod.today).map((item) => [item.organization.id, item.visitors] as const));
  const weeklySummary = new Map(summarizeVisitorReport(organizationList, visitsByPeriod.week).map((item) => [item.organization.id, item.visitors] as const));
  const monthlySummary = new Map(summarizeVisitorReport(organizationList, visitsByPeriod.month).map((item) => [item.organization.id, item.visitors] as const));
  const entered = visits.filter((visit) => Boolean(visit.checkedInAt)).length;
  const exited = visits.filter((visit) => Boolean(visit.checkedOutAt)).length;
  const logo = await loadLogoAsJpeg(building.logoUrl);
  const composer = new PdfReportComposer(building, period, logo);

  composer.drawKpis(visits, selectedSummary.filter((item) => item.visitors > 0).length, entered, exited);

  const visitPeriodRows: PdfTableRow[] = selectedSummary.map((item) => ({
    cells: [
      item.organization.name,
      String(dailySummary.get(item.organization.id) ?? 0),
      String(weeklySummary.get(item.organization.id) ?? 0),
      String(monthlySummary.get(item.organization.id) ?? 0)
    ]
  }));
  visitPeriodRows.push({
    total: true,
    cells: ["TOTAL VISITS", String(visitsByPeriod.today.length), String(visitsByPeriod.week.length), String(visitsByPeriod.month.length)]
  });
  composer.drawTable("Organization Visits by Period", [
    { title: "Organization", width: 360 },
    { title: "Today", width: 140, align: "center" },
    { title: "This week", width: 140, align: "center" },
    { title: "This month", width: 142, align: "center" }
  ], visitPeriodRows, "Counts are based on visitor registrations for this building. The detailed register below uses the selected period.");

  const selectedRows: PdfTableRow[] = selectedSummary.map((item) => ({
    cells: [
      item.organization.name,
      String(item.visitors),
      String(item.entered),
      String(item.exited),
      String(item.pending),
      String(item.rejected)
    ]
  }));
  selectedRows.push({
    total: true,
    cells: [
      "TOTAL",
      String(visits.length),
      String(entered),
      String(exited),
      String(visits.filter((visit) => visit.status === "PENDING_APPROVAL").length),
      String(visits.filter((visit) => ["REJECTED", "DENIED"].includes(visit.status)).length)
    ]
  });
  composer.drawTable("Selected Period Organization Breakdown", [
    { title: "Organization", width: 342 },
    { title: "Registered", width: 88, align: "center" },
    { title: "Entered", width: 86, align: "center" },
    { title: "Exited", width: 86, align: "center" },
    { title: "Pending", width: 88, align: "center" },
    { title: "Rejected / denied", width: 92, align: "center" }
  ], selectedRows);

  const visitorRows: PdfTableRow[] = visits.map((visit, index) => ({
    cells: [
      String(index + 1),
      visit.fullName + " / " + (visit.phone || "—"),
      visit.organization?.name || "—",
      visit.purpose || "—",
      formatReportDateTime(visit.registeredAt),
      statusLabel(visit.status),
      formatReportDateTime(visit.checkedInAt),
      formatReportDateTime(visit.checkedOutAt),
      visit.pass?.passNumber || "—"
    ]
  }));
  composer.drawTable("Visitor Register", [
    { title: "No.", width: 25, align: "center" },
    { title: "Visitor / phone", width: 105 },
    { title: "Organization", width: 105 },
    { title: "Purpose", width: 100 },
    { title: "Registered (EAT)", width: 105 },
    { title: "Status", width: 72 },
    { title: "Entry (EAT)", width: 90 },
    { title: "Exit (EAT)", width: 90 },
    { title: "Pass no.", width: 80 }
  ], visitorRows.length ? visitorRows : [{ cells: ["—", "No registrations", "—", "No visitor registrations were recorded during this period.", "—", "—", "—", "—", "—"] }]);

  const pdfBytes = buildPdfBytes(composer.getPageCommands(), logo);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "smartpass360-" + safeFilename(building.name) + "-" +
    period + "-visitor-report-" + dateKeyInDarEsSalaam(new Date()) + ".pdf";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
