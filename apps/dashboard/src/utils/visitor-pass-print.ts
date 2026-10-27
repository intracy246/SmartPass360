import QRCode from "qrcode";

export type PrintableVisitorPass = {
  passNumber: string;
  qrValue: string;
  fullName: string;
  organizationName: string;
  departmentOrOffice?: string;
  hostName?: string;
  purpose?: string;
  issuedAt: string;
  validUntil: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function printVisitorPass(pass: PrintableVisitorPass, reservedWindow?: Window | null) {
  const printWindow = reservedWindow ?? window.open("", "_blank", "width=420,height=720");
  if (!printWindow) {
    throw new Error("Allow pop-ups to print the visitor pass.");
  }

  try {
    const qrImage = pass.qrValue.startsWith("data:image/")
      ? pass.qrValue
      : await QRCode.toDataURL(pass.qrValue, {
          width: 300,
          margin: 4,
          errorCorrectionLevel: "M"
        });

    const destination = [pass.departmentOrOffice, pass.hostName]
      .filter(Boolean)
      .join(" · ");

    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(pass.passNumber)}</title><style>
      body{font-family:Arial,sans-serif;margin:0;padding:24px;text-align:center;color:#101827}
      .ticket{max-width:340px;margin:0 auto}.meta{font-size:13px;color:#465268}
      img{width:260px;height:260px}.destination{margin:8px 0}
      .return-notice{margin-top:18px;padding-top:12px;border-top:1px dashed #94a3b8;font-size:12px;font-weight:800;line-height:1.5;color:#123d35}
      .return-notice span{display:block;margin-top:4px;font-size:11px;font-weight:600;color:#334155}
      .footer-brand{margin-top:12px;font-size:10px;letter-spacing:.5px;color:#64748b}
      @media print{@page{size:80mm auto;margin:4mm}body{padding:0}.ticket{max-width:72mm}.return-notice{break-inside:avoid}}
    </style></head><body><div class="ticket">
      <h2>SMARTPASS360</h2><strong>VISITOR ACCESS PASS</strong>
      <h3>${escapeHtml(pass.fullName)}</h3>
      <p>${escapeHtml(pass.organizationName)}</p>
      ${destination ? `<p class="destination">${escapeHtml(destination)}</p>` : ""}
      ${pass.purpose ? `<p class="meta">${escapeHtml(pass.purpose)}</p>` : ""}
      <p>Pass: <strong>${escapeHtml(pass.passNumber)}</strong></p>
      <img src="${escapeHtml(qrImage)}" alt="Visitor QR" />
      <p class="meta">Issued: ${escapeHtml(new Date(pass.issuedAt).toLocaleString())}</p>
      <p class="meta">Valid until: ${escapeHtml(new Date(pass.validUntil).toLocaleString())}</p>
    </div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
    printWindow.document.close();
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
