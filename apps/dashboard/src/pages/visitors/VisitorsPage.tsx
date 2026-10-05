import {
  useMemo,
  useState,
  type FormEvent
} from "react";

import { useMutation } from "@tanstack/react-query";

import { registerVisitor } from "../../api/visitor-api";
import { ApiError } from "../../api/api-client";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";
import { FormField } from "../../components/Forms/FormField";
import { VisitorPassPreview } from "../../components/VisitorPass/VisitorPassPreview";
import { CameraCapture } from "../../components/CameraCapture/CameraCapture";
import { VisitorQueue } from "../../components/VisitorQueue/VisitorQueue";

import type {
  CreateVisitPayload,
  VisitorType
} from "../../types/visitor";

import "./VisitorsPage.css";

type VisitorFormState = {
  fullName: string;
  idType: string;
  idNumber: string;
  phone: string;
  email: string;
  company: string;
  vehicleNumber: string;
  visitorType: VisitorType;
  hostId: string;
  departmentId: string;
  purpose: string;
  scheduledDate: string;
  expectedEntryTime: string;
  expectedExitTime: string;
  photoDataUrl: string;
};

const initialFormState: VisitorFormState = {
  fullName: "",
  idType: "",
  idNumber: "",
  phone: "",
  email: "",
  company: "",
  vehicleNumber: "",
  visitorType: "WALK_IN",
  hostId: "",
  departmentId: "",
  purpose: "",
  scheduledDate: "",
  expectedEntryTime: "",
  expectedExitTime: "",
  photoDataUrl: "", 
};

