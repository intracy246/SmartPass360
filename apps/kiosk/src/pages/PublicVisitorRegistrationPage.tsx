import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";

import { ApiError } from "../api/api-client";
import {
  getPublicRegistrationConfig,
  getPublicRegistrationStatus,
  registerPublicVisitor
} from "../api/kiosk-api";
import type {
  PublicVisitorRegistrationPayload,
  PublicVisitorRegistrationResult,
  VisitorIdentificationType
} from "../types/kiosk";

import "./PublicVisitorRegistrationPage.css";

type Language = "sw" | "en";

type FormState = {
  organizationId: string;
  fullName: string;
  phoneNumber: string;
  identificationType: VisitorIdentificationType;
  identificationNumber: string;
  companyName: string;
  vehicleRegistrationNumber: string;
  departmentOrOffice: string;
  hostName: string;
  purposeOfVisit: string;
};

type SavedRegistration = PublicVisitorRegistrationResult["data"];

const initialForm: FormState = {
  organizationId: "",
  fullName: "",
  phoneNumber: "",
  identificationType: "NONE",
  identificationNumber: "",
  companyName: "",
  vehicleRegistrationNumber: "",
  departmentOrOffice: "",
  hostName: "",
  purposeOfVisit: ""
};

const copy = {
  sw: {
    tagline: "USALAMA WA WAGENI",
    title: "Jisajili kwa ziara yako",
    intro: "Jaza taarifa zako. Usajili wako utatumwa kwa Afisa Usalama au Mapokezi ili ukaguliwe.",
    organization: "Shirika",
    chooseOrganization: "Chagua shirika unalotembelea",
    selectOrganization: "Chagua shirika",
    visitorDetails: "Taarifa za mgeni",
    fullName: "Jina kamili",
    phone: "Namba ya simu",
    identification: "Aina ya kitambulisho",
    none: "Sina kitambulisho",
    nationalId: "Kitambulisho cha Taifa",
    passport: "Pasipoti",
    drivingLicence: "Leseni ya udereva",
    voterId: "Kitambulisho cha mpiga kura",
    otherId: "Kingine",
    idNumber: "Namba ya kitambulisho",
    company: "Kampuni (si lazima)",
    vehicle: "Namba ya gari (si lazima)",
    destination: "Taarifa za ziara",
    department: "Idara / Ofisi",
    host: "Mtu unayemtembelea",
    purpose: "Sababu ya ziara",
    submit: "Tuma usajili",
    submitting: "Inatuma usajili...",
    reset: "Futa fomu",
    required: "Sehemu hii inahitajika.",
    invalidName: "Weka jina kamili lenye angalau herufi 3.",
    invalidPhone: "Weka namba sahihi ya simu.",
    invalidId: "Weka namba ya kitambulisho.",
    submitted: "Usajili umetumwa",
    reference: "Namba ya kumbukumbu",
    waiting: "Unasubiri idhini ya Afisa Usalama au Mapokezi.",
    waitingHelp: "Acha ukurasa huu wazi. Tiketi ya QR itaonekana baada ya idhini.",
    rejected: "Usajili haujaidhinishwa. Tafadhali wasiliana na Mapokezi au Usalama.",
    issued: "Tiketi yako iko tayari",
    issuedHelp: "Onyesha QR hii kwenye lango kwa ajili ya kuscan. Tiketi ni halali hadi muda ulioonyeshwa.",
    passNumber: "Namba ya tiketi",
    validUntil: "Halali hadi",
    print: "Chapisha / Hifadhi tiketi",
    newRegistration: "Sajili mgeni mwingine",
    statusRetry: "Hatuwezi kupata hali ya usajili kwa sasa. Tutaendelea kujaribu.",
    invalidKiosk: "QR hii ya kiosk si halali, au kiosk haipokei usajili kwa sasa.",
    loading: "Inapakia taarifa za kiosk...",
    help: "Unahitaji msaada? Tafadhali wasiliana na Mapokezi.",
    power: "Inaendeshwa na SmartPass360",
    changeLanguage: "English"
  },
  en: {
    tagline: "VISITOR ACCESS SECURITY",
    title: "Register your visit",
    intro: "Enter your details. Your registration will be sent to Security or Reception for review.",
    organization: "Organization",
    chooseOrganization: "Choose the organization you are visiting",
    selectOrganization: "Select organization",
    visitorDetails: "Visitor details",
    fullName: "Full name",
    phone: "Phone number",
    identification: "Identification type",
    none: "No identification",
    nationalId: "National ID",
    passport: "Passport",
    drivingLicence: "Driving licence",
    voterId: "Voter ID",
    otherId: "Other",
    idNumber: "Identification number",
    company: "Company (optional)",
    vehicle: "Vehicle registration (optional)",
    destination: "Visit details",
    department: "Department / office",
    host: "Person you are visiting",
    purpose: "Purpose of visit",
    submit: "Submit registration",
    submitting: "Submitting registration...",
    reset: "Clear form",
    required: "This field is required.",
    invalidName: "Enter a full name of at least 3 characters.",
    invalidPhone: "Enter a valid phone number.",
    invalidId: "Enter the identification number.",
    submitted: "Registration submitted",
    reference: "Reference number",
    waiting: "Waiting for Security or Reception approval.",
    waitingHelp: "Keep this page open. Your QR ticket will appear after approval.",
    rejected: "Your registration was not approved. Please contact Reception or Security.",
    issued: "Your visitor ticket is ready",
    issuedHelp: "Show this QR code at the gate to be scanned. The ticket is valid until the time shown.",
    passNumber: "Ticket number",
    validUntil: "Valid until",
    print: "Print / save ticket",
    newRegistration: "Register another visitor",
    statusRetry: "We cannot retrieve your registration status right now. We will keep trying.",
    invalidKiosk: "This kiosk QR is invalid, or the kiosk is not accepting registrations right now.",
    loading: "Loading kiosk information...",
    help: "Need assistance? Please contact Reception.",
    power: "Powered by SmartPass360",
    changeLanguage: "Kiswahili"
  }
} as const;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function registrationStorageKey(kioskId: string) {
  return `smartpass360.mobile-registration.${kioskId}`;
}

