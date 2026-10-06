import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { KioskIssuedPass } from "../types/kiosk";
import "./IssuedVisitorTicket.css";

export function IssuedVisitorTicket({ pass }: { pass: KioskIssuedPass }) {
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");
  const printed = useRef(false);
  const autoPrintEnabled = import.meta.env.VITE_KIOSK_AUTO_PRINT !== "false";
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(pass.qrValue, { width: 300, margin: 4, errorCorrectionLevel: "M" })
      .then(image => { if (active) setQrImage(image); })
      .catch(() => { if (active) setError("QR generation failed. Reload to retry."); });
    return () => { active = false; };
  }, [pass.qrValue]);
  useEffect(() => {
    if (!autoPrintEnabled || !qrImage || printed.current) return;
    let active = true;
    const images = [...document.querySelectorAll<HTMLImageElement>(".visitor-ticket img")];
    void Promise.all(images.map(img => img.decode().catch(() => undefined))).then(() => {
      if (!active || printed.current) return;
      printed.current = true;
      window.print();
    });
    return () => { active = false; };
  }, [autoPrintEnabled, qrImage]);
  return <>
    <article className="visitor-ticket" aria-label="Printable visitor pass">
      {pass.site.logoUrl && <img className="visitor-ticket__logo" src={pass.site.logoUrl} alt={pass.site.name} />}
      <h2>{pass.site.name}</h2><strong>VISITOR ACCESS PASS</strong>
      <h3>{pass.fullName}</h3><p>{pass.organization.name}</p>
      <p>Pass: <strong>{pass.passNumber}</strong></p>
      {qrImage && <img className="visitor-ticket__qr" src={qrImage} alt="Scannable visitor access QR" />}
      {error && <p role="alert">{error}</p>}
      <p>Issued: {new Date(pass.issuedAt).toLocaleString()}</p>
      <p>Valid until: {new Date(pass.validUntil).toLocaleString()}</p>
      {pass.departmentOrOffice && <p>Office: {pass.departmentOrOffice}</p>}
      {pass.hostName && <p>Visiting: {pass.hostName}</p>}
      {pass.purpose && <p>Purpose: {pass.purpose}</p>}
      <p>Scan at your authorized gate on entry and exit. This pass closes after exit.</p>
    </article>
    <button className="kiosk-primary-button" type="button" disabled={!qrImage} onClick={() => window.print()}>Print visitor pass</button>
  </>;
}
