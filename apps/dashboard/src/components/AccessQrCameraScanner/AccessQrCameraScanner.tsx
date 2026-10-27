import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

import type { AccessValidationResult, PermanentPassScanResult } from "../../types/access";
import "./AccessQrCameraScanner.css";

type ScannerGate = {
  id: string;
  name: string;
  direction: string;
  isActive: boolean;
  status: string;
};

type Props = {
  gates: ScannerGate[];
  selectedGateId: string;
  onGateChange: (gateId: string) => void;
  isValidating: boolean;
  result: AccessValidationResult | null;
  error: string | null;
  permanentResult?: PermanentPassScanResult | null;
  permanentError?: string | null;
  onCredentialRead: (credential: string) => void;
};

type ScannerControls = {
  stop: () => void;
};

export function AccessQrCameraScanner({
  gates,
  selectedGateId,
  onGateChange,
  isValidating,
  result,
  error,
  permanentResult = null,
  permanentError = null,
  onCredentialRead
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      scanHandledRef.current = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  async function startCamera() {
    if (!selectedGateId) {
      setCameraError("Select an active gate or checkpoint before scanning.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot open a camera. Use a current Safari or Chrome browser, or use the manual scanner below.");
      return;
    }

    if (!videoRef.current) {
      setCameraError("The camera preview is not ready. Try again.");
      return;
    }

    controlsRef.current?.stop();
    controlsRef.current = null;
    scanHandledRef.current = false;
    setCameraError(null);
    setCameraStatus("Opening the camera. Allow camera access when prompted.");
    setCameraActive(true);

    const reader = new BrowserQRCodeReader();

    try {
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (!result || scanHandledRef.current) return;

          const credential = result.getText().trim();
          if (!credential) return;

          scanHandledRef.current = true;
          controlsRef.current?.stop();
          setCameraActive(false);
          setCameraStatus("QR detected. Checking the ticket with the SmartPass360 API…");
          onCredentialRead(credential);
        }
      );

      controlsRef.current = controls;

      // A QR can be decoded before the camera-start promise resolves.
      if (scanHandledRef.current) {
        controls.stop();
      } else {
        setCameraStatus("Camera ready. Centre the visitor's approved ticket QR inside the frame.");
      }
    } catch (caught) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraActive(false);
      setCameraStatus(null);

      const name = caught instanceof Error ? caught.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera access was denied. Allow camera access for this site in your browser settings, then try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError("No usable camera was found on this device. Use the manual scanner below or connect a camera.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCameraError("The camera is already in use by another application. Close that application and try again.");
      } else {
        setCameraError(caught instanceof Error ? caught.message : "The camera could not start. Use the manual scanner below or try another browser.");
      }
    }
  }

  function stopCamera() {
    scanHandledRef.current = true;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
    setCameraStatus(null);
  }

  const decision = result?.data.decision;
  const hasActiveGate = gates.some((gate) => gate.id === selectedGateId && gate.isActive);

  return (
    <section className="access-qr-camera" aria-labelledby="access-qr-camera-title">
      <header className="access-qr-camera__header">
        <div>
          <span className="access-qr-camera__eyebrow">SOFTWARE GATE SCANNER</span>
          <h2 id="access-qr-camera-title">Scan an access ticket</h2>
          <p>Scan a 24-hour visitor QR or a permanent-pass QR. The server validates the credential for the selected gate and automatically determines entry or exit from the holder's recorded state.</p>
        </div>
        <span className="access-qr-camera__mode">NO HARDWARE REQUIRED</span>
      </header>

      <div className="access-qr-camera__setup">
        <label className="access-qr-camera__gate">
          <span>Building gate / checkpoint</span>
          <select
            value={selectedGateId}
            onChange={(event) => onGateChange(event.target.value)}
            disabled={cameraActive || isValidating}
          >
            <option value="">Select an active gate</option>
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id} disabled={!gate.isActive}>
                {gate.name} · {gate.direction} · {gate.status}
              </option>
            ))}
          </select>
          <small>Gates are limited to your signed-in building. Hardware status does not block software-only validation, but the gate itself must be active.</small>
        </label>

        <div className="access-qr-camera__camera-actions">
          {!cameraActive ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={!hasActiveGate || isValidating || gates.length === 0}
            >
              {isValidating ? "VALIDATING TICKET…" : "OPEN CAMERA & SCAN"}
            </button>
          ) : (
            <button type="button" className="access-qr-camera__stop" onClick={stopCamera}>
              STOP CAMERA
            </button>
          )}
        </div>
      </div>

      {gates.length === 0 && (
        <p className="access-qr-camera__notice" role="status">
          No gate is configured for this building yet. Create an active gate under Gate Setup first; you do not need to connect a turnstile.
        </p>
      )}

      {cameraError && <p className="access-qr-camera__error" role="alert">{cameraError}</p>}
      {cameraStatus && <p className="access-qr-camera__status" role="status">{cameraStatus}</p>}

      <div className={`access-qr-camera__preview ${cameraActive ? "is-active" : ""}`}>
        {cameraActive ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera view for visitor QR scanning" />
            <span className="access-qr-camera__aim" aria-hidden="true" />
            <span className="access-qr-camera__preview-hint">Align the QR within this frame</span>
          </>
        ) : (
          <div className="access-qr-camera__placeholder">
            <span aria-hidden="true">▦</span>
            <strong>Camera is off</strong>
            <p>Press “Open camera & scan” to start. Camera access is requested only when you press the button.</p>
          </div>
        )}
      </div>

      {error && <div className="access-qr-camera__error access-qr-camera__result" role="alert">{error}</div>}

      {result && (
        <div className={`access-qr-camera__decision ${decision === "GRANTED" ? "is-granted" : "is-denied"}`} role="status">
          <div className="access-qr-camera__decision-mark" aria-hidden="true">
            {decision === "GRANTED" ? "✓" : "×"}
          </div>
          <div className="access-qr-camera__decision-copy">
            <span>SERVER ACCESS DECISION · VISITOR</span>
            <h3>{decision === "GRANTED" ? "ACCESS GRANTED" : "ACCESS DENIED"}</h3>
            <p>{result.data.message}</p>
            {decision === "GRANTED" && result.data.turnstileCommand === "VALIDATED_ONLY" && (
              <p className="access-qr-camera__software-note">
                Validation and entry/exit logging succeeded. No physical turnstile has been actuated; a provisioned controller is needed for that.
              </p>
            )}
            <div className="access-qr-camera__meta">
              {result.data.visitorName && <span>Visitor: <strong>{result.data.visitorName}</strong></span>}
              {result.data.passNumber && <span>Ticket: <strong>{result.data.passNumber}</strong></span>}
              {result.data.gateName && <span>Gate: <strong>{result.data.gateName}</strong></span>}
              <span>Direction: <strong>{result.data.direction}</strong></span>
              <span>Decision: <strong>{result.data.turnstileCommand === "VALIDATED_ONLY" ? "Validated and logged" : result.data.turnstileCommand}</strong></span>
            </div>
          </div>
        </div>
      )}

      {permanentError && <div className="access-qr-camera__error access-qr-camera__result" role="alert">{permanentError}</div>}

      {permanentResult && (
        <div className={`access-qr-camera__decision ${permanentResult.decision === "GRANTED" ? "is-granted" : "is-denied"}`} role="status">
          <div className="access-qr-camera__decision-mark" aria-hidden="true">
            {permanentResult.decision === "GRANTED" ? "✓" : "×"}
          </div>
          <div className="access-qr-camera__decision-copy">
            <span>SERVER ACCESS DECISION · PERMANENT PASS</span>
            <h3>{permanentResult.decision === "GRANTED" ? "ACCESS GRANTED" : "ACCESS DENIED"}</h3>
            <p>{permanentResult.message ?? permanentResult.denialReason ?? "The scan has been processed."}</p>
            {permanentResult.decision === "GRANTED" && permanentResult.turnstileCommand === "VALIDATED_ONLY" && (
              <p className="access-qr-camera__software-note">
                Entry/exit is recorded in software. A physical controller is required before any turnstile can open.
              </p>
            )}
            <div className="access-qr-camera__meta">
              {permanentResult.holder?.fullName && <span>Holder: <strong>{permanentResult.holder.fullName}</strong></span>}
              {permanentResult.holder?.passNumber && <span>Pass: <strong>{permanentResult.holder.passNumber}</strong></span>}
              {permanentResult.gate?.name && <span>Gate: <strong>{permanentResult.gate.name}</strong></span>}
              {permanentResult.activityType && <span>Direction: <strong>{permanentResult.activityType}</strong></span>}
              <span>Decision: <strong>{permanentResult.turnstileCommand === "VALIDATED_ONLY" ? "Validated and logged" : permanentResult.turnstileCommand}</strong></span>
            </div>
          </div>
        </div>
      )}

      <p className="access-qr-camera__footnote">
        Only approved SmartPass360 visitor tickets are accepted. A successful scan is checked by the Ubuntu API against this building, the selected gate, ticket validity and anti-passback rules. A screenshot of a QR is not trusted on its own.
      </p>
    </section>
  );
}