function getSavedRegistration(kioskId: string): SavedRegistration | null {
  if (!kioskId || !isUuid(kioskId)) return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(registrationStorageKey(kioskId)) ?? "null");
    return saved?.kioskId === kioskId && saved?.visitId && saved?.receiptToken ? saved as SavedRegistration : null;
  } catch {
    return null;
  }
}

function displayDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function PublicVisitorRegistrationPage() {
  const kioskId = useMemo(() => new URLSearchParams(window.location.search).get("kioskId") ?? "", []);
  const [language, setLanguage] = useState<Language>("sw");
  const t = copy[language];
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<SavedRegistration | null>(() => getSavedRegistration(kioskId));
  const [issuedQrImage, setIssuedQrImage] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["public-kiosk-registration-config", kioskId],
    queryFn: () => getPublicRegistrationConfig(kioskId),
    enabled: isUuid(kioskId),
    retry: 1,
    staleTime: 60_000
  });

  const statusQuery = useQuery({
    queryKey: ["public-visitor-registration-status", registration?.visitId],
    queryFn: () => getPublicRegistrationStatus({
      kioskId: registration!.kioskId,
      visitId: registration!.visitId,
      receiptToken: registration!.receiptToken
    }),
    enabled: Boolean(registration),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.data.status;
      return status === "PASS_ISSUED" || status === "REJECTED" ? false : 4000;
    }
  });

  const registrationMutation = useMutation({
    mutationFn: registerPublicVisitor,
    onSuccess(response) {
      window.sessionStorage.setItem(
        registrationStorageKey(kioskId),
        JSON.stringify(response.data)
      );
      setRegistration(response.data);
      setForm(initialForm);
      setFormError(null);
    },
    onError(error) {
      setFormError(error instanceof ApiError ? error.message : "Registration could not be submitted. Please try again.");
    }
  });

  const config = configQuery.data?.data;
  const organizations = (config?.organizations ?? []).filter((organization) => organization.isActive);
  const status = statusQuery.data?.data;
  const isRejected = status?.status === "REJECTED";
  const isIssued = status?.status === "PASS_ISSUED" && Boolean(status.qrValue && status.pass);
  const showConfirmation = Boolean(registration);

  useEffect(() => {
    let active = true;
    const qrValue = status?.qrValue;
    if (!qrValue || !isIssued) {
      setIssuedQrImage(null);
      return () => { active = false; };
    }

    void QRCode.toDataURL(qrValue, { width: 320, margin: 3, errorCorrectionLevel: "M" })
      .then((dataUrl) => { if (active) setIssuedQrImage(dataUrl); })
      .catch(() => { if (active) setIssuedQrImage(null); });

    return () => { active = false; };
  }, [status?.qrValue, isIssued]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.organizationId) {
      setFormError(t.required);
      return;
    }
    if (form.fullName.trim().length < 3) {
      setFormError(t.invalidName);
      return;
    }
    if (form.phoneNumber.trim().length < 7) {
      setFormError(t.invalidPhone);
      return;
    }
    if (form.identificationType !== "NONE" && !form.identificationNumber.trim()) {
      setFormError(t.invalidId);
      return;
    }

    const payload: PublicVisitorRegistrationPayload = {
      kioskId,
      organizationId: form.organizationId,
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      identificationType: form.identificationType,
      identificationNumber: form.identificationType === "NONE" ? undefined : form.identificationNumber.trim(),
      companyName: form.companyName.trim() || undefined,
      vehicleRegistrationNumber: form.vehicleRegistrationNumber.trim() || undefined,
      departmentOrOffice: form.departmentOrOffice.trim() || undefined,
      hostName: form.hostName.trim() || undefined,
      purposeOfVisit: form.purposeOfVisit.trim() || undefined
    };
    registrationMutation.mutate(payload);
  }

  function startAnotherRegistration() {
    window.sessionStorage.removeItem(registrationStorageKey(kioskId));
    setRegistration(null);
    setIssuedQrImage(null);
    setForm(initialForm);
    setFormError(null);
  }

  function printTicket() {
    window.print();
  }

  if (!isUuid(kioskId)) {
    return (
      <main className="mobile-registration">
        <section className="mobile-registration__card mobile-registration__message">
          <div className="mobile-registration__mark">SP</div>
          <h1>{t.invalidKiosk}</h1>
          <p>{t.help}</p>
        </section>
      </main>
    );
  }

  if (configQuery.isPending || !config) {
    return (
      <main className="mobile-registration">
        <section className="mobile-registration__card mobile-registration__message">
          <div className="mobile-registration__mark">SP</div>
          <h1>{configQuery.isError ? t.invalidKiosk : t.loading}</h1>
          {configQuery.isError && <button type="button" onClick={() => void configQuery.refetch()}>{language === "sw" ? "Jaribu tena" : "Retry"}</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-registration">
      <div className="mobile-registration__container">
        <header className="mobile-registration__header">
          <div className="mobile-registration__brand">
            <div className="mobile-registration__mark">
              {config.site.logoUrl
                ? <img src={config.site.logoUrl} alt={config.site.name} />
                : "SP"}
            </div>
            <div>
              <strong>SMARTPASS360</strong>
              <span>{config.site.name}</span>
              <small>{config.kiosk.name}{config.kiosk.location ? ` · ${config.kiosk.location}` : ""}</small>
            </div>
          </div>
          <button className="mobile-registration__language" type="button" onClick={() => setLanguage((current) => current === "sw" ? "en" : "sw")}>{t.changeLanguage}</button>
        </header>

        {!showConfirmation ? (
          <>
            <section className="mobile-registration__intro">
              <p className="mobile-registration__eyebrow">{t.tagline}</p>
              <h1>{t.title}</h1>
              <p>{t.intro}</p>
            </section>

            {formError && <div className="mobile-registration__alert" role="alert">{formError}</div>}

            <form className="mobile-registration__form" onSubmit={handleSubmit}>
              <section className="mobile-registration__section">
                <div className="mobile-registration__section-heading">
                  <span>01</span>
                  <div>
                    <h2>{t.visitorDetails}</h2>
                    <p>{t.chooseOrganization}</p>
                  </div>
                </div>

                <label className="mobile-registration__field">
                  <span>{t.organization} *</span>
                  <select value={form.organizationId} onChange={(event) => updateField("organizationId", event.target.value)} required>
                    <option value="">{t.selectOrganization}</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>{organization.name}</option>
                    ))}
                  </select>
                </label>

                <label className="mobile-registration__field">
                  <span>{t.fullName} *</span>
                  <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} autoComplete="name" minLength={3} maxLength={200} required />
                </label>

                <label className="mobile-registration__field">
                  <span>{t.phone} *</span>
                  <input type="tel" value={form.phoneNumber} onChange={(event) => updateField("phoneNumber", event.target.value)} autoComplete="tel" minLength={7} maxLength={40} placeholder="+255..." required />
                </label>

                <label className="mobile-registration__field">
                  <span>{t.identification}</span>
                  <select value={form.identificationType} onChange={(event) => updateField("identificationType", event.target.value as VisitorIdentificationType)}>
                    <option value="NONE">{t.none}</option>
                    <option value="NATIONAL_ID">{t.nationalId}</option>
                    <option value="PASSPORT">{t.passport}</option>
                    <option value="DRIVING_LICENCE">{t.drivingLicence}</option>
                    <option value="VOTER_ID">{t.voterId}</option>
                    <option value="OTHER">{t.otherId}</option>
                  </select>
                </label>

                <label className="mobile-registration__field">
                  <span>{t.idNumber}{form.identificationType === "NONE" ? "" : " *"}</span>
                  <input value={form.identificationNumber} onChange={(event) => updateField("identificationNumber", event.target.value)} maxLength={200} disabled={form.identificationType === "NONE"} required={form.identificationType !== "NONE"} />
                </label>

                <div className="mobile-registration__grid">
                  <label className="mobile-registration__field">
                    <span>{t.company}</span>
                    <input value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} maxLength={200} />
                  </label>
                  <label className="mobile-registration__field">
                    <span>{t.vehicle}</span>
                    <input value={form.vehicleRegistrationNumber} onChange={(event) => updateField("vehicleRegistrationNumber", event.target.value)} maxLength={80} placeholder="T 123 ABC" />
                  </label>
                </div>
              </section>

              <section className="mobile-registration__section">
                <div className="mobile-registration__section-heading">
                  <span>02</span>
                  <div>
                    <h2>{t.destination}</h2>
                    <p>{language === "sw" ? "Eleza unakoenda na sababu ya ziara." : "Tell us where you are going and why."}</p>
                  </div>
                </div>

                <label className="mobile-registration__field">
                  <span>{t.department}</span>
                  <input value={form.departmentOrOffice} onChange={(event) => updateField("departmentOrOffice", event.target.value)} maxLength={200} />
                </label>
                <label className="mobile-registration__field">
                  <span>{t.host}</span>
                  <input value={form.hostName} onChange={(event) => updateField("hostName", event.target.value)} maxLength={200} />
                </label>
                <label className="mobile-registration__field">
                  <span>{t.purpose}</span>
                  <textarea value={form.purposeOfVisit} onChange={(event) => updateField("purposeOfVisit", event.target.value)} maxLength={1000} rows={3} />
                </label>
              </section>

              <div className="mobile-registration__actions">
                <button type="button" className="mobile-registration__secondary" onClick={() => { setForm(initialForm); setFormError(null); }}>{t.reset}</button>
                <button type="submit" disabled={registrationMutation.isPending || configQuery.isError}>
                  {registrationMutation.isPending ? t.submitting : t.submit}
                </button>
              </div>
              <p className="mobile-registration__privacy">{t.help}</p>
            </form>
          </>
        ) : (
          <section className="mobile-registration__confirmation">
            <div className={`mobile-registration__state-icon ${isRejected ? "is-rejected" : isIssued ? "is-issued" : "is-pending"}`}>
              {isRejected ? "!" : isIssued ? "✓" : "…"}
            </div>
            <p className="mobile-registration__eyebrow">{t.submitted}</p>
            <h1>{isRejected ? (language === "sw" ? "Tafadhali wasiliana na Usalama" : "Please contact Security") : isIssued ? t.issued : t.waiting}</h1>
            <p className="mobile-registration__reference">{t.reference}: <strong>{registration.referenceNumber}</strong></p>

            {statusQuery.isError && !isRejected && !isIssued && (
              <div className="mobile-registration__alert" role="status">{t.statusRetry}</div>
            )}

            {isRejected ? (
              <p className="mobile-registration__status-copy">{t.rejected}</p>
            ) : isIssued && status?.pass && status.visitor && status.qrValue ? (
              <div className="mobile-registration__ticket">
                <div className="mobile-registration__ticket-heading">
                  <span>SMARTPASS360</span>
                  <strong>VISITOR ACCESS PASS</strong>
                </div>
                {issuedQrImage ? <img className="mobile-registration__ticket-qr" src={issuedQrImage} alt="Visitor access pass QR code" /> : <p>{language === "sw" ? "Inatengeneza QR..." : "Generating secure QR..."}</p>}
                <h2>{status.visitor.fullName}</h2>
                <p>{status.visitor.organizationName} · {status.visitor.siteName}</p>
                {status.visitor.departmentOrOffice && <p>{status.visitor.departmentOrOffice}</p>}
                <div className="mobile-registration__ticket-number">
                  <span>{t.passNumber}</span>
                  <strong>{status.pass.passNumber}</strong>
                </div>
                <div className="mobile-registration__ticket-validity">
                  <span>{t.validUntil}</span>
                  <strong>{displayDate(status.pass.validUntil)}</strong>
                </div>
                <p className="mobile-registration__ticket-help">{t.issuedHelp}</p>
                <button type="button" onClick={printTicket}>{t.print}</button>
              </div>
            ) : (
              <div className="mobile-registration__pending-card">
                <span className="mobile-registration__pulse" />
                <strong>{t.waiting}</strong>
                <p>{t.waitingHelp}</p>
                <small>{language === "sw" ? "Ukaguzi wa hali unafanyika kiotomatiki." : "Status refreshes automatically."}</small>
              </div>
            )}

            {(isRejected || isIssued) && (
              <button className="mobile-registration__new" type="button" onClick={startAnotherRegistration}>{t.newRegistration}</button>
            )}
          </section>
        )}

        <footer className="mobile-registration__footer">{t.power}</footer>
      </div>
    </main>
  );
}
