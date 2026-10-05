import {
  useMemo,
  useState,
  type FormEvent
} from "react";

import {
  useMutation,
  useQuery
} from "@tanstack/react-query";

import {
  getKioskOrganizations,
  getRegisteredKioskConfig,
  registerVisitorFromKiosk
} from "../api/kiosk-api";

import { ApiError } from "../api/api-client";

import { KioskField } from "../components/KioskField";

import type {
  KioskRegistrationPayload,
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

export function KioskRegistrationPage() {
  const [form, setForm] =
    useState<RegistrationForm>(initialForm);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [completedRegistration, setCompletedRegistration] =
    useState<{
      referenceNumber: string;
      registeredAt: string;
    } | null>(null);

  const registeredKioskId =
    window.localStorage.getItem("smartpass360.kioskId");

  const kioskConfigQuery = useQuery({
    queryKey: ["kiosk-config", registeredKioskId],
    queryFn: () => getRegisteredKioskConfig(registeredKioskId!),
    enabled: Boolean(registeredKioskId),
    retry: 1
  });

  const building = kioskConfigQuery.data?.data.site;

  const organizationsQuery = useQuery({
    queryKey: ["kiosk-organizations"],
    queryFn: getKioskOrganizations,
    staleTime: 60_000
  });

  const registrationMutation = useMutation({
    mutationFn: registerVisitorFromKiosk,

    onSuccess(response) {
      setCompletedRegistration({
        referenceNumber:
          response.data.referenceNumber,

        registeredAt:
          response.data.registeredAt
      });

      setErrorMessage(null);
      setForm(initialForm);
    },

    onError(error) {
      setCompletedRegistration(null);

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(
        "Registration service is unavailable. Please contact reception."
      );
    }
  });

  const organizations = useMemo(
    () =>
      (organizationsQuery.data?.data ?? []).filter(
        (organization) => organization.isActive
      ),
    [organizationsQuery.data]
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
        "Please select the organization you are visiting."
      );

      return;
    }

    if (form.fullName.trim().length < 3) {
      setErrorMessage(
        "Please enter your full name."
      );

      return;
    }

    if (form.phoneNumber.trim().length < 7) {
      setErrorMessage(
        "Please enter a valid phone number."
      );

      return;
    }

    if (!form.departmentOrOffice.trim()) {
      setErrorMessage(
        "Please enter the department or office."
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

      departmentOrOffice:
        form.departmentOrOffice.trim(),

      hostName: form.hostName.trim() || undefined,

      purposeOfVisit:
        form.purposeOfVisit.trim(),

      source: "KIOSK"
    };

    registrationMutation.mutate(payload);
  }

  function startAnotherRegistration() {
    setCompletedRegistration(null);
    setErrorMessage(null);
    setForm(initialForm);
  }

  if (completedRegistration) {
    return (
      <main className="kiosk-screen">
        <section className="kiosk-complete">
          <div className="kiosk-complete__icon">
            ✓
          </div>

          <p className="kiosk-complete__eyebrow">
            Registration submitted
          </p>

          <h1>Please wait for reception approval</h1>

          <p className="kiosk-complete__description">
            Your information has been sent securely to
            the reception dashboard.
          </p>

          <div className="kiosk-reference">
            <span>Visitor reference</span>

            <strong>
              {completedRegistration.referenceNumber}
            </strong>
          </div>

          <button
            type="button"
            className="kiosk-primary-button"
            onClick={startAnotherRegistration}
          >
            Register Another Visitor
          </button>
        </section>
      </main>
    );
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
            <button type="button">
              English
            </button>

            <button type="button" disabled>
              Kiswahili
            </button>
          </div>
        </header>

        <section className="kiosk-intro">
          <p>Welcome</p>

          <h1>Register your visit</h1>

          <span>
            Enter your details below. Reception will
            review your registration and issue your
            visitor pass.
          </span>
        </section>

        {errorMessage && (
          <div
            className="kiosk-alert"
            role="alert"
          >
            <strong>Registration not completed</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {organizationsQuery.isError && (
          <div
            className="kiosk-alert"
            role="alert"
          >
            <strong>
              Organization service unavailable
            </strong>

            <span>
              Please contact the receptionist for
              assistance.
            </span>
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
                <h2>Your information</h2>
                <p>
                  Enter the visitor's identification
                  details.
                </p>
              </div>
            </div>

            <div className="kiosk-form__grid">
              <KioskField
                label="Full name"
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
                label="Phone number"
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
                label="Identification type"
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
                label="Identification number"
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
                label="Company"
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
                label="Vehicle registration"
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
                <h2>Visit information</h2>

                <p>
                  Tell reception who and where you are
                  visiting.
                </p>
              </div>
            </div>

            <div className="kiosk-form__grid">
              <KioskField
                label="Organization"
                required
                type="select"
                selectProps={{
                  value: form.organizationId,
                  disabled:
                    organizationsQuery.isPending ||
                    organizationsQuery.isError,

                  onChange: (event) =>
                    updateField(
                      "organizationId",
                      event.target.value
                    )
                }}
              >
                <option value="">
                  {organizationsQuery.isPending
                    ? "Loading organizations..."
                    : "Select organization"}
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
                label="Department or office"
                required
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
                label="Person you are visiting"
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
                  label="Purpose of visit"
                  required
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
              Clear Form
            </button>

            <button
              type="submit"
              className="kiosk-primary-button"
              disabled={
                registrationMutation.isPending ||
                organizationsQuery.isError
              }
            >
              {registrationMutation.isPending
                ? "Submitting..."
                : "Submit Registration"}
            </button>
          </div>
        </form>

        <footer className="kiosk-footer">
          <span>
            Need assistance? Please contact reception.
          </span>

          <strong>Powered by SmartPass360</strong>
        </footer>
      </div>
    </main>
  );
}