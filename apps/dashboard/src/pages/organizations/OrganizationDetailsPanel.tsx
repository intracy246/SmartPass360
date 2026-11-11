import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Organization } from "../../types/organization";
import { ApiError } from "../../api/api-client";
import { addOrganizationDepartment, addOrganizationPurpose, deleteOrganizationDepartment, deleteOrganizationPurpose, getOrganizationDepartments, getOrganizationPurposes } from "../../api/organization-catalog-api";

type Props = { organization: Organization; onClose: () => void };

export function OrganizationDetailsPanel({ organization, onClose }: Props) {
  const client = useQueryClient();
  const [departmentName, setDepartmentName] = useState("");
  const [purposeName, setPurposeName] = useState("");
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl ?? "");
  const [message, setMessage] = useState("");
  const departments = useQuery({ queryKey: ["organization-departments", organization.id], queryFn: () => getOrganizationDepartments(organization.id) });
  const purposes = useQuery({ queryKey: ["organization-purposes", organization.id], queryFn: () => getOrganizationPurposes(organization.id) });
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["organization-departments", organization.id] }); await client.invalidateQueries({ queryKey: ["organization-purposes", organization.id] }); };
  const addDepartment = useMutation({ mutationFn: (name: string) => addOrganizationDepartment(organization.id, name), onSuccess: async () => { setDepartmentName(""); setMessage("Department added."); await refresh(); }, onError: e => setMessage(e instanceof ApiError ? e.message : "Could not add department.") });
  const removeDepartment = useMutation({ mutationFn: (id: string) => deleteOrganizationDepartment(organization.id, id), onSuccess: refresh, onError: () => setMessage("Could not delete department.") });
  const addPurpose = useMutation({ mutationFn: (name: string) => addOrganizationPurpose(organization.id, name), onSuccess: async () => { setPurposeName(""); setMessage("Purpose added."); await refresh(); }, onError: e => setMessage(e instanceof ApiError ? e.message : "Could not add purpose.") });
  const removePurpose = useMutation({ mutationFn: (id: string) => deleteOrganizationPurpose(organization.id, id), onSuccess: refresh, onError: () => setMessage("Could not delete purpose.") });
  function submitDepartment(e: FormEvent) { e.preventDefault(); if (departmentName.trim()) addDepartment.mutate(departmentName.trim()); }
  function submitPurpose(e: FormEvent) { e.preventDefault(); if (purposeName.trim()) addPurpose.mutate(purposeName.trim()); }
  return <div className="organization-details-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="organization-details" role="dialog" aria-modal="true" aria-labelledby="organization-details-title">
      <header className="organization-details__header"><div><p>Organization profile</p><h2 id="organization-details-title">{organization.name}</h2><span>{organization.code} · {organization.organizationType}</span></div><button type="button" onClick={onClose} aria-label="Close organization details">×</button></header>
      {message && <p className="organization-details__message" role="status">{message}</p>}
      <div className="organization-details__profile">
        <div className="organization-details__logo">{logoUrl ? <img src={logoUrl} alt={organization.name + " logo"} /> : <span>{organization.shortName || organization.code}</span>}</div>
        <div><strong>Organization information</strong><p>{organization.email || "No email"} · {organization.phone || "No phone"}</p><p>{organization.address || "No address"}{organization.city ? ", " + organization.city : ""}{organization.country ? ", " + organization.country : ""}</p>
        <form className="organization-details__inline-form" onSubmit={e => { e.preventDefault(); setMessage("Logo URL is shown in this panel only until organization profile update is enabled."); }}><label>Organization picture URL<input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></label><small>Image URL preview. Persistent upload/update needs the repository's media-storage endpoint.</small></form></div>
      </div>
      <div className="organization-details__columns">
        <section><h3>Departments</h3><form onSubmit={submitDepartment}><input value={departmentName} onChange={e => setDepartmentName(e.target.value)} placeholder="Department name" maxLength={120} required /><button disabled={addDepartment.isPending}>Add department</button></form>
        {departments.isPending ? <p>Loading departments…</p> : departments.isError ? <p>Unable to load departments.</p> : <ul>{(departments.data?.data ?? []).map(item => <li key={item.id}><span>{item.name}</span><button type="button" onClick={() => { if (window.confirm("Delete " + item.name + "?")) removeDepartment.mutate(item.id); }}>Delete</button></li>)}</ul>}</section>
        <section><h3>Visit purposes</h3><form onSubmit={submitPurpose}><input value={purposeName} onChange={e => setPurposeName(e.target.value)} placeholder="Purpose name" maxLength={120} required /><button disabled={addPurpose.isPending}>Add purpose</button></form>
        {purposes.isPending ? <p>Loading purposes…</p> : purposes.isError ? <p>Unable to load purposes.</p> : <ul>{(purposes.data?.data ?? []).map(item => <li key={item.id}><span>{item.name}{item.isSystem ? " · System option" : ""}</span>{!item.isSystem && <button type="button" onClick={() => { if (window.confirm("Delete " + item.name + "?")) removePurpose.mutate(item.id); }}>Delete</button>}</li>)}</ul>}</section>
      </div>
    </section>
  </div>;
}