export function VisitorsPage() {
  const [form, setForm] =
    useState<VisitorFormState>(initialFormState);

  const [submissionMessage, setSubmissionMessage] =
    useState<string | null>(null);

  const fieldErrors = useMemo(() => {
    return {
      fullName:
        form.fullName.trim().length < 3
          ? "Enter the visitor's full name."
          : "",
      purpose:
        form.purpose.trim().length < 3
          ? "Enter the purpose of the visit."
          : ""
    };
  }, [form.fullName, form.purpose]);

  const registrationMutation = useMutation({
    mutationFn: registerVisitor,

    onSuccess(response) {
      setSubmissionMessage(
        `Visitor registration completed. Visit ID: ${response.data.visitId}`
      );

      setForm(initialFormState);
    },

    onError(error) {
      if (error instanceof ApiError) {
        setSubmissionMessage(
          `Registration failed: ${error.message}`
        );

        return;
      }

      setSubmissionMessage(
        "Registration failed because the visitor service is unavailable."
      );
    }
  });

  function updateField<
    K extends keyof VisitorFormState
  >(
    field: K,
    value: VisitorFormState[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSubmissionMessage(null);

    if (fieldErrors.fullName || fieldErrors.purpose) {
      setSubmissionMessage(
        "Complete all required visitor information."
      );

      return;
    }

    const payload: CreateVisitPayload = {
      visitor: {
        fullName: form.fullName.trim(),
        idType: form.idType || undefined,
        idNumber: form.idNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        vehicleNumber:
          form.vehicleNumber.trim() || undefined
      },
      visitorType: form.visitorType,
      hostId: form.hostId || undefined,
      departmentId: form.departmentId || undefined,
      purpose: form.purpose.trim(),
      scheduledDate: form.scheduledDate || undefined,
      expectedEntryTime:
        form.expectedEntryTime || undefined,
      expectedExitTime:
        form.expectedExitTime || undefined
    };

    registrationMutation.mutate(payload);
  }

  return (
    <div className="visitors-page">
      <header className="visitors-page__header">
        <div>
          <p className="visitors-page__eyebrow">
            Visitor Operations
          </p>

          <h1>Register Visitor</h1>

          <p>
            Capture visitor details and create a visit request
            through the SMARTPASS360 API.
          </p>
        </div>

        <div className="visitors-page__status">
          <span />
          Live registration surface
        </div>
      </header>

      <VisitorQueue />
     <div className="visitors-page__workspace">
  <form
    className="visitor-form"
    onSubmit={handleSubmit}
  >
        <GlassCard
          title="Visitor identity"
          subtitle="Enter the visitor's identification and contact information."
          accent="blue"
        >
          <div className="visitor-form__grid">
            <FormField
              label="Full name"
              required
              error={fieldErrors.fullName}
              inputProps={{
                value: form.fullName,
                placeholder: "Enter full name",
                autoComplete: "name",
                onChange: (event) =>
                  updateField(
                    "fullName",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Visitor type"
              required
              as="select"
              selectProps={{
                value: form.visitorType,
                onChange: (event) =>
                  updateField(
                    "visitorType",
                    event.target.value as VisitorType
                  )
              }}
            >
              <option value="WALK_IN">
                Walk-in Visitor
              </option>
              <option value="EXPECTED">
                Expected Visitor
              </option>
              <option value="CONTRACTOR">
                Contractor
              </option>
              <option value="SUPPLIER">
                Supplier
              </option>
              <option value="DELIVERY">
                Delivery
              </option>
              <option value="INTERVIEW_CANDIDATE">
                Interview Candidate
              </option>
              <option value="GOVERNMENT_OFFICIAL">
                Government Official
              </option>
              <option value="VIP">
                VIP
              </option>
            </FormField>

            <FormField
              label="ID type"
              as="select"
              selectProps={{
                value: form.idType,
                onChange: (event) =>
                  updateField(
                    "idType",
                    event.target.value
                  )
              }}
            >
              <option value="">
                Select ID type
              </option>
              <option value="NATIONAL_ID">
                National ID
              </option>
              <option value="PASSPORT">
                Passport
              </option>
              <option value="DRIVING_LICENSE">
                Driving Licence
              </option>
              <option value="VOTER_ID">
                Voter ID
              </option>
              <option value="OTHER">
                Other ID
              </option>
            </FormField>

            <FormField
              label="ID number"
              inputProps={{
                value: form.idNumber,
                placeholder: "Enter ID number",
                onChange: (event) =>
                  updateField(
                    "idNumber",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Phone number"
              inputProps={{
                type: "tel",
                value: form.phone,
                placeholder: "+255...",
                autoComplete: "tel",
                onChange: (event) =>
                  updateField(
                    "phone",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Email address"
              inputProps={{
                type: "email",
                value: form.email,
                placeholder: "visitor@example.com",
                autoComplete: "email",
                onChange: (event) =>
                  updateField(
                    "email",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Company or organization"
              inputProps={{
                value: form.company,
                placeholder: "Enter organization name",
                onChange: (event) =>
                  updateField(
                    "company",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Vehicle number"
              hint="Optional"
              inputProps={{
                value: form.vehicleNumber,
                placeholder: "T 123 ABC",
                onChange: (event) =>
                  updateField(
                    "vehicleNumber",
                    event.target.value
                  )
              }}
            />
          </div>
        </GlassCard>

<GlassCard
  title="Visitor photograph"
  subtitle="Capture a clear visitor image for identification and pass printing."
  accent="cyan"
>
  <CameraCapture
    value={form.photoDataUrl}
    onCapture={(photoDataUrl) =>
      updateField("photoDataUrl", photoDataUrl)
    }
    onClear={() =>
      updateField("photoDataUrl", "")
    }
  />
</GlassCard>

        <GlassCard
          title="Visit destination"
          subtitle="Hosts and departments will load from the API when those endpoints are available."
          accent="violet"
        >
          <div className="visitor-form__grid">
            <FormField
              label="Host"
              as="select"
              selectProps={{
                value: form.hostId,
                disabled: true,
                onChange: (event) =>
                  updateField(
                    "hostId",
                    event.target.value
                  )
              }}
            >
              <option value="">
                Host API not connected
              </option>
            </FormField>

            <FormField
              label="Department"
              as="select"
              selectProps={{
                value: form.departmentId,
                disabled: true,
                onChange: (event) =>
                  updateField(
                    "departmentId",
                    event.target.value
                  )
              }}
            >
              <option value="">
                Department API not connected
              </option>
            </FormField>

            <FormField
              label="Scheduled date"
              inputProps={{
                type: "date",
                value: form.scheduledDate,
                onChange: (event) =>
                  updateField(
                    "scheduledDate",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Expected entry time"
              inputProps={{
                type: "time",
                value: form.expectedEntryTime,
                onChange: (event) =>
                  updateField(
                    "expectedEntryTime",
                    event.target.value
                  )
              }}
            />

            <FormField
              label="Expected exit time"
              inputProps={{
                type: "time",
                value: form.expectedExitTime,
                onChange: (event) =>
                  updateField(
                    "expectedExitTime",
                    event.target.value
                  )
              }}
            />

            <div />

            <div className="visitor-form__wide">
              <FormField
                label="Purpose of visit"
                required
                error={fieldErrors.purpose}
                as="textarea"
                textareaProps={{
                  value: form.purpose,
                  placeholder:
                    "Describe the reason for this visit",
                  onChange: (event) =>
                    updateField(
                      "purpose",
                      event.target.value
                    )
                }}
              />
            </div>
          </div>
        </GlassCard>

        <div className="visitor-form__footer">
          <div className="visitor-form__message">
            {submissionMessage ?? (
              <span>
                Visitor data will be submitted directly to the
                SMARTPASS360 API.
              </span>
            )}
          </div>

          <div className="visitor-form__actions">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => {
                setForm(initialFormState);
                setSubmissionMessage(null);
              }}
            >
              Clear Form
            </GlassButton>

            <GlassButton
              type="submit"
              disabled={registrationMutation.isPending}
            >
              {registrationMutation.isPending
                ? "Submitting..."
                : "Register Visitor"}
            </GlassButton>
          </div>
        </div>
          </form>

      <aside className="visitors-page__preview">
        <VisitorPassPreview
          data={{
            fullName: form.fullName,
            company: form.company,
            visitorType: form.visitorType,
            purpose: form.purpose,
            scheduledDate: form.scheduledDate,
            expectedEntryTime: form.expectedEntryTime,
            expectedExitTime: form.expectedExitTime,
            photoUrl: form.photoDataUrl || undefined,
            status: "DRAFT"
          }}
        />
      </aside>
    </div>
    </div>
  );
}
