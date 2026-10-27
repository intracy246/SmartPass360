import { useEffect } from "react";
import type { KioskRegistrationResult } from "../types/kiosk";
import "./KioskVisitCompletion.css";

export function KioskVisitCompletion({
  registration,
  onFinish,
  language
}: {
  registration: KioskRegistrationResult["data"];
  onFinish: () => void;
  language: "en" | "sw";
}) {
  const text = language === "sw" ? {
    eyebrow: "USAJILI UMEPOKELEWA",
    title: "Asante kwa kujisajili",
    reference: "Namba ya rejea",
    instruction: "Tafadhali chukua Visitor Access Pass yako iliyochapishwa kwa Mpokezi au kwa Mlinzi.",
    returnPass: "Rudisha tiketi hii kwa Mlinzi baada ya kutoka kwenye jengo.",
    reset: "Skrini itajisafisha yenyewe baada ya sekunde 5 ili mgeni anayefuata aweze kujisajili.",
    countdown: "Inarudi kwenye fomu baada ya sekunde 5..."
  } : {
    eyebrow: "REGISTRATION RECEIVED",
    title: "Thank you for registering",
    reference: "Visitor reference",
    instruction: "Please collect your printed Visitor Access Pass from Reception or Security.",
    returnPass: "Return this pass to Security when you exit the building.",
    reset: "This screen will reset automatically in 5 seconds for the next visitor.",
    countdown: "Returning to registration in 5 seconds..."
  };

  useEffect(() => {
    const timer = window.setTimeout(onFinish, 5000);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  return (
    <main className="kiosk-screen">
      <section className="kiosk-complete kiosk-complete--pickup" role="status" aria-live="polite">
        <div className="kiosk-complete__icon" aria-hidden="true">✓</div>
        <p className="kiosk-complete__eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <div className="kiosk-reference">
          <span>{text.reference}</span>
          <strong>{registration.referenceNumber}</strong>
        </div>
        <div className="kiosk-pickup-instructions">
          <p>{text.instruction}</p>
          <p><strong>{text.returnPass}</strong></p>
        </div>
        <p className="kiosk-complete__description">{text.reset}</p>
        <div className="kiosk-reset-countdown" aria-hidden="true">
          <span />
        </div>
        <small className="kiosk-complete__countdown-label">{text.countdown}</small>
        <footer className="kiosk-complete__footer">SMARTPASS360 by SmartCycle360</footer>
      </section>
    </main>
  );
}
