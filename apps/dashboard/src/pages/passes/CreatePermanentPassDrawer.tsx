import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";

import QRCode from "qrcode";

import {
  useMutation,
  useQuery
} from "@tanstack/react-query";

import {
  createPermanentPass
} from "../../api/permanent-pass-api";

import {
  getOrganizations
} from "../../api/organization-api";

import { ApiError } from "../../api/api-client";

import { GlassButton } from "../../components/Buttons/GlassButton";

import type {
  CreatePermanentPassPayload,
  CreatePermanentPassResponse,
  PermanentPassHolderType
} from "../../types/permanent-pass";

type CreatePermanentPassDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type PermanentPassFormState = {
  organizationId: string;
  fullName: string;
  staffNumber: string;
  department: string;
  holderType: PermanentPassHolderType;
  phone: string;
  vehiclePlateNumber: string;
  photoDataUrl: string;
};

type PermanentPassFormErrors = Partial<
  Record<keyof PermanentPassFormState, string>
>;

function getTodayDate(): string {
  const now = new Date();

  const timezoneOffset =
    now.getTimezoneOffset() * 60_000;

  return new Date(
    now.getTime() - timezoneOffset
  )
    .toISOString()
    .slice(0, 10);
}

const initialFormState: PermanentPassFormState = {
  organizationId: "",
  fullName: "",
  staffNumber: "",
  department: "",
  holderType: "EMPLOYEE",
  phone: "",
  vehiclePlateNumber: "",
  photoDataUrl: ""
};

