export type MobileVisitorTicket = {
  passNumber: string;
  qrValue: string;
  fullName: string;
  organizationName: string;
  siteName: string;
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose?: string | null;
  issuedAt: string;
  validUntil: string;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Imeshindikana kuandaa QR ya tiketi."));
    image.src = source;
  });
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines = 2
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > width && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines < maxLines) {
    while (line.length > 1 && ctx.measureText(`${line}…`).width > width) line = line.slice(0, -1);
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function displayDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function downloadMobileVisitorTicketImage(ticket: MobileVisitorTicket, qrImageDataUrl: string) {
  const qrImage = await loadImage(qrImageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1430;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kifaa hiki hakiwezi kutengeneza picha ya tiketi.");

  ctx.fillStyle = "#edf3fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(35, 35, 930, 1360, 42);
  ctx.fill();

  const gradient = ctx.createLinearGradient(35, 35, 965, 300);
  gradient.addColorStop(0, "#06365b");
  gradient.addColorStop(.55, "#116da3");
  gradient.addColorStop(1, "#5748b6");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(35, 35, 930, 260, 42);
  ctx.fill();
  ctx.fillRect(35, 225, 930, 70);

  ctx.textAlign = "center";
  ctx.fillStyle = "#8fe6ff";
  ctx.font = "bold 28px Arial, sans-serif";
  ctx.fillText("SMARTPASS360", 500, 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px Arial, sans-serif";
  ctx.fillText("VISITOR ACCESS PASS", 500, 165);
  ctx.fillStyle = "#d9ecff";
  ctx.font = "24px Arial, sans-serif";
  ctx.fillText(ticket.siteName.slice(0, 48), 500, 215);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("VISITOR", 500, 350);
  ctx.fillStyle = "#102039";
  ctx.font = "bold 42px Arial, sans-serif";
  let y = drawWrapped(ctx, ticket.fullName, 500, 405, 820, 48, 2);

  ctx.fillStyle = "#33455e";
  ctx.font = "25px Arial, sans-serif";
  y = drawWrapped(ctx, ticket.organizationName, 500, y + 4, 800, 31, 2) + 16;

  const detail = (label: string, value?: string | null) => {
    if (!value?.trim() || y > 650) return;
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 17px Arial, sans-serif";
    ctx.fillText(label.toUpperCase(), 500, y);
    y += 24;
    ctx.fillStyle = "#253750";
    ctx.font = "22px Arial, sans-serif";
    y = drawWrapped(ctx, value, 500, y, 790, 28, 2) + 9;
  };

  detail("Department / Office", ticket.departmentOrOffice);
  detail("Host", ticket.hostName);
  detail("Purpose", ticket.purpose);

  const qrSize = 310;
  const qrY = Math.max(y + 2, 680);
  const qrX = (canvas.width - qrSize) / 2;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#dbe4f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 22);
  ctx.fill();
  ctx.stroke();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const detailsY = qrY + qrSize + 55;
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillText("PASS NUMBER", 500, detailsY);
  ctx.fillStyle = "#102039";
  ctx.font = "bold 29px Arial, sans-serif";
  ctx.fillText(ticket.passNumber, 500, detailsY + 40);
  ctx.strokeStyle = "#dbe4f0";
  ctx.beginPath();
  ctx.moveTo(90, detailsY + 70);
  ctx.lineTo(910, detailsY + 70);
  ctx.stroke();
  ctx.fillStyle = "#64748b";
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText(`Imetolewa: ${displayDate(ticket.issuedAt)}`, 500, detailsY + 108);
  ctx.fillText(`Inaisha: ${displayDate(ticket.validUntil)}`, 500, detailsY + 141);
  ctx.font = "17px Arial, sans-serif";
  ctx.fillText("Tiketi ya kawaida ni halali kwa saa 24 tangu kutolewa.", 500, detailsY + 180);
  ctx.fillText("Onyesha QR kwenye lango wakati wa kuingia na kutoka.", 500, detailsY + 211);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Imeshindikana kuhifadhi picha ya tiketi.")), "image/png");
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `smartpass360-${ticket.passNumber.replace(/[^A-Za-z0-9_-]/g, "")}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}
