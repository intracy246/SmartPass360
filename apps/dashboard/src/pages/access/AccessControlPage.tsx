import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";

import {
  useMutation,
  useQuery
} from "@tanstack/react-query";

import {
  getAccessEvents,
  getVisitorGates,
  scanPermanentPass,
  validateAccess
} from "../../api/access-api";
import { VisitorQueue } from "../../components/VisitorQueue/VisitorQueue";

import { ApiError } from "../../api/api-client";

import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";

import type {
  AccessDirection,
  AccessValidationResult,
  PermanentPassScanResult
} from "../../types/access";

import "./AccessControlPage.css";

function formatDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
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

export function AccessControlPage() {
  const [credential, setCredential] = useState("");
  const [gateId, setGateId] = useState("");
  const [direction, setDirection] =
    useState<AccessDirection | "AUTO">("AUTO");
  const gatesQuery = useQuery({ queryKey: ["visitor-gates"], queryFn: getVisitorGates });

  const [validationResult, setValidationResult] =
    useState<AccessValidationResult | null>(null);

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const permanentGateId =
    "d16badd9-4aad-4f61-ae83-efc977b80b75";

  const [permanentCredential, setPermanentCredential] =
    useState("");

  const [permanentResult, setPermanentResult] =
    useState<PermanentPassScanResult | null>(null);

  const [permanentError, setPermanentError] =
    useState<string | null>(null);

  const permanentScannerRef =
    useRef<HTMLInputElement | null>(null);

  const accessEventsQuery = useQuery({
    queryKey: ["access-events"],
    queryFn: () => getAccessEvents(1, 20),
    refetchInterval: 3000
  });

  const validationMutation = useMutation({
    mutationFn: validateAccess,

    onSuccess(response) {
      setValidationResult(response);
      setValidationError(null);

      void accessEventsQuery.refetch();
    },

    onError(error) {
      setValidationResult(null);

      if (error instanceof ApiError) {
        setValidationError(error.message);
        return;
      }

      setValidationError(
        "Access validation service is unavailable."
      );
    }
  });

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedCredential = credential.trim();

    if (!cleanedCredential) {
      setValidationError(
        "Scan or enter a visitor pass credential."
      );
      return;
    }

    setValidationError(null);
    setValidationResult(null);

    validationMutation.mutate({
      credential: cleanedCredential,
      gateId,
      direction: direction === "AUTO" ? undefined : direction,
      requestId: crypto.randomUUID()
    });
  }

  const permanentScanMutation = useMutation({
    mutationFn: scanPermanentPass,

    onSuccess(response) {
      setPermanentResult(response);
      setPermanentError(null);
      setPermanentCredential("");

      void accessEventsQuery.refetch();

      window.setTimeout(() => {
        permanentScannerRef.current?.focus();
      }, 50);
    },

    onError(error) {
      setPermanentResult(null);
      setPermanentCredential("");

      if (error instanceof ApiError) {
        setPermanentError(error.message);
      } else {
        setPermanentError(
          "Permanent pass validation service is unavailable."
        );
      }

      window.setTimeout(() => {
        permanentScannerRef.current?.focus();
      }, 50);
    }
  });

  useEffect(() => {
    permanentScannerRef.current?.focus();
  }, []);

  function handlePermanentScan(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const qrCode = permanentCredential.trim();

    if (!qrCode) {
      setPermanentError(
        "Scan a permanent pass QR credential."
      );

      permanentScannerRef.current?.focus();
      return;
    }

    setPermanentError(null);
    setPermanentResult(null);

    permanentScanMutation.mutate({
      qrCode,
      gateId: permanentGateId
    });
  }

  const events =
    accessEventsQuery.data?.data ?? [];

  return (
    <div className="access-page">
      <header className="access-page__header">
        <div>
          <p className="access-page__eyebrow">
            Physical Access Security
          </p>

          <h1>Access Control</h1>

          <p>
            Validate visitor credentials, enforce
            anti-passback and review real gate events.
          </p>
        </div>

        <div className="access-page__live">
          <span />
          Turnstile validation surface
        </div>
      </header>

      <VisitorQueue />

      <section className="permanent-gate-scanner">
        <div className="permanent-gate-scanner__header">
          <div>
            <span>LIVE GATE TERMINAL</span>
            <h2>Permanent Pass Scanner</h2>
            <p>
              Main Gate · Scan a permanent QR credential.
              Entry and exit are determined automatically.
            </p>
          </div>

          <div className="permanent-gate-scanner__status">
            <span />
            SCANNER READY
          </div>
        </div>

        <div className="permanent-gate-scanner__grid">
          <form
            className="permanent-gate-scanner__form"
            onSubmit={handlePermanentScan}
          >
            <label>
              <span>Scan QR</span>

              <input
                ref={permanentScannerRef}
                type="password"
                value={permanentCredential}
                autoComplete="off"
                placeholder="Scanner waiting for credential..."
                onChange={(event) =>
                  setPermanentCredential(
                    event.target.value
                  )
                }
              />
            </label>

            <button
              type="submit"
              disabled={permanentScanMutation.isPending}
            >
              {permanentScanMutation.isPending
                ? "VERIFYING..."
                : "SCAN / VERIFY"}
            </button>

            <small>
              QR credentials are masked and are not displayed
              on the gate screen.
            </small>
          </form>

          <div
            className={[
              "permanent-gate-decision",
              permanentResult?.decision === "GRANTED"
                ? "permanent-gate-decision--granted"
                : permanentResult?.decision === "DENIED" ||
                    permanentError
                  ? "permanent-gate-decision--denied"
                  : "permanent-gate-decision--idle"
            ].join(" ")}
          >
            {!permanentResult && !permanentError && (
              <>
                <div className="permanent-gate-decision__icon">
                  ◇
                </div>

                <span>GATE STATUS</span>
                <h2>READY</h2>

                <p>
                  Present a permanent SmartPass360 QR.
                </p>
              </>
            )}

            {permanentError && (
              <>
                <div className="permanent-gate-decision__icon">
                  ×
                </div>

                <span>ACCESS DECISION</span>
                <h2>DENIED</h2>

                <p>{permanentError}</p>

                <strong>KEEP LOCKED</strong>
              </>
            )}

            {permanentResult && (
              <>
                <div className="permanent-gate-decision__icon">
                  {permanentResult.decision === "GRANTED"
                    ? "✓"
                    : "×"}
                </div>

                <span>ACCESS DECISION</span>

                <h2>{permanentResult.decision}</h2>

                <div className="permanent-gate-decision__person">
                  <strong>
                    {permanentResult.holder?.fullName ||
                      "Unknown holder"}
                  </strong>

                  <span>
                    {permanentResult.holder?.passNumber ||
                      "Pass unavailable"}
                  </span>
                </div>

                <div className="permanent-gate-decision__details">
                  <div>
                    <span>Activity</span>
                    <strong>
                      {permanentResult.activityType || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Gate</span>
                    <strong>
                      {permanentResult.gate?.name ||
                        "Main Gate"}
                    </strong>
                  </div>

                  <div>
                    <span>Turnstile</span>
                    <strong>
                      {permanentResult.turnstileCommand}
                    </strong>
                  </div>

                  <div>
                    <span>Reason</span>
                    <strong>
                      {permanentResult.denialReason
                        ? formatValue(
                            permanentResult.denialReason
                          )
                        : "Credential accepted"}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="access-page__workspace">
        <GlassCard
          title="Credential validation"
          subtitle="The credential is submitted directly to the SMARTPASS360 API."
          accent="blue"
        >
          <form
            className="access-validation"
            onSubmit={handleSubmit}
          >
            <label className="access-field">
              <span>Pass credential</span>

              <input
                type="password"
                value={credential}
                placeholder="Scan QR or enter pass token"
                autoFocus
                onChange={(event) =>
                  setCredential(event.target.value)
                }
              />
            </label>

            <div className="access-validation__row">
              <label className="access-field">
                <span>Direction</span>

                <select
                  value={direction}
                  onChange={(event) =>
                    setDirection(
                      event.target.value as AccessDirection | "AUTO"
                    )
                  }
                >
                  <option value="AUTO">Automatic entry / exit</option>
                  <option value="ENTRY">
                    Entry
                  </option>

                  <option value="EXIT">
                    Exit
                  </option>
                </select>
              </label>

              <label className="access-field">
                <span>Visitor gate</span>

                <select
                  value={gateId}
                  required
                  onChange={(event) =>
                    setGateId(event.target.value)
                  }
                >
                  <option value="">Select gate</option>
                  {gatesQuery.data?.data.map(gate => <option key={gate.id} value={gate.id} disabled={!gate.isActive || gate.status !== "ONLINE"}>{gate.name} · {gate.direction}</option>)}
                </select>
                {gatesQuery.error && <span role="alert">{gatesQuery.error.message}</span>}
              </label>
            </div>

            <div className="access-validation__actions">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setCredential("");
                  setGateId("");
                  setValidationResult(null);
                  setValidationError(null);
                }}
              >
                Clear
              </GlassButton>

              <GlassButton
                type="submit"
                disabled={validationMutation.isPending}
              >
                {validationMutation.isPending
                  ? "Validating..."
                  : "Validate Pass"}
              </GlassButton>
            </div>
          </form>
        </GlassCard>

        <GlassCard
          title="Gate decision"
          subtitle="The turnstile should open only after a GRANTED response."
          accent={
            validationResult?.data.decision === "GRANTED"
              ? "green"
              : "violet"
          }
        >
          {!validationResult && !validationError && (
            <div className="access-decision access-decision--idle">
              <div className="access-decision__symbol">
                â—‡
              </div>

              <strong>Awaiting credential</strong>

              <p>
                Scan a visitor ticket to request a live
                access decision.
              </p>
            </div>
          )}

          {validationError && (
            <div className="access-decision access-decision--error">
              <div className="access-decision__symbol">
                !
              </div>

              <strong>Validation unavailable</strong>

              <p>{validationError}</p>
            </div>
          )}

          {validationResult && (
            <div
              className={[
                "access-result",
                validationResult.data.decision ===
                "GRANTED"
                  ? "access-result--granted"
                  : "access-result--denied"
              ].join(" ")}
            >
              <div className="access-result__decision">
                <div className="access-result__icon">
                  {validationResult.data.decision ===
                  "GRANTED"
                    ? "âœ“"
                    : "Ã—"}
                </div>

                <div>
                  <span>Access decision</span>

                  <h2>
                    {validationResult.data.decision}
                  </h2>
                  <strong>{validationResult.data.turnstileCommand}</strong>

                  <p>
                    {validationResult.data.message}
                  </p>
                </div>
              </div>

              <div className="access-result__details">
                <div>
                  <span>Visitor</span>
                  <strong>
                    {validationResult.data.visitorName ||
                      "Not returned"}
                  </strong>
                </div>

                <div>
                  <span>Pass</span>
                  <strong>
                    {validationResult.data.passNumber ||
                      "Not returned"}
                  </strong>
                </div>

                <div>
                  <span>Direction</span>
                  <strong>
                    {validationResult.data.direction}
                  </strong>
                </div>

                <div>
                  <span>Reason</span>
                  <strong>
                    {formatValue(
                      validationResult.data.reason
                    )}
                  </strong>
                </div>

                <div>
                  <span>Gate</span>
                  <strong>
                    {validationResult.data.gateName ||
                      "Not assigned"}
                  </strong>
                </div>

                <div>
                  <span>Time</span>
                  <strong>
                    {formatDateTime(
                      validationResult.data.timestamp
                    )}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </section>

      <GlassCard
        title="Recent access events"
        subtitle="Live entry and exit events from the access API."
        accent="cyan"
      >
        {accessEventsQuery.isPending && (
          <div className="access-events-state">
            <div className="access-events-state__loader" />
            <strong>Loading access events</strong>
          </div>
        )}

        {accessEventsQuery.isError && (
          <div className="access-events-state">
            <div className="access-events-state__symbol">
              !
            </div>

            <strong>
              Access event service unavailable
            </strong>

            <p>
              No sample access events are being displayed.
            </p>
          </div>
        )}

        {accessEventsQuery.isSuccess &&
          events.length === 0 && (
            <div className="access-events-state">
              <div className="access-events-state__symbol">
                âŒ
              </div>

              <strong>No access events</strong>

              <p>
                Entry and exit scans will appear here after
                the API records them.
              </p>
            </div>
          )}

        {accessEventsQuery.isSuccess &&
          events.length > 0 && (
            <div className="access-events-table-wrapper">
              <table className="access-events-table">
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Pass</th>
                    <th>Gate</th>
                    <th>Direction</th>
                    <th>Decision</th>
                    <th>Reason</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>
                        {event.visitorName ||
                          "Unknown visitor"}
                      </td>

                      <td>
                        {event.passNumber || "â€”"}
                      </td>

                      <td>
                        {event.gateName || "â€”"}
                      </td>

                      <td>
                        <span
                          className={[
                            "access-event-chip",
                            `access-event-chip--${event.direction.toLowerCase()}`
                          ].join(" ")}
                        >
                          {event.direction}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            "access-event-chip",
                            `access-event-chip--${event.decision.toLowerCase()}`
                          ].join(" ")}
                        >
                          {event.decision}
                        </span>
                      </td>

                      <td>
                        {formatValue(event.reason)}
                      </td>

                      <td>
                        {formatDateTime(
                          event.occurredAt
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </GlassCard>
    </div>
  );
}


