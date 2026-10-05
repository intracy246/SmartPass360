import {
  useState,
  type FormEvent
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";

import {
  createOrganization,
  getOrganizations
} from "../../api/organization-api";

import { ApiError } from "../../api/api-client";

import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";
import { FormField } from "../../components/Forms/FormField";

import type {
  CreateOrganizationPayload,
  OrganizationType
} from "../../types/organization";

import "./OrganizationsPage.css";

type OrganizationFormState = {
  code: string;
  name: string;
  shortName: string;
  organizationType: OrganizationType;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
};

const initialFormState: OrganizationFormState = {
  code: "",
  name: "",
  shortName: "",
  organizationType: "COMPANY",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  country: ""
};

function formatType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export function OrganizationsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [form, setForm] =
    useState<OrganizationFormState>(
      initialFormState
    );

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ["organizations", search],
    queryFn: () =>
      getOrganizations(search, 1, 20)
  });

  const createMutation = useMutation({
    mutationFn: createOrganization,

    onSuccess(response) {
      setMessage(
        `Organization created: ${response.data.name}`
      );

      setForm(initialFormState);
      setIsFormOpen(false);

      void queryClient.invalidateQueries({
        queryKey: ["organizations"]
      });
    },

    onError(error) {
      if (error instanceof ApiError) {
        setMessage(
          `Unable to create organization: ${error.message}`
        );

        return;
      }

      setMessage(
        "Organization service is unavailable."
      );
    }
  });

  function updateField<
    K extends keyof OrganizationFormState
  >(
    field: K,
    value: OrganizationFormState[K]
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
    setMessage(null);

    if (
      form.code.trim().length < 2 ||
      form.name.trim().length < 3
    ) {
      setMessage(
        "Organization code and name are required."
      );

      return;
    }

    const payload: CreateOrganizationPayload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      shortName:
        form.shortName.trim() || undefined,
      organizationType:
        form.organizationType,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      website:
        form.website.trim() || undefined,
      address:
        form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country:
        form.country.trim() || undefined
    };

    createMutation.mutate(payload);
  }

  const organizations =
    organizationsQuery.data?.data ?? [];

  return (
    <div className="organizations-page">
      <header className="organizations-page__header">
        <div>
          <p className="organizations-page__eyebrow">
            Tenant Administration
          </p>

          <h1>Organizations</h1>

          <p>
            Manage institutions using SmartPass360 and
            their operational identity.
          </p>
        </div>

        <GlassButton
          type="button"
          onClick={() =>
            setIsFormOpen((current) => !current)
          }
        >
          {isFormOpen
            ? "Close Form"
            : "Add Organization"}
        </GlassButton>
      </header>

      {message && (
        <div className="organizations-page__message">
          {message}
        </div>
      )}

      {isFormOpen && (
        <GlassCard
          title="Create organization"
          subtitle="This form submits directly to the live API."
          accent="blue"
        >
          <form
            className="organization-form"
            onSubmit={handleSubmit}
          >
            <div className="organization-form__grid">
              <FormField
                label="Organization code"
                required
                hint="Example: TIA, CRDB, BCU"
                inputProps={{
                  value: form.code,
                  placeholder: "Enter code",
                  onChange: (event) =>
                    updateField(
                      "code",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Organization name"
                required
                inputProps={{
                  value: form.name,
                  placeholder:
                    "Enter full organization name",
                  onChange: (event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Short name"
                inputProps={{
                  value: form.shortName,
                  placeholder: "Optional short name",
                  onChange: (event) =>
                    updateField(
                      "shortName",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Organization type"
                required
                as="select"
                selectProps={{
                  value: form.organizationType,
                  onChange: (event) =>
                    updateField(
                      "organizationType",
                      event.target
                        .value as OrganizationType
                    )
                }}
              >
                <option value="COMPANY">
                  Company
                </option>
                <option value="GOVERNMENT">
                  Government
                </option>
                <option value="UNIVERSITY">
                  University
                </option>
                <option value="HOSPITAL">
                  Hospital
                </option>
                <option value="NGO">
                  NGO
                </option>
                <option value="BANK">
                  Bank
                </option>
                <option value="OTHER">
                  Other
                </option>
              </FormField>

              <FormField
                label="Email"
                inputProps={{
                  type: "email",
                  value: form.email,
                  placeholder:
                    "organization@example.com",
                  onChange: (event) =>
                    updateField(
                      "email",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Phone"
                inputProps={{
                  type: "tel",
                  value: form.phone,
                  placeholder: "+255...",
                  onChange: (event) =>
                    updateField(
                      "phone",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Website"
                inputProps={{
                  type: "url",
                  value: form.website,
                  placeholder:
                    "https://example.com",
                  onChange: (event) =>
                    updateField(
                      "website",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="City"
                inputProps={{
                  value: form.city,
                  placeholder: "Enter city",
                  onChange: (event) =>
                    updateField(
                      "city",
                      event.target.value
                    )
                }}
              />

              <FormField
                label="Country"
                inputProps={{
                  value: form.country,
                  placeholder: "Enter country",
                  onChange: (event) =>
                    updateField(
                      "country",
                      event.target.value
                    )
                }}
              />

              <div className="organization-form__wide">
                <FormField
                  label="Address"
                  as="textarea"
                  textareaProps={{
                    value: form.address,
                    placeholder:
                      "Enter physical address",
                    onChange: (event) =>
                      updateField(
                        "address",
                        event.target.value
                      )
                  }}
                />
              </div>
            </div>

            <div className="organization-form__actions">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm(initialFormState);
                  setMessage(null);
                }}
              >
                Clear
              </GlassButton>

              <GlassButton
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? "Creating..."
                  : "Create Organization"}
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      <GlassCard
        title="Organization directory"
        subtitle="Organizations returned by the SmartPass360 API."
        accent="violet"
      >
        <div className="organizations-toolbar">
          <input
            type="search"
            value={search}
            placeholder="Search organizations..."
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <GlassButton
            type="button"
            variant="secondary"
            onClick={() => {
              void organizationsQuery.refetch();
            }}
          >
            Refresh
          </GlassButton>
        </div>

        {organizationsQuery.isPending && (
          <div className="organizations-state">
            <div className="organizations-state__loader" />
            <strong>Loading organizations</strong>
          </div>
        )}

        {organizationsQuery.isError && (
          <div className="organizations-state">
            <div className="organizations-state__icon">
              !
            </div>

            <strong>
              Organization service unavailable
            </strong>

            <p>
              No sample organizations are being shown.
            </p>
          </div>
        )}

        {organizationsQuery.isSuccess &&
          organizations.length === 0 && (
            <div className="organizations-state">
              <div className="organizations-state__icon">
                ▦
              </div>

              <strong>No organizations found</strong>

              <p>
                Organizations will appear here after they
                are created through the API.
              </p>
            </div>
          )}

        {organizationsQuery.isSuccess &&
          organizations.length > 0 && (
            <div className="organizations-grid">
              {organizations.map(
                (organization) => (
                  <article
                    key={organization.id}
                    className="organization-card"
                  >
                    <div className="organization-card__top">
                      <div className="organization-card__logo">
                        {organization.logoUrl ? (
                          <img
                            src={organization.logoUrl}
                            alt={organization.name}
                          />
                        ) : (
                          organization.shortName ||
                          organization.code
                        )}
                      </div>

                      <span
                        className={[
                          "organization-card__status",
                          organization.isActive
                            ? "organization-card__status--active"
                            : "organization-card__status--inactive"
                        ].join(" ")}
                      >
                        {organization.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <h3>{organization.name}</h3>

                    <p>
                      {formatType(
                        organization.organizationType
                      )}
                    </p>

                    <div className="organization-card__details">
                      <span>
                        Code: {organization.code}
                      </span>

                      <span>
                        {organization.city ||
                          "City not recorded"}
                      </span>

                      <span>
                        {organization.country ||
                          "Country not recorded"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="organization-card__button"
                    >
                      Open Organization
                    </button>
                  </article>
                )
              )}
            </div>
          )}
      </GlassCard>
    </div>
  );
}