import QRCode from "qrcode";

export type DownloadableVisitorPass = {
  passNumber: string;
  qrValue: string;
  fullName: string;
  organizationName: string;
  departmentOrOffice?: string | null;
  hostName?: string | null;
  purpose?: string | null;
  issuedAt: string;
  validUntil: string;
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The visitor QR image could not be prepared."));
    image.src = source;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return y;
  let line = "";
  let lines = 0;
  let currentY = y;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines - 1) break;
    } else {
      line = candidate;
    }
  }

  if (line && lines < maxLines) {
    let finalLine = line;
    if (context.measureText(finalLine).width > maxWidth) {
      while (finalLine.length > 1 && context.measureText(`${finalLine}…`).width > maxWidth) {
        finalLine = finalLine.slice(0, -1);
      }
      finalLine += "…";
    }
    context.fillText(finalLine, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function downloadVisitorPassImage(pass: DownloadableVisitorPass) {
  const qrSource = pass.qrValue.startsWith("data:image/")
    ? pass.qrValue
    : await QRCode.toDataURL(pass.qrValue, { width: 420, margin: 3, errorCorrectionLevel: "M" });
  const qrImage = await loadImage(qrSource);
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1480;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create the visitor ticket image.");

  // White ticket with a high-contrast QR suitable for phone galleries and print.
  context.fillStyle = "#eef3fb";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(36, 36, 928, 1408, 42);
  context.fill();

  const header = context.createLinearGradient(36, 36, 964, 300);
  header.addColorStop(0, "#07375e");
  header.addColorStop(0.55, "#126ea0");
  header.addColorStop(1, "#4c46b4");
  context.fillStyle = header;
  context.beginPath();
  context.roundRect(36, 36, 928, 270, 42);
  context.fill();
  context.fillRect(36, 230, 928, 76);

  context.textAlign = "center";
  context.fillStyle = "#8fe6ff";
  context.font = "bold 27px Arial, sans-serif";
  context.fillText("SMARTPASS360", 500, 100);
  context.fillStyle = "#ffffff";
  context.font = "bold 38px Arial, sans-serif";
  context.fillText("VISITOR ACCESS PASS", 500, 165);
  context.font = "24px Arial, sans-serif";
  context.fillStyle = "#d8ebff";
  context.fillText(pass.organizationName.slice(0, 52), 500, 220);

  context.fillStyle = "#64748b";
  context.font = "bold 20px Arial, sans-serif";
  context.fillText("VISITOR", 500, 356);
  context.fillStyle = "#102039";
  context.font = "bold 43px Arial, sans-serif";
  wrapText(context, pass.fullName || "Visitor", 500, 410, 820, 50, 2);

  let y = 520;
  const detail = (label: string, value?: string | null) => {
    if (!value?.trim()) return;
    context.fillStyle = "#64748b";
    context.font = "bold 18px Arial, sans-serif";
    context.fillText(label.toUpperCase(), 500, y);
    y += 30;
    context.fillStyle = "#24364f";
    context.font = "24px Arial, sans-serif";
    y = wrapText(context, value, 500, y, 790, 32, 2) + 14;
  };
  detail("Department / Office", pass.departmentOrOffice);
  detail("Host", pass.hostName);
  detail("Purpose", pass.purpose);

  const qrSize = 330;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = Math.max(y + 5, 725);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#dbe4f0";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24);
  context.fill();
  context.stroke();
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const passY = qrY + qrSize + 58;
  context.fillStyle = "#64748b";
  context.font = "bold 18px Arial, sans-serif";
  context.fillText("PASS NUMBER", 500, passY);
  context.fillStyle = "#102039";
  context.font = "bold 30px Arial, sans-serif";
  context.fillText(pass.passNumber, 500, passY + 42);

  context.strokeStyle = "#dbe4f0";
  context.beginPath();
  context.moveTo(90, passY + 76);
  context.lineTo(910, passY + 76);
  context.stroke();

  context.fillStyle = "#64748b";
  context.font = "20px Arial, sans-serif";
  context.fillText(`Issued: ${formatDate(pass.issuedAt)}`, 500, passY + 117);
  context.fillText(`Valid until: ${formatDate(pass.validUntil)}`, 500, passY + 151);
  context.fillStyle = "#64748b";
  context.font = "17px Arial, sans-serif";
  context.fillText("A non-permanent pass expires 24 hours after issue.", 500, passY + 196);
  context.fillText("Present this QR to Security at entry and exit.", 500, passY + 228);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The visitor ticket image could not be saved.")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `smartpass360-${pass.passNumber.replace(/[^A-Za-z0-9_-]/g, "")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
