import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";

import {
  useMutation,
  useQuery
} from "@tanstack/react-query";

import {
  getRegisteredKioskConfig,
  registerVisitorFromKiosk
} from "../api/kiosk-api";

import { ApiError } from "../api/api-client";

import { KioskField } from "../components/KioskField";
import { KioskVisitCompletion } from "../components/KioskVisitCompletion";

import type {
  KioskRegistrationPayload,
  KioskRegistrationResult,
  VisitorIdentificationType
} from "../types/kiosk";

import "./KioskRegistrationPage.css";

type RegistrationForm = {
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

const initialForm: RegistrationForm = {
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

type KioskLanguage = "en" | "sw";

const copy = {
  en: {
    languageEnglish: "English",
    languageSwahili: "Kiswahili",
    welcome: "Welcome",
    registerVisit: "Register your visit",
    intro: "Enter your details below. Reception will review your registration and issue your visitor pass.",
    registrationNotCompleted: "Registration not completed",
    orgUnavailable: "{t.orgUnavailable}",
    retryConnection: "{t.retryConnection}",
    yourInformation: "Your information",
    yourInformationHelp: "Enter the visitor's identification details.",
    fullName: "Full name",
    fullNamePlaceholder: t.fullNamePlaceholder,
    phoneNumber: "Phone number",
    identificationType: "Identification type",
    noIdentification: "{t.noIdentification}",
    nationalId: "{t.nationalId}",
    passport: "{t.passport}",
    drivingLicence: "{t.drivingLicence}",
    voterId: "{t.voterId}",
    otherIdentification: "{t.otherIdentification}",
    identificationNumber: "Identification number",
    notRequired: t.notRequired,
    enterIdentificationNumber: t.enterIdentificationNumber,
    company: "Company",
    companyPlaceholder: t.companyPlaceholder,
    vehicleRegistration: "Vehicle registration",
    vehiclePlaceholder: t.vehiclePlaceholder,
    visitInformation: "Visit information",
    visitInformationHelp: "Tell reception who and where you are visiting.",
    organization: "Organization",
    loadingOrganizations: t.loadingOrganizations,
    selectOrganization: t.selectOrganization,
    departmentOffice: "Department or office",
    departmentPlaceholder: t.departmentPlaceholder,
    host: "Person you are visiting",
    hostPlaceholder: t.hostPlaceholder,
    purpose: "Purpose of visit",
    purposePlaceholder: t.purposePlaceholder,
    clearForm: "Clear Form",
    submitting: "Submitting...",
    submitRegistration: "Submit Registration",
    needAssistance: "Need assistance? Please contact reception.",
    poweredBy: "Powered by SmartPass360",
    selectOrganizationError: "Please select the organization you are visiting.",
    fullNameError: "Please enter your full name.",
    phoneError: "Please enter a valid phone number.",
    serviceError: "Registration service is unavailable. Please contact reception."
  },
  sw: {
    languageEnglish: "English",
    languageSwahili: "Kiswahili",
    welcome: "Karibu",
    registerVisit: "Jisajili kwa ziara yako",
    intro: "Jaza taarifa zako hapa chini. Mapokezi yatakagua usajili wako na kutoa pasi ya mgeni.",
    registrationNotCompleted: "Usajili haujakamilika",
    orgUnavailable: "Huduma ya mashirika haipatikani",
    retryConnection: "Jaribu tena",
    yourInformation: "Taarifa zako",
    yourInformationHelp: "Weka taarifa za utambulisho wa mgeni.",
    fullName: "Jina kamili",
    fullNamePlaceholder: "Weka jina lako kamili",
    phoneNumber: "Namba ya simu",
    identificationType: "Aina ya kitambulisho",
    noIdentification: "Bila kitambulisho",
    nationalId: "Kitambulisho cha Taifa",
    passport: "Pasipoti",
    drivingLicence: "Leseni ya udereva",
    voterId: "Kitambulisho cha mpiga kura",
    otherIdentification: "Kitambulisho kingine",
    identificationNumber: "Namba ya kitambulisho",
    notRequired: "Haihitajiki",
    enterIdentificationNumber: "Weka namba ya kitambulisho",
    company: "Kampuni",
    companyPlaceholder: "Jina la kampuni (hiari)",
    vehicleRegistration: "Namba ya gari",
    vehiclePlaceholder: "Namba ya gari (hiari)",
    visitInformation: "Taarifa za ziara",
    visitInformationHelp: "Eleza unaenda kwa nani na sehemu gani.",
    organization: "Shirika",
    loadingOrganizations: "Inapakia mashirika...",
    selectOrganization: "Chagua shirika",
    departmentOffice: "Idara au ofisi",
    departmentPlaceholder: "Mfano: Idara ya TEHAMA",
    host: "Mtu unayemtembelea",
    hostPlaceholder: "Jina la mwenyeji (hiari)",
    purpose: "Sababu ya ziara",
    purposePlaceholder: "Eleza sababu ya ziara yako",
    clearForm: "Futa Fomu",
    submitting: "Inatuma...",
    submitRegistration: "Tuma Usajili",
    needAssistance: "Unahitaji msaada? Wasiliana na mapokezi.",
    poweredBy: "Inaendeshwa na SmartPass360",
    selectOrganizationError: "Tafadhali chagua shirika unalotembelea.",
    fullNameError: "Tafadhali weka jina lako kamili.",
    phoneError: "Tafadhali weka namba sahihi ya simu.",
    serviceError: "Huduma ya usajili haipatikani. Tafadhali wasiliana na mapokezi."
  }
} as const;

export function KioskRegistrationPage({ onActivationInvalid }: { onActivationInvalid: (message: string) => void }) {
  const [language, setLanguage] = useState<KioskLanguage>(() => {
    return window.sessionStorage.getItem("smartpass360.kioskLanguage") === "sw" ? "sw" : "en";
  });
  const t = copy[language];

  const [form, setForm] =
    useState<RegistrationForm>(initialForm);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [completedRegistration, setCompletedRegistration] =
    useState<KioskRegistrationResult["data"] | null>(() => {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem("smartpass360.pendingVisit") ?? "null");
        return saved?.receiptToken && saved?.visitId ? saved : null;
      } catch { return null; }
    });

  const registeredKioskId =
    window.localStorage.getItem("smartpass360.kioskId");

  const kioskConfigQuery = useQuery({
    queryKey: ["kiosk-config", registeredKioskId, window.localStorage.getItem("smartpass360.deviceId")],
    queryFn: () => getRegisteredKioskConfig(registeredKioskId!),
    enabled: Boolean(registeredKioskId),
    retry: (failureCount, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && failureCount < 1
  });

  useEffect(() => {
    const error = kioskConfigQuery.error;
    if (!(error instanceof ApiError)) return;
    const details = error.details as { error?: { code?: string } } | null;
    if (["KIOSK_DEVICE_REQUIRED", "KIOSK_NOT_AVAILABLE"].includes(details?.error?.code ?? "")) {
      onActivationInvalid(error.message);
    }
  }, [kioskConfigQuery.error, onActivationInvalid]);

  useEffect(() => {
    const config = kioskConfigQuery.data?.data;
    if (config) {
      window.localStorage.setItem("smartpass360.siteId", config.site.id);
      window.localStorage.setItem("smartpass360.siteName", config.site.name);
      window.localStorage.setItem("smartpass360.kioskCode", config.kiosk.code);
    }
  }, [kioskConfigQuery.data]);

  const building = kioskConfigQuery.data?.data.site;

  const registrationMutation = useMutation({
    mutationFn: registerVisitorFromKiosk,

    onSuccess(response) {
      window.sessionStorage.setItem("smartpass360.pendingVisit", JSON.stringify(response.data));
      setCompletedRegistration(response.data);

      setErrorMessage(null);
      setForm(initialForm);
    },

    onError(error) {
      setCompletedRegistration(null);

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(t.serviceError);
    }
  });

  const organizations = useMemo(
    () =>
      (kioskConfigQuery.data?.data.organizations ?? []).filter(
        (organization) => organization.isActive
      ),
    [kioskConfigQuery.data]
  );

  function updateField<
    K extends keyof RegistrationForm
  >(
    field: K,
    value: RegistrationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage(null);
    setCompletedRegistration(null);

    if (!form.organizationId) {
      setErrorMessage(
        t.selectOrganizationError
      );

      return;
    }

    if (form.fullName.trim().length < 3) {
      setErrorMessage(
        t.fullNameError
      );

      return;
    }

    if (form.phoneNumber.trim().length < 7) {
      setErrorMessage(
        t.phoneError
      );

      return;
    }

    const payload: KioskRegistrationPayload = {
      organizationId: form.organizationId,

      fullName: form.fullName.trim(),

      phoneNumber:
        form.phoneNumber.trim(),

      identificationType:
        form.identificationType,

      identificationNumber:
        form.identificationType === "NONE"
          ? undefined
          : form.identificationNumber.trim() ||
            undefined,

      companyName:
        form.companyName.trim() || undefined,

      vehicleRegistrationNumber:
        form.vehicleRegistrationNumber.trim() ||
        undefined,

      kioskId: registeredKioskId!,

      departmentOrOffice:
        form.departmentOrOffice.trim() || undefined,

      hostName: form.hostName.trim() || undefined,

      purposeOfVisit:
        form.purposeOfVisit.trim() || undefined,

      source: "KIOSK"
    };

    registrationMutation.mutate(payload);
  }

  function startAnotherRegistration() {
    window.sessionStorage.removeItem("smartpass360.pendingVisit");
    setCompletedRegistration(null);
    setErrorMessage(null);
    setForm(initialForm);
  }

  if (completedRegistration) {
    return <KioskVisitCompletion registration={completedRegistration} onFinish={startAnotherRegistration} language={language} />;
  }

  return (
    <main className="kiosk-screen">
      <div className="kiosk-shell">
        <header className="kiosk-header">
          <div className="kiosk-brand">
            <div className="kiosk-brand__mark">
              {building?.logoUrl ? (
                <img src={building.logoUrl} alt={building.name} />
              ) : (
                "S"
              )}
            </div>

            <div>
              <strong>SMARTPASS360</strong>
              <span>{building?.name ?? "Visitor Self Registration"}</span>
            </div>
          </div>

          <div className="kiosk-language">
            <button type="button" aria-pressed={language === "en"} onClick={() => { setLanguage("en"); window.sessionStorage.setItem("smartpass360.kioskLanguage", "en"); }}>
              {t.languageEnglish}
            </button>

            <button type="button" aria-pressed={language === "sw"} onClick={() => { setLanguage("sw"); window.sessionStorage.setItem("smartpass360.kioskLanguage", "sw"); }}>
              {t.languageSwahili}
            </button>
          </div>
        </header>

        <section className="kiosk-intro">
          <p>{t.welcome}</p>

          <h1>{t.registerVisit}</h1>

          <span>
            {t.intro}
          </span>
        </section>

        {errorMessage && (
          <div
            className="kiosk-alert"
            role="alert"
          >
            <strong>{t.registrationNotCompleted}</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {kioskConfigQuery.isError && (
          <div
            className="kiosk-alert"
            role="alert"
          >
            <strong>
              Organization service unavailable
            </strong>

            <span>
              {kioskConfigQuery.error.message}
            </span>
            <button type="button" onClick={() => void kioskConfigQuery.refetch()}>Retry connection</button>
          </div>
        )}

        <form
          className="kiosk-form"
          onSubmit={handleSubmit}
        >
          <section className="kiosk-form__section">
            <div className="kiosk-section-heading">
              <span>01</span>

              <div>
                <h2>{t.yourInformation}</h2>
                <p>
                  {t.yourInformationHelp}
                </p>
              </div>
            </div>

            <div className="kiosk-form__grid">
              <KioskField
                label={t.fullName}
                required
                inputProps={{
                  value: form.fullName,
                  autoComplete: "name",
                  placeholder:
                    "Enter your full name",

                  onChange: (event) =>
                    updateField(
                      "fullName",
                      event.target.value
                    )
                }}
              />

              <KioskField
                label={t.phoneNumber}
                required
                inputProps={{
                  type: "tel",
                  value: form.phoneNumber,
                  autoComplete: "tel",
                  placeholder: "+255...",

                  onChange: (event) =>
                    updateField(
                      "phoneNumber",
                      event.target.value
                    )
                }}
              />

              <KioskField
                label={t.identificationType}
                type="select"
                selectProps={{
                  value:
                    form.identificationType,

                  onChange: (event) =>
                    updateField(
                      "identificationType",
                      event.target
                        .value as VisitorIdentificationType
                    )
                }}
              >
                <option value="NONE">
                  No identification
                </option>

                <option value="NATIONAL_ID">
                  National ID
                </option>

                <option value="PASSPORT">
                  Passport
                </option>

                <option value="DRIVING_LICENCE">
                  Driving licence
                </option>

                <option value="VOTER_ID">
                  Voter ID
                </option>

                <option value="OTHER">
                  Other identification
                </option>
              </KioskField>

              <KioskField
                label={t.identificationNumber}
                inputProps={{
                  value:
                    form.identificationNumber,

                  disabled:
                    form.identificationType ===
                    "NONE",

                  placeholder:
                    form.identificationType ===
                    "NONE"
                      ? "Not required"
                      : "Enter identification number",

                  onChange: (event) =>
                    updateField(
                      "identificationNumber",
                      event.target.value
                    )
                }}
              />

              <KioskField
                label={t.company}
                inputProps={{
                  value: form.companyName,
                  placeholder:
                    "Optional company name",

                  onChange: (event) =>
                    updateField(
                      "companyName",
                      event.target.value
                    )
                }}
              />

              <KioskField
                label={t.vehicleRegistration}
                inputProps={{
                  value:
                    form.vehicleRegistrationNumber,

                  placeholder:
                    "Optional vehicle number",

                  onChange: (event) =>
                    updateField(
                      "vehicleRegistrationNumber",
                      event.target.value
                    )
                }}
              />
            </div>
          </section>

          <section className="kiosk-form__section">
            <div className="kiosk-section-heading">
              <span>02</span>

              <div>
                <h2>{t.visitInformation}</h2>

                <p>
                  {t.visitInformationHelp}
                </p>
              </div>
            </div>

            <div className="kiosk-form__grid">
              <KioskField
                label={t.organization}
                required
                type="select"
                selectProps={{
                  value: form.organizationId,
                  disabled: kioskConfigQuery.isPending || kioskConfigQuery.isError,

                  onChange: (event) =>
                    updateField(
                      "organizationId",
                      event.target.value
                    )
                }}
              >
                <option value="">
                  {kioskConfigQuery.isPending ? "Loading organizations..." : "Select organization"}
                </option>

                {organizations.map(
                  (organization) => (
                    <option
                      key={organization.id}
                      value={organization.id}
                    >
                      {organization.name}
                    </option>
                  )
                )}
              </KioskField>

              <KioskField
                label={t.departmentOffice}
                inputProps={{
                  value:
                    form.departmentOrOffice,

                  placeholder:
                    "Example: ICT Department",

                  onChange: (event) =>
                    updateField(
                      "departmentOrOffice",
                      event.target.value
                    )
                }}
              />

              <KioskField
                label={t.host}
                inputProps={{
                  value: form.hostName,
                  placeholder:
                    "Optional host name",

                  onChange: (event) =>
                    updateField(
                      "hostName",
                      event.target.value
                    )
                }}
              />

              <div className="kiosk-form__wide">
                <KioskField
                  label={t.purpose}
                  type="textarea"
                  textareaProps={{
                    value:
                      form.purposeOfVisit,

                    placeholder:
                      "Describe the reason for your visit",

                    onChange: (event) =>
                      updateField(
                        "purposeOfVisit",
                        event.target.value
                      )
                  }}
                />
              </div>
            </div>
          </section>

          <div className="kiosk-form__actions">
            <button
              type="button"
              className="kiosk-secondary-button"
              onClick={() => {
                setForm(initialForm);
                setErrorMessage(null);
              }}
            >
              {t.clearForm}
            </button>

            <button
              type="submit"
              className="kiosk-primary-button"
              disabled={
                registrationMutation.isPending ||
                kioskConfigQuery.isPending ||
                kioskConfigQuery.isError ||
                !registeredKioskId
              }
            >
              {registrationMutation.isPending
                ? t.submitting
                : t.submitRegistration}
            </button>
          </div>
        </form>

        <footer className="kiosk-footer">
          <span>
            {t.needAssistance}
          </span>

          <strong>{t.poweredBy}</strong>
        </footer>
      </div>
    </main>
  );
}