export function CreatePermanentPassDrawer({
  open,
  onClose,
  onCreated
}: CreatePermanentPassDrawerProps) {
  const [form, setForm] =
    useState<PermanentPassFormState>({
      ...initialFormState
    });

  const [formErrors, setFormErrors] =
    useState<PermanentPassFormErrors>({});

  const [message, setMessage] =
    useState<string | null>(null);

  const [photoFileName, setPhotoFileName] =
    useState("");

  const [createdPass, setCreatedPass] =
    useState<
      CreatePermanentPassResponse["data"] | null
    >(null);

  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);


  const organizationsQuery = useQuery({
    queryKey: ["organizations", "permanent-pass-form"],

    queryFn: () =>
      getOrganizations("", 1, 100),

    enabled: open
  });

  const createMutation = useMutation({
    mutationFn: createPermanentPass,

    onSuccess(response) {
      setCreatedPass(response.data);
      setMessage(null);
      setFormErrors({});
    },

    onError(error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Permanent pass could not be created. The API service is unavailable."
      );
    }
  });

  const photoInitials = useMemo(() => {
    const names = form.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (names.length === 0) {
      return "P";
    }

    if (names.length === 1) {
      return names[0]
        .charAt(0)
        .toUpperCase();
    }

    return (
      names[0].charAt(0) +
      names[names.length - 1].charAt(0)
    ).toUpperCase();
  }, [form.fullName]);
  useEffect(() => {
    let cancelled = false;

    async function generatePermanentQr() {
      if (!createdPass?.qrToken) {
        setQrImageUrl(null);
        return;
      }

      try {
        const qrPayload = createdPass.qrToken;

        const generatedQr =
          await QRCode.toDataURL(qrPayload, {
            width: 420,
            margin: 2,
            errorCorrectionLevel: "H"
          });

        if (!cancelled) {
          setQrImageUrl(generatedQr);
        }
      } catch {
        if (!cancelled) {
          setQrImageUrl(null);

          setMessage(
            "Permanent Pass was created, but the QR image could not be generated."
          );
        }
      }
    }

    void generatePermanentQr();

    return () => {
      cancelled = true;
    };
  }, [createdPass]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape" &&
        !createMutation.isPending
      ) {
        closeDrawer();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open, createMutation.isPending]);

  function updateField<
    K extends keyof PermanentPassFormState
  >(
    field: K,
    value: PermanentPassFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));

    setFormErrors((current) => ({
      ...current,
      [field]: undefined
    }));

    setMessage(null);
  }

  function validateForm(): boolean {
    const errors: PermanentPassFormErrors =
      {};

    if (!form.organizationId.trim()) {
      errors.organizationId =
        "Select an organization.";
    }

    if (form.fullName.trim().length < 3) {
      errors.fullName =
        "Enter the holder's full name.";
    }

    if (!form.staffNumber.trim()) {
      errors.staffNumber =
        "Staff number is required.";
    }

    if (!form.department.trim()) {
      errors.department =
        "Department or office is required.";
    }

    if (!form.phone.trim()) {
      errors.phone =
        "Phone number is required.";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  }

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (
      !allowedTypes.includes(
        selectedFile.type
      )
    ) {
      setMessage(
        "Select a JPG, PNG or WebP image."
      );

      event.target.value = "";
      return;
    }

    const maximumSize =
      5 * 1024 * 1024;

    if (selectedFile.size > maximumSize) {
      setMessage(
        "The selected photo must not exceed 5 MB."
      );

      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setMessage(
          "The selected photo could not be read."
        );

        return;
      }

      updateField(
        "photoDataUrl",
        reader.result
      );

      setPhotoFileName(
        selectedFile.name
      );
    };

    reader.onerror = () => {
      setMessage(
        "The selected photo could not be read."
      );
    };

    reader.readAsDataURL(selectedFile);
  }

  function removePhoto() {
    updateField("photoDataUrl", "");
    setPhotoFileName("");
  }

  function resetDrawer() {
    setForm({
      ...initialFormState
    });

    setFormErrors({});
    setMessage(null);
    setPhotoFileName("");
    setCreatedPass(null);
    setQrImageUrl(null);
    createMutation.reset();
  }

  function closeDrawer() {
    if (createMutation.isPending) {
      return;
    }

    const passWasCreated =
      createdPass !== null;

    resetDrawer();
    onClose();

    if (passWasCreated) {
      onCreated();
    }
  }

  function finishCreation() {
    resetDrawer();
    onCreated();
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);

    if (!validateForm()) {
      setMessage(
        "Complete all required information."
      );

      return;
    }

    const payload: CreatePermanentPassPayload =
      {
        organizationId:
          form.organizationId.trim(),

        fullName:
          form.fullName.trim(),

        staffNumber:
          form.staffNumber.trim(),

        department:
          form.department.trim(),

        holderType:
          form.holderType,

        phone:
          form.phone.trim(),

        vehiclePlateNumber:
          form.vehiclePlateNumber.trim() || undefined,

        photoDataUrl:
          form.photoDataUrl ||
          undefined,

        validFrom:
          getTodayDate(),

        expiryType:
          "LIFETIME"
      };

    createMutation.mutate(payload);
  }

  function printPermanentPass() {
    window.print();
  }

  if (!open) {
    return null;
  }

  if (createdPass) {
    return (
      <div
        className="permanent-pass-drawer"
        role="presentation"
      >
        <button
          type="button"
          className="permanent-pass-drawer__backdrop"
          aria-label="Close permanent pass"
          onClick={finishCreation}
        />

        <aside
          className="permanent-pass-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permanent-pass-created-title"
        >
          <header className="permanent-pass-drawer__header permanent-pass-no-print">
            <div>
              <p>
                Permanent credential
              </p>

              <h2
                id="permanent-pass-created-title"
              >
                Permanent Pass Created
              </h2>

              <span>
                The reusable permanent QR pass
                has been generated successfully.
              </span>
            </div>

            <button
              type="button"
              className="permanent-pass-drawer__close"
              aria-label="Close drawer"
              onClick={finishCreation}
            >
              Ãƒâ€”
            </button>
          </header>

          <div className="permanent-pass-result">
            <div className="permanent-pass-result__success permanent-pass-no-print">
              Ã¢Å“â€œ
            </div>

            <div className="permanent-pass-result__card">
              <p className="permanent-pass-result__label">
                SMARTPASS360
              </p>

              {createdPass.photoUrl && (
                <img
                  src={createdPass.photoUrl}
                  alt={createdPass.fullName}
                  className="permanent-pass-result__photo"
                />
              )}

              <h3>
                {createdPass.fullName}
              </h3>

              <span className="permanent-pass-result__type">
                Permanent Pass
              </span>

              <strong className="permanent-pass-result__number">
                {createdPass.passNumber}
              </strong>

              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={`Permanent QR for ${createdPass.fullName}`}
                  className="permanent-pass-result__qr"
                />
              ) : (
                <div className="permanent-pass-result__missing-qr">
                  <strong>
                    Generating QR...
                  </strong>

                  <span>
                    Preparing secure permanent credential.
                  </span>
                </div>
              )}

              <small>
                Present this QR at the gate for
                entry and exit.
              </small>
            </div>

            <div className="permanent-pass-result__actions permanent-pass-no-print">
              <GlassButton
                type="button"
                variant="secondary"
                disabled={
                  !qrImageUrl
                }
                onClick={printPermanentPass}
              >
                Print QR
              </GlassButton>

              <GlassButton
                type="button"
                onClick={finishCreation}
              >
                Done
              </GlassButton>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div
      className="permanent-pass-drawer"
      role="presentation"
    >
      <button
        type="button"
        className="permanent-pass-drawer__backdrop"
        aria-label="Close permanent pass registration"
        onClick={closeDrawer}
      />

      <aside
        className="permanent-pass-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-permanent-pass-title"
      >
        <header className="permanent-pass-drawer__header">
          <div>
            <p>
              Reusable access credential
            </p>

            <h2
              id="create-permanent-pass-title"
            >
              Create Permanent Pass
            </h2>

            <span>
              Register the holder and generate
              one permanent QR pass.
            </span>
          </div>

          <button
            type="button"
            className="permanent-pass-drawer__close"
            aria-label="Close drawer"
            disabled={
              createMutation.isPending
            }
            onClick={closeDrawer}
          >
            Ãƒâ€”
          </button>
        </header>

        <form
          className="permanent-pass-form"
          onSubmit={handleSubmit}
        >
          <div className="permanent-pass-form__section">
            <div className="permanent-pass-form__photo-layout">
              <div className="permanent-pass-form__photo">
                {form.photoDataUrl ? (
                  <img
                    src={form.photoDataUrl}
                    alt="Permanent pass holder"
                  />
                ) : (
                  <span>
                    {photoInitials}
                  </span>
                )}
              </div>

              <div className="permanent-pass-form__photo-actions">
                <label className="permanent-pass-form__upload">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={
                      handlePhotoChange
                    }
                  />

                  Choose Photo
                </label>

                {form.photoDataUrl && (
                  <button
                    type="button"
                    className="permanent-pass-form__remove-photo"
                    onClick={
                      removePhoto
                    }
                  >
                    Remove
                  </button>
                )}

                <small>
                  {photoFileName ||
                    "Optional. JPG, PNG or WebP."}
                </small>
              </div>
            </div>

            <div className="permanent-pass-form__grid">
              <label className="permanent-pass-field">
                  <span>
                    Organization
                    <b>*</b>
                  </span>

                  <select
                    value={form.organizationId}
                    disabled={
                      organizationsQuery.isPending ||
                      organizationsQuery.isError
                    }
                    onChange={(event) => {
                      updateField(
                        "organizationId",
                        event.target.value
                      );
                    }}
                  >
                    <option value="">
                      {organizationsQuery.isPending
                        ? "Loading organizations..."
                        : organizationsQuery.isError
                          ? "Organizations unavailable"
                          : "Select organization"}
                    </option>

                    {(organizationsQuery.data?.data ?? []).map(
                      (organization) => (
                        <option
                          key={organization.id}
                          value={organization.id}
                        >
                          {organization.name}
                        </option>
                      )
                    )}
                  </select>

                  {formErrors.organizationId && (
                    <small className="permanent-pass-field__error">
                      {
                        formErrors.organizationId
                      }
                    </small>
                  )}
                </label>

              <label className="permanent-pass-field">
                <span>
                  Full Name
                  <b>*</b>
                </span>

                <input
                  type="text"
                  value={form.fullName}
                  placeholder="Full name"
                  autoComplete="name"
                  onChange={(event) => {
                    updateField(
                      "fullName",
                      event.target.value
                    );
                  }}
                />

                {formErrors.fullName && (
                  <small className="permanent-pass-field__error">
                    {formErrors.fullName}
                  </small>
                )}
              </label>

              <label className="permanent-pass-field">
                <span>
                  Staff Number
                  <b>*</b>
                </span>

                <input
                  type="text"
                  value={
                    form.staffNumber
                  }
                  placeholder="Staff number"
                  autoComplete="off"
                  onChange={(event) => {
                    updateField(
                      "staffNumber",
                      event.target.value
                    );
                  }}
                />

                {formErrors.staffNumber && (
                  <small className="permanent-pass-field__error">
                    {
                      formErrors.staffNumber
                    }
                  </small>
                )}
              </label>

              <label className="permanent-pass-field">
                <span>
                  Department
                  <b>*</b>
                </span>

                <input
                  type="text"
                  value={
                    form.department
                  }
                  placeholder="Department or office"
                  onChange={(event) => {
                    updateField(
                      "department",
                      event.target.value
                    );
                  }}
                />

                {formErrors.department && (
                  <small className="permanent-pass-field__error">
                    {
                      formErrors.department
                    }
                  </small>
                )}
              </label>

              <label className="permanent-pass-field">
                <span>
                  Holder Type
                  <b>*</b>
                </span>

                <select
                  value={form.holderType}
                  onChange={(event) => {
                    updateField(
                      "holderType",
                      event.target
                        .value as PermanentPassHolderType
                    );
                  }}
                >
                  <option value="EMPLOYEE">
                    Employee
                  </option>

                  <option value="SECURITY">
                    Security
                  </option>

                  <option value="CLEANER">
                    Cleaner
                  </option>

                  <option value="CONTRACTOR">
                    Contractor
                  </option>

                  <option value="TENANT">
                    Tenant
                  </option>

                  <option value="VENDOR">
                    Vendor
                  </option>

                  <option value="OTHER">
                    Other
                  </option>
                </select>
              </label>

              <label className="permanent-pass-field">
                <span>
                  Phone Number
                  <b>*</b>
                </span>

                <input
                  type="tel"
                  value={form.phone}
                  placeholder="+255..."
                  autoComplete="tel"
                  onChange={(event) => {
                    updateField(
                      "phone",
                      event.target.value
                    );
                  }}
                />

                {formErrors.phone && (
                  <small className="permanent-pass-field__error">
                    {formErrors.phone}
                  </small>
                )}
              </label>

              <label className="permanent-pass-field">
                <span>
                  Vehicle Plate Number
                </span>

                <input
                  type="text"
                  value={form.vehiclePlateNumber}
                  placeholder="T 123 DAO"
                  autoComplete="off"
                  onChange={(event) => {
                    updateField(
                      "vehiclePlateNumber",
                      event.target.value.toUpperCase()
                    );
                  }}
                />

                <small>
                  Optional. Register the holder's vehicle for ANPR automatic gate access.
                </small>
              </label>
            </div>
          </div>

          {message && (
            <div
              className="permanent-pass-form__message"
              role="alert"
            >
              {message}
            </div>
          )}

          <footer className="permanent-pass-form__footer">
            <GlassButton
              type="button"
              variant="secondary"
              disabled={
                createMutation.isPending
              }
              onClick={closeDrawer}
            >
              Cancel
            </GlassButton>

            <GlassButton
              type="submit"
              disabled={
                createMutation.isPending
              }
            >
              {createMutation.isPending
                ? "Generating..."
                : "Generate Permanent QR"}
            </GlassButton>
          </footer>
        </form>
      </aside>
    </div>
  );
}

