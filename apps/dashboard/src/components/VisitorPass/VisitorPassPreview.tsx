import type { VisitorPassPreviewData } from "../../types/visitor";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import "./VisitorPassPreview.css";

type VisitorPassPreviewProps = {
  data: VisitorPassPreviewData;
  organizationName?: string;
  organizationSubtitle?: string;
};

function formatVisitorType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function formatDate(value?: string) {
  if (!value) {
    return "Not scheduled";
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getInitials(fullName: string) {
  const names = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (names.length === 0) {
    return "VP";
  }

  return names
    .map((name) => name.charAt(0).toUpperCase())
    .join("");
}

export function VisitorPassPreview({
  data,
  organizationName = "SMARTPASS360",
  organizationSubtitle = "Secure Visitor Access"
}: VisitorPassPreviewProps) {
  const [qrImage, setQrImage] = useState("");
  useEffect(() => {
    let active = true;
    if (data.qrValue) void QRCode.toDataURL(data.qrValue, { width: 240, margin: 4 })
      .then(image => { if (active) setQrImage(image); })
      .catch(() => { if (active) setQrImage(""); });
    return () => { active = false; };
  }, [data.qrValue]);
  const displayName =
    data.fullName.trim() || "Visitor name";

  const displayPurpose =
    data.purpose.trim() || "Visit purpose not entered";

  return (
    <section className="visitor-pass-preview">
      <div className="visitor-pass-preview__glow" />

      <header className="visitor-pass-preview__header">
        <div className="visitor-pass-preview__brand">
          <div className="visitor-pass-preview__brand-mark">
            SP
          </div>

          <div>
            <strong>{organizationName}</strong>
            <span>{organizationSubtitle}</span>
          </div>
        </div>

        <div className="visitor-pass-preview__pass-label">
          Visitor Pass
        </div>
      </header>

      <div className="visitor-pass-preview__identity">
        <div className="visitor-pass-preview__photo">
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt={displayName}
            />
          ) : (
            <span>{getInitials(displayName)}</span>
          )}
        </div>

        <div className="visitor-pass-preview__person">
          <span className="visitor-pass-preview__type">
            {formatVisitorType(data.visitorType)}
          </span>

          <h2>{displayName}</h2>

          <p>{data.company || "No organization entered"}</p>
        </div>
      </div>

      <div className="visitor-pass-preview__details">
        <div>
          <span>Host</span>
          <strong>{data.hostName || "Pending selection"}</strong>
        </div>

        <div>
          <span>Department</span>
          <strong>
            {data.departmentName || "Pending selection"}
          </strong>
        </div>

        <div className="visitor-pass-preview__detail-wide">
          <span>Purpose</span>
          <strong>{displayPurpose}</strong>
        </div>

        <div>
          <span>Visit date</span>
          <strong>{formatDate(data.scheduledDate)}</strong>
        </div>

        <div>
          <span>Valid time</span>
          <strong>
            {data.expectedEntryTime || "--:--"}
            {" – "}
            {data.expectedExitTime || "--:--"}
          </strong>
        </div>
      </div>

      <div className="visitor-pass-preview__code-section">
        <div className="visitor-pass-preview__qr">
          {data.qrValue && qrImage ? (
            <img src={qrImage} alt="Visitor access QR" style={{ width: "100%", height: "auto" }} />
          ) : (
            <>
              <small>{data.qrValue ? "Preparing secure QR" : "QR issued only after approval"}</small>
            </>
          )}
        </div>

        <div className="visitor-pass-preview__pass-number">
          <span>Pass number</span>
          <strong>
            {data.passNumber || "Generated after approval"}
          </strong>

          <div
            className={[
              "visitor-pass-preview__status",
              `visitor-pass-preview__status--${data.status.toLowerCase()}`
            ].join(" ")}
          >
            <span />
            {data.status}
          </div>
        </div>
      </div>

      <footer className="visitor-pass-preview__footer">
        <span>
          Scan this pass at the authorized turnstile.
        </span>

        <strong>SMARTPASS360</strong>
      </footer>
    </section>
  );
}
