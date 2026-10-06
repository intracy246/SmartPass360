import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "../../api/api-client";
import { getOrganizations } from "../../api/organization-api";
import { registerVisitor } from "../../api/visitor-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";
import { FormField } from "../../components/Forms/FormField";
import { VisitorPassPreview } from "../../components/VisitorPass/VisitorPassPreview";
import { VisitorQueue } from "../../components/VisitorQueue/VisitorQueue";
import { printVisitorPass } from "../../utils/visitor-pass-print";

import type {
  CreateVisitPayload,
  IssuedVisitorPass,
  VisitorIdentificationType
} from "../../types/visitor";

import "./VisitorsPage.css";

type VisitorFormState = {
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

type IssuedRegistration = VisitorFormState & {
  organizationName: string;
  pass: IssuedVisitorPass;
};

const initialFormState: VisitorFormState = {
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

export function VisitorsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VisitorFormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issuedRegistration, setIssuedRegistration] =
    useState<IssuedRegistration | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ["organizations", "active", "visitor-registration"],
    queryFn: () => getOrganizations("", 1, 100, true)
  });

  const organizations = useMemo(
    () => (organizationsQuery.data?.data ?? []).filter((organization) => organization.isActive),
    [organizationsQuery.data]
  );

  const selectedOrganization = organizations.find(
    (organization) => organization.id === form.organizationId
  );

  const fieldErrors = {
    fullName:
      form.fullName.trim().length < 3
        ? "Enter the visitor's full name."
        : "",
    phoneNumber:
      form.phoneNumber.trim().length < 7
        ? "Enter a valid phone number."
        : "",
    organizationId:
      !form.organizationId
        ? "Select the organization being visited."
        : "",
    identificationNumber:
      form.identificationType !== "NONE" &&
      !form.identificationNumber.trim()
        ? "Enter the identification number."
        : ""
  };

  useEffect(() => {
    if (searchParams.get("mode") !== "register") return;

    window.requestAnimationFrame(() => {
      document
        .getElementById("register-visitor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams]);

  const registrationMutation = useMutation({
    mutationFn: registerVisitor,
    async onSuccess(response, variables) {
      const organizationName = organizations.find(
        (organization) => organization.id === variables.organizationId
      )?.name;

      setIssuedRegistration({
        organizationId: variables.organizationId,
        fullName: variables.fullName,
        phoneNumber: variables.phoneNumber,
        identificationType: variables.identificationType,
        identificationNumber: variables.identificationNumber ?? "",
        companyName: variables.companyName ?? "",
        vehicleRegistrationNumber:
          variables.vehicleRegistrationNumber ?? "",
        departmentOrOffice: variables.departmentOrOffice ?? "",
        hostName: variables.hostName ?? "",
        purposeOfVisit: variables.purposeOfVisit ?? "",
        organizationName: organizationName ?? "Organization",
        pass: response.data.pass
      });
      setErrorMessage(null);
      setSubmitted(false);
      await queryClient.invalidateQueries({ queryKey: ["visitor-queue"] });
    },
    onError(error) {
      setIssuedRegistration(null);

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(
        "Registration failed because the visitor service is unavailable."
      );
    }
  });

  function updateField<K extends keyof VisitorFormState>(
    field: K,
    value: VisitorFormState[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === "identificationType" && value === "NONE"
        ? { identificationNumber: "" }
        : {})
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setErrorMessage(null);

    if (Object.values(fieldErrors).some(Boolean)) {
      setErrorMessage("Complete all required visitor information.");
      return;
    }

    setIssuedRegistration(null);

    const payload: CreateVisitPayload = {
      organizationId: form.organizationId,
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      identificationType: form.identificationType,
      identificationNumber:
        form.identificationType === "NONE"
          ? undefined
          : form.identificationNumber.trim(),
      companyName: form.companyName.trim() || undefined,
      vehicleRegistrationNumber:
        form.vehicleRegistrationNumber.trim() || undefined,
      departmentOrOffice: form.departmentOrOffice.trim() || undefined,
      hostName: form.hostName.trim() || undefined,
      purposeOfVisit: form.purposeOfVisit.trim() || undefined
    };

    registrationMutation.mutate(payload);
  }

  function clearForm() {
    setForm(initialFormState);
    setSubmitted(false);
    setErrorMessage(null);
    setIssuedRegistration(null);
  }

  async function handlePrint() {
    if (!issuedRegistration) return;

    try {
      setErrorMessage(null);
      await printVisitorPass({
        ...issuedRegistration.pass,
        fullName: issuedRegistration.fullName,
        organizationName: issuedRegistration.organizationName,
        departmentOrOffice: issuedRegistration.departmentOrOffice,
        hostName: issuedRegistration.hostName,
        purpose: issuedRegistration.purposeOfVisit
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The visitor pass could not be printed."
      );
    }
  }

  const previewSource = issuedRegistration ?? form;
  const previewPass = issuedRegistration?.pass;

  return (
    <div className="visitors-page">
      <header className="visitors-page__header">
        <div>
          <p className="visitors-page__eyebrow">Visitor Operations</p>
          <h1>Visitors</h1>
          <p>
            Review kiosk arrivals and securely register walk-in visitors for
            this building.
          </p>
        </div>

        <nav className="visitors-page__jump-links" aria-label="Visitor page sections">
          <a href="#reception-queue">Reception queue</a>
          <a href="#register-visitor">Register visitor</a>
        </nav>
      </header>

      <div id="reception-queue" className="visitors-page__section-anchor">
        <VisitorQueue />
      </div>

      <section
        id="register-visitor"
        className="visitors-page__registration"
        aria-labelledby="register-visitor-heading"
      >
        <header className="visitors-page__registration-heading">
          <div>
            <p className="visitors-page__eyebrow">Staff registration</p>
            <h2 id="register-visitor-heading">Register Visitor</h2>
            <p>
              Authorized Reception or Security registration issues a real,
              printable visitor pass without a second approval step.
            </p>
          </div>
        </header>

        {organizationsQuery.isError ? (
          <div className="visitor-form__alert visitor-form__alert--error" role="alert">
            <strong>Organization unavailable.</strong>
            <span>{organizationsQuery.error.message}</span>
            <button type="button" onClick={() => void organizationsQuery.refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="visitor-form__alert visitor-form__alert--error" role="alert">
            <strong>Registration not completed</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {issuedRegistration ? (
          <div className="visitor-form__alert visitor-form__alert--success" role="status">
            <div>
              <strong>Visitor registered and pass issued.</strong>
              <span>
                Pass {issuedRegistration.pass.passNumber} is ready to print.
              </span>
            </div>
            <GlassButton type="button" variant="success" onClick={() => void handlePrint()}>
              Print Visitor Pass
            </GlassButton>
          </div>
        ) : null}

        <div className="visitors-page__workspace">
          <form className="visitor-form" onSubmit={handleSubmit} noValidate>
            <GlassCard
              title="01 — Visitor Information"
              subtitle="Capture the visitor's identification and contact details."
              accent="blue"
            >
              <div className="visitor-form__grid">
                <FormField
                  label="Full Name"
                  required
                  error={submitted ? fieldErrors.fullName : ""}
                  inputProps={{
                    value: form.fullName,
                    placeholder: "Enter full name",
                    autoComplete: "name",
                    onChange: (event) => updateField("fullName", event.target.value)
                  }}
                />

                <FormField
                  label="Phone Number"
                  required
                  error={submitted ? fieldErrors.phoneNumber : ""}
                  inputProps={{
                    type: "tel",
                    value: form.phoneNumber,
                    placeholder: "+255...",
                    autoComplete: "tel",
                    onChange: (event) => updateField("phoneNumber", event.target.value)
                  }}
                />

                <FormField
                  label="Identification Type"
                  as="select"
                  selectProps={{
                    value: form.identificationType,
                    onChange: (event) =>
                      updateField(
                        "identificationType",
                        event.target.value as VisitorIdentificationType
                      )
                  }}
                >
                  <option value="NONE">No identification</option>
                  <option value="NATIONAL_ID">National ID</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENCE">Driving Licence</option>
                  <option value="VOTER_ID">Voter ID</option>
                  <option value="OTHER">Other</option>
                </FormField>

                <FormField
                  label="Identification Number"
                  required={form.identificationType !== "NONE"}
                  error={submitted ? fieldErrors.identificationNumber : ""}
                  inputProps={{
                    value: form.identificationNumber,
                    disabled: form.identificationType === "NONE",
                    placeholder:
                      form.identificationType === "NONE"
                        ? "Not required"
                        : "Enter identification number",
                    onChange: (event) =>
                      updateField("identificationNumber", event.target.value)
                  }}
                />

                <FormField
                  label="Company"
                  hint="Optional"
                  inputProps={{
                    value: form.companyName,
                    placeholder: "Enter company name",
                    onChange: (event) => updateField("companyName", event.target.value)
                  }}
                />

                <FormField
                  label="Vehicle Registration Number"
                  hint="Optional"
                  inputProps={{
                    value: form.vehicleRegistrationNumber,
                    placeholder: "T 123 ABC",
                    onChange: (event) =>
                      updateField("vehicleRegistrationNumber", event.target.value)
                  }}
                />
              </div>
            </GlassCard>

            <GlassCard
              title="02 — Visit Information"
              subtitle="Select the building organization and add the destination details."
              accent="violet"
            >
              <div className="visitor-form__grid">
                <FormField
                  label="Organization"
                  required
                  as="select"
                  error={submitted ? fieldErrors.organizationId : ""}
                  selectProps={{
                    value: form.organizationId,
                    disabled:
                      organizationsQuery.isPending || organizationsQuery.isError,
                    onChange: (event) =>
                      updateField("organizationId", event.target.value)
                  }}
                >
                  <option value="">
                    {organizationsQuery.isPending
                      ? "Loading organizations..."
                      : "Select organization"}
                  </option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </FormField>

                <FormField
                  label="Department / Office"
                  hint="Optional"
                  inputProps={{
                    value: form.departmentOrOffice,
                    placeholder: "Example: ICT Department",
                    onChange: (event) =>
                      updateField("departmentOrOffice", event.target.value)
                  }}
                />

                <FormField
                  label="Person Visiting / Host"
                  hint="Optional"
                  inputProps={{
                    value: form.hostName,
                    placeholder: "Enter host name",
                    onChange: (event) => updateField("hostName", event.target.value)
                  }}
                />

                <div className="visitor-form__wide">
                  <FormField
                    label="Purpose of Visit"
                    hint="Optional"
                    as="textarea"
                    textareaProps={{
                      value: form.purposeOfVisit,
                      placeholder: "Describe the reason for this visit",
                      onChange: (event) =>
                        updateField("purposeOfVisit", event.target.value)
                    }}
                  />
                </div>
              </div>
            </GlassCard>

            <div className="visitor-form__footer">
              <div className="visitor-form__message">
                Registration is securely attached to the signed-in building and
                selected organization.
              </div>

              <div className="visitor-form__actions">
                <GlassButton
                  type="button"
                  variant="secondary"
                  disabled={registrationMutation.isPending}
                  onClick={clearForm}
                >
                  Clear Form
                </GlassButton>

                <GlassButton
                  type="submit"
                  disabled={
                    registrationMutation.isPending ||
                    organizationsQuery.isPending ||
                    organizationsQuery.isError
                  }
                >
                  {registrationMutation.isPending
                    ? "Registering..."
                    : "Register Visitor"}
                </GlassButton>
              </div>
            </div>
          </form>

          <aside className="visitors-page__preview" aria-label="Visitor pass preview">
            <VisitorPassPreview
              organizationName={
                issuedRegistration?.organizationName ??
                selectedOrganization?.name ??
                "SMARTPASS360"
              }
              data={{
                fullName: previewSource.fullName,
                company: previewSource.companyName,
                visitorType: "WALK_IN",
                hostName: previewSource.hostName,
                departmentName: previewSource.departmentOrOffice,
                purpose: previewSource.purposeOfVisit,
                passNumber: previewPass?.passNumber,
                qrValue: previewPass?.qrValue,
                status: previewPass ? "ACTIVE" : "DRAFT"
              }}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
