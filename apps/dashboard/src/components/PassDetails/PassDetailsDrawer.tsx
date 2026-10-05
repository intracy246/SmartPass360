import { useEffect } from "react";

import type { VisitorPass } from "../../types/pass";

import { GlassButton } from "../Buttons/GlassButton";
import { PassStatusBadge } from "../Status/PassStatusBadge";

import "./PassDetailsDrawer.css";

type PassDetailsDrawerProps = {
  pass: VisitorPass | null;
  onClose: () => void;
};

function formatDateTime(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatValue(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      return (
        part.charAt(0).toUpperCase() +
        part.slice(1)
      );
    })
    .join(" ");
}

export function PassDetailsDrawer({
  pass,
  onClose
}: PassDetailsDrawerProps) {
  useEffect(() => {
    if (!pass) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow = "";
    };
  }, [pass, onClose]);

  if (!pass) {
    return null;
  }

  return (
    <div
      className="pass-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`Pass details for ${pass.passNumber}`}
    >
      <button
        type="button"
        className="pass-drawer__backdrop"
        aria-label="Close pass details"
        onClick={onClose}
      />

      <aside className="pass-drawer__panel">
        <header className="pass-drawer__header">
          <div>
            <span className="pass-drawer__eyebrow">
              Visitor Credential
            </span>

            <h2>{pass.passNumber}</h2>
          </div>

          <button
            type="button"
            className="pass-drawer__close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            ×
          </button>
        </header>

        <div className="pass-drawer__status-row">
          <PassStatusBadge status={pass.status} />

          <span className="pass-drawer__source">
            {formatValue(pass.source)}
          </span>
        </div>

        <section className="pass-drawer__visitor">
          <div className="pass-drawer__photo">
            {pass.visitorPhotoUrl ? (
              <img
                src={pass.visitorPhotoUrl}
                alt={pass.visitorName}
              />
            ) : (
              <span>
                {pass.visitorName
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "V"}
              </span>
            )}
          </div>

          <div>
            <span>{formatValue(pass.visitorType)}</span>
            <h3>{pass.visitorName}</h3>
            <p>{pass.company || "No organization recorded"}</p>
          </div>
        </section>

        <section className="pass-drawer__qr-section">
          <div className="pass-drawer__qr">
            <div className="pass-drawer__qr-grid">
              {Array.from({ length: 49 }).map(
                (_, index) => (
                  <span key={index} />
                )
              )}
            </div>

            <small>Secure QR token from API</small>
          </div>

          <div className="pass-drawer__qr-info">
            <span>Pass number</span>
            <strong>{pass.passNumber}</strong>

            <p>
              Scan this credential at an authorized
              SmartPass360 turnstile.
            </p>
          </div>
        </section>

        <section className="pass-drawer__details">
          <div>
            <span>Host</span>
            <strong>
              {pass.hostName || "No host assigned"}
            </strong>
          </div>

          <div>
            <span>Department</span>
            <strong>
              {pass.departmentName ||
                "No department assigned"}
            </strong>
          </div>

          <div className="pass-drawer__wide">
            <span>Purpose</span>
            <strong>{pass.purpose}</strong>
          </div>

          <div>
            <span>Valid from</span>
            <strong>
              {formatDateTime(pass.validFrom)}
            </strong>
          </div>

          <div>
            <span>Valid until</span>
            <strong>
              {formatDateTime(pass.validUntil)}
            </strong>
          </div>

          <div>
            <span>Entered at</span>
            <strong>
              {formatDateTime(pass.enteredAt)}
            </strong>
          </div>

          <div>
            <span>Exited at</span>
            <strong>
              {formatDateTime(pass.exitedAt)}
            </strong>
          </div>

          <div className="pass-drawer__wide">
            <span>Issued at</span>
            <strong>
              {formatDateTime(pass.issuedAt)}
            </strong>
          </div>
        </section>

        <section className="pass-drawer__notice">
          <strong>Backend-controlled actions</strong>

          <p>
            Printing, reprinting and revocation will only
            complete after their API endpoints return a
            successful response.
          </p>
        </section>

        <footer className="pass-drawer__actions">
          <GlassButton
            type="button"
            variant="secondary"
            disabled
          >
            Print Pass
          </GlassButton>

          <GlassButton
            type="button"
            variant="secondary"
            disabled
          >
            Reprint
          </GlassButton>

          <GlassButton
            type="button"
            variant="danger"
            disabled
          >
            Revoke Pass
          </GlassButton>
        </footer>
      </aside>
    </div>
  );
}