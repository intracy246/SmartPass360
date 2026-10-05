import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getKioskVisitStatus, issueKioskPass } from "../api/kiosk-api";
import type { KioskRegistrationResult } from "../types/kiosk";
import { IssuedVisitorTicket } from "./IssuedVisitorTicket";

export function KioskVisitCompletion({ registration, onFinish }: { registration: KioskRegistrationResult["data"]; onFinish: () => void }) {
  const status = useQuery({
    queryKey: ["kiosk-visit", registration.visitId],
    queryFn: () => getKioskVisitStatus(registration.visitId, registration.receiptToken),
    refetchInterval: query => ["CHECKED_OUT", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(query.state.data?.data.status ?? "") ? false : 3000,
    retry: 1
  });
  const pass = useQuery({
    queryKey: ["kiosk-visit-pass", registration.visitId],
    queryFn: () => issueKioskPass(registration.visitId, registration.receiptToken),
    enabled: ["APPROVED", "PASS_ISSUED"].includes(status.data?.data.status ?? ""),
    staleTime: Infinity, retry: 1
  });
  const state = status.data?.data.status;

  useEffect(() => {
    if (!pass.data) return;
    const timer = window.setTimeout(() => onFinish(), 5000);
    return () => window.clearTimeout(timer);
  }, [pass.data, onFinish]);

  const closed = ["CHECKED_OUT", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(state ?? "");
  return <main className="kiosk-screen"><section className="kiosk-complete">
    <h1>{closed ? "Visit closed" : pass.data ? "Your visitor pass is ready" : "Please wait for reception approval"}</h1>
    <p>Visitor reference: <strong>{registration.referenceNumber}</strong></p>
    {!pass.data && !closed && <p>Reception/Security will review your visit. Your access pass will print after approval.</p>}
    {state && <p>Status: {state.replaceAll("_", " ")}</p>}
    {(status.error || pass.error) && <p role="alert">{(status.error || pass.error)?.message} <button type="button" onClick={() => { void status.refetch(); if (pass.isError) void pass.refetch(); }}>Retry</button></p>}
    {pass.data && !closed && <><IssuedVisitorTicket pass={pass.data.data} /><p>Returning to the registration screen in 5 seconds…</p></>}
    {(pass.data || closed) && <button className="kiosk-secondary-button" type="button" onClick={onFinish}>{closed ? "Register another visitor" : "I have my ticket — finish"}</button>}
  </section></main>;
}
