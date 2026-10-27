import { useEffect, useState } from "react";
import type { KioskRegistrationResult } from "../types/kiosk";
import "./KioskVisitCompletion.css";

const RESET_SECONDS = 5;

export function KioskVisitCompletion({
  registration,
  onFinish,
  language
}: {
  registration: KioskRegistrationResult["data"];
  onFinish: () => void;
  language: "en" | "sw";
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(RESET_SECONDS);

  const text = language === "sw" ? {
    eyebrow: "USAJILI UMEPOKELEWA",
    title: "Asante kwa kujisajili",
    reference: "Namba ya rejea",
    instruction: "Usajili wako umepokelewa. Tafadhali subiri idhini ya Mapokezi au Mlinzi. Ukishaidhinishwa, chukua Visitor Access Pass yako iliyochapishwa kwa Mapokezi au kwa Mlinzi.",
    returnPass: "Rudisha tiketi hii kwa Mlinzi mara tu unapotoka kwenye jengo.",
    reset: "Skrini itajisafisha yenyewe baada ya sekunde 5 ili mgeni anayefuata aweze kujisajili.",
    countdown: (seconds: number) => seconds > 0 ? `Inarudi kwenye fomu baada ya sekunde ${seconds}...` : "Inarudi kwenye fomu..."
  } : {
    eyebrow: "REGISTRATION RECEIVED",
    title: "Thank you for registering",
    reference: "Visitor reference",
    instruction: "Your registration has been received. Please wait for approval from Reception or Security. Once approved, collect your printed Visitor Access Pass from Reception or Security.",
    returnPass: "Return this pass to Security as soon as you exit the building.",
    reset: "This screen will reset automatically in 5 seconds for the next visitor.",
    countdown: (seconds: number) => seconds > 0 ? `Returning to registration in ${seconds} second${seconds === 1 ? "" : "s"}...` : "Returning to registration..."
  };

  useEffect(() => {
    setSecondsRemaining(RESET_SECONDS);
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    const timeout = window.setTimeout(onFinish, RESET_SECONDS * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onFinish, registration.visitId]);

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
        <small className="kiosk-complete__countdown-label">{text.countdown(secondsRemaining)}</small>
        <footer className="kiosk-complete__footer">SMARTPASS360 by SmartCycle360</footer>
      </section>
    </main>
  );
}
