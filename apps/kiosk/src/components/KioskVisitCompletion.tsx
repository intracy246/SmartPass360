import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getKioskVisitStatus, issueKioskPass } from "../api/kiosk-api";
import type { KioskRegistrationResult } from "../types/kiosk";
import { IssuedVisitorTicket } from "./IssuedVisitorTicket";

export function KioskVisitCompletion({ registration, onFinish, language }: { registration: KioskRegistrationResult["data"]; onFinish: () => void; language: "en" | "sw" }) {
  const text = language === "sw" ? {
    closed: "Ziara imefungwa",
    passReady: "Pasi yako ya mgeni iko tayari",
    approved: "Ziara imeidhinishwa",
    wait: "Tafadhali subiri idhini ya mapokezi",
    reference: "Namba ya rejea ya mgeni",
    review: "Mapokezi/Ulinzi watakagua ziara yako. Pasi yako ya kuingia itachapishwa baada ya kuidhinishwa.",
    printed: "Pasi yako imechapishwa na Mapokezi/Ulinzi. Tafadhali chukua kadi yako mapokezi. Skrini itarudi mwanzo baada ya sekunde 5.",
    returning: "Tafadhali chukua kadi yako mapokezi. Skrini itarudi mwanzo baada ya sekunde 5.",
    retry: "Jaribu tena",
    registerAnother: "Sajili mgeni mwingine",
    finish: "Maliza sasa",
    status: "Hali"
  } : {
    closed: "Visit closed",
    passReady: "Your visitor pass is ready",
    approved: "Visit approved",
    wait: "Please wait for reception approval",
    reference: "Visitor reference",
    review: "Reception/Security will review your visit. Your access pass will print after approval.",
    printed: "Your pass has been printed by Reception/Security. Please collect your card at reception. Returning to the registration screen in 5 seconds.",
    returning: "Please collect your card at reception. Returning to the registration screen in 5 seconds.",
    retry: "Retry",
    registerAnother: "Register another visitor",
    finish: "Finish now",
    status: "Status"
  };
  const status = useQuery({
    queryKey: ["kiosk-visit", registration.visitId],
    queryFn: () => getKioskVisitStatus(registration.visitId, registration.receiptToken),
    refetchInterval: query => ["CHECKED_OUT", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(query.state.data?.data.status ?? "") ? false : 3000,
    retry: 1
  });
  const pass = useQuery({
    queryKey: ["kiosk-visit-pass", registration.visitId],
    queryFn: () => issueKioskPass(registration.visitId, registration.receiptToken),
    enabled: status.data?.data.status === "APPROVED",
    staleTime: Infinity, retry: false
  });
  const state = status.data?.data.status;

  useEffect(() => {
    if (!pass.data && state !== "PASS_ISSUED") return;
    const timer = window.setTimeout(() => onFinish(), 5000);
    return () => window.clearTimeout(timer);
  }, [pass.data, state, onFinish]);

  const closed = ["CHECKED_OUT", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(state ?? "");
  return <main className="kiosk-screen"><section className="kiosk-complete">
    <h1>{closed ? text.closed : pass.data ? text.passReady : state === "PASS_ISSUED" ? text.approved : text.wait}</h1>
    <p>{text.reference}: <strong>{registration.referenceNumber}</strong></p>
    {!pass.data && !closed && state !== "PASS_ISSUED" && <p>{text.review}</p>}
    {!pass.data && state === "PASS_ISSUED" && <p>{text.printed}</p>}
    {state && <p>{text.status}: {state.replaceAll("_", " ")}</p>}
    {(status.error || (pass.error && state !== "PASS_ISSUED")) && <p role="alert">{(status.error || pass.error)?.message} <button type="button" onClick={() => { void status.refetch(); if (pass.isError && state === "APPROVED") void pass.refetch(); }}>{text.retry}</button></p>}
    {pass.data && !closed && <><IssuedVisitorTicket pass={pass.data.data} /><p>{text.returning}</p></>}
    {(pass.data || closed || state === "PASS_ISSUED") && <button className="kiosk-secondary-button" type="button" onClick={onFinish}>{closed ? text.registerAnother : text.finish}</button>}
  </section></main>;
}
