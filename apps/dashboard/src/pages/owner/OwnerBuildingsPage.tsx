import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/api-client";
import {
  deleteOwnerBuilding,
  getOwnerBuildings,
  resetOwnerBuildingCredentials,
  updateOwnerBuilding,
  type OwnerBuilding
} from "../../api/owner-api";
import "./OwnerBuildingsPage.css";

export function OwnerBuildingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["owner-buildings"], queryFn: getOwnerBuildings });
  const buildings = query.data?.data ?? [];

  const [selected, setSelected] = useState<OwnerBuilding | null>(null);
  const [editing, setEditing] = useState<OwnerBuilding | null>(null);
  const [deleting, setDeleting] = useState<OwnerBuilding | null>(null);
  const [resetting, setResetting] = useState<OwnerBuilding | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState({ adminUsername: "", temporaryPassword: "" });

  const sortedBuildings = useMemo(
    () => [...buildings].sort((a, b) => a.name.localeCompare(b.name)),
    [buildings]
  );

  const updateMutation = useMutation({
    mutationFn: ({ siteId, payload }: { siteId: string; payload: Parameters<typeof updateOwnerBuilding>[1] }) =>
      updateOwnerBuilding(siteId, payload),
    onSuccess: async () => {
      setEditing(null);
      setMessage("Building updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["owner-buildings"] });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not update building.")
  });

  const resetMutation = useMutation({
    mutationFn: ({ siteId, payload }: { siteId: string; payload: { adminUsername: string; temporaryPassword: string } }) =>
      resetOwnerBuildingCredentials(siteId, payload),
    onSuccess: async () => {
      setResetting(null);
      setCredentialForm({ adminUsername: "", temporaryPassword: "" });
      setMessage("Building username and temporary password were reset. The customer must change the password on next login.");
      await queryClient.invalidateQueries({ queryKey: ["owner-buildings"] });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not reset building credentials.")
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOwnerBuilding,
    onSuccess: async () => {
      setDeleting(null);
      setSelected(null);
      setMessage("Building deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["owner-buildings"] });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not delete building.")
  });

  return (
    <main className="owner-buildings-page">
      <header className="owner-buildings-header">
        <div>
          <p>CUSTOMERS</p>
          <h1>Buildings</h1>
          <span>Manage customer buildings, credentials, activation and deployment details.</span>
        </div>
        <Link className="owner-buildings__primary" to="/owner">+ Register Building</Link>
      </header>

      {message && <div className="owner-buildings-message">{message}</div>}

      <section className="owner-buildings-list">
        <div className="owner-buildings-list__head">
          <span>Building</span>
          <span>Admin username</span>
          <span>Status</span>
          <span>Organizations</span>
          <span>Kiosks</span>
          <span>Actions</span>
        </div>

        {query.isPending && <div className="owner-buildings-empty">Loading buildings...</div>}
        {query.isError && <div className="owner-buildings-empty">Building service is unavailable.</div>}
        {!query.isPending && !query.isError && sortedBuildings.length === 0 && (
          <div className="owner-buildings-empty">No customer building has been registered yet.</div>
        )}

        {sortedBuildings.map((building) => (
          <article key={building.id} className="owner-buildings-row">
            <div className="owner-buildings-main">
              <strong>{building.name}</strong>
              <small>{building.code} · {[building.city, building.country].filter(Boolean).join(", ") || "Location not recorded"}</small>
            </div>
            <span>{building.adminUsername || "—"}</span>
            <span className={"owner-buildings-status " + building.status.toLowerCase()}>{building.status}</span>
            <span>{building.counts.organizations}</span>
            <span>{building.counts.kiosks}</span>
            <div className="owner-buildings-actions">
              <button onClick={() => setSelected(building)}>View</button>
              <button className="secondary" onClick={() => setEditing(building)}>Edit</button>
            </div>
          </article>
        ))}
      </section>

      {selected && (
        <div className="owner-building-drawer">
          <div className="owner-building-drawer__backdrop" onClick={() => setSelected(null)} />
          <aside className="owner-building-drawer__panel">
            <div className="owner-building-drawer__title">
              <div>
                <p>BUILDING DETAILS</p>
                <h2>{selected.name}</h2>
                <span>{selected.code}</span>
              </div>
              <button className="icon" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="owner-building-detail-grid">
              <div><span>Status</span><strong>{selected.status}</strong></div>
              <div><span>Enabled</span><strong>{selected.isActive ? "Yes" : "No"}</strong></div>
              <div><span>Username</span><strong>{selected.adminUsername || "—"}</strong></div>
              <div><span>Password change</span><strong>{selected.mustChangePassword ? "Required" : "Completed"}</strong></div>
              <div><span>Organizations</span><strong>{selected.counts.organizations}</strong></div>
              <div><span>Kiosks</span><strong>{selected.counts.kiosks}</strong></div>
              <div className="wide"><span>Address</span><strong>{selected.address || "Not recorded"}</strong></div>
              <div><span>City</span><strong>{selected.city || "—"}</strong></div>
              <div><span>Country</span><strong>{selected.country || "—"}</strong></div>
            </div>

            <section className="owner-building-orgs">
              <div className="owner-building-section-title">
                <div><p>ORGANIZATIONS</p><h3>Organizations in this building</h3></div>
              </div>
              {(selected.organizations ?? []).length === 0 ? (
                <div className="owner-buildings-empty">No organizations linked to this building.</div>
              ) : (
                <div className="owner-building-org-list">
                  {(selected.organizations ?? []).map((organization) => (
                    <div key={organization.id}>
                      <strong>{organization.name}</strong>
                      <span>{organization.code} · {organization.organizationType}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="owner-building-drawer__actions">
              <button className="secondary" onClick={() => { setEditing(selected); setSelected(null); }}>Edit building</button>
              <button className="warning" onClick={() => {
                setCredentialForm({
                  adminUsername: selected.adminUsername || "",
                  temporaryPassword: ""
                });
                setResetting(selected);
                setSelected(null);
              }}>Reset username & password</button>
              <button className="danger" onClick={() => { setDeleting(selected); setSelected(null); }}>Delete building</button>
            </div>
          </aside>
        </div>
      )}

      {editing && (
        <div className="owner-buildings-modal">
          <form className="owner-buildings-modal__card" onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate({
              siteId: editing.id,
              payload: {
                name: editing.name,
                code: editing.code,
                address: editing.address ?? null,
                city: editing.city ?? null,
                country: editing.country ?? null,
                adminUsername: editing.adminUsername ?? null,
                status: editing.status,
                isActive: editing.isActive
              }
            });
          }}>
            <div className="owner-building-drawer__title">
              <div><p>EDIT CUSTOMER</p><h2>Edit Building</h2></div>
              <button type="button" className="icon" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="owner-buildings-form-grid">
              <label><span>Building name</span><input value={editing.name} onChange={(e)=>setEditing({...editing,name:e.target.value})} required /></label>
              <label><span>Building code</span><input value={editing.code} onChange={(e)=>setEditing({...editing,code:e.target.value.toUpperCase()})} required /></label>
              <label><span>Admin username</span><input value={editing.adminUsername || ""} onChange={(e)=>setEditing({...editing,adminUsername:e.target.value})} /></label>
              <label><span>Status</span><select value={editing.status} onChange={(e)=>setEditing({...editing,status:e.target.value as OwnerBuilding["status"]})}><option value="PENDING">PENDING</option><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option></select></label>
              <label><span>City</span><input value={editing.city || ""} onChange={(e)=>setEditing({...editing,city:e.target.value})} /></label>
              <label><span>Country</span><input value={editing.country || ""} onChange={(e)=>setEditing({...editing,country:e.target.value})} /></label>
              <label className="wide"><span>Address</span><textarea value={editing.address || ""} onChange={(e)=>setEditing({...editing,address:e.target.value})} /></label>
              <label className="owner-buildings-checkbox wide"><input type="checkbox" checked={editing.isActive} onChange={(e)=>setEditing({...editing,isActive:e.target.checked})} /><span>Building enabled</span></label>
            </div>
            <div className="owner-buildings-modal__actions"><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancel</button><button disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save changes"}</button></div>
          </form>
        </div>
      )}

      {resetting && (
        <div className="owner-buildings-modal">
          <form className="owner-buildings-modal__card" onSubmit={(event) => {
            event.preventDefault();
            resetMutation.mutate({
              siteId: resetting.id,
              payload: credentialForm
            });
          }}>
            <div className="owner-building-drawer__title">
              <div><p>ACCOUNT RECOVERY</p><h2>Reset Building Login</h2><span>{resetting.name}</span></div>
              <button type="button" className="icon" onClick={() => setResetting(null)}>×</button>
            </div>
            <div className="owner-buildings-form-grid single">
              <label><span>New username</span><input value={credentialForm.adminUsername} onChange={(e)=>setCredentialForm({...credentialForm,adminUsername:e.target.value})} required /></label>
              <label><span>New temporary password</span><input type="password" minLength={8} value={credentialForm.temporaryPassword} onChange={(e)=>setCredentialForm({...credentialForm,temporaryPassword:e.target.value})} required /></label>
            </div>
            <p className="owner-buildings-note">This resets the building login. The new password is stored only as a secure hash, and the building user will be forced to change it on next login.</p>
            <div className="owner-buildings-modal__actions"><button type="button" className="secondary" onClick={()=>setResetting(null)}>Cancel</button><button className="warning" disabled={resetMutation.isPending}>{resetMutation.isPending ? "Resetting..." : "Reset login"}</button></div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="owner-buildings-modal">
          <div className="owner-buildings-modal__card">
            <div className="owner-building-drawer__title"><div><p>DELETE BUILDING</p><h2>{deleting.name}</h2></div></div>
            <p className="owner-buildings-note">Deletion is blocked when the building still has linked organizations or kiosks. This prevents accidental removal of customer data.</p>
            <div className="owner-buildings-modal__actions"><button className="secondary" onClick={()=>setDeleting(null)}>Cancel</button><button className="danger" disabled={deleteMutation.isPending} onClick={()=>deleteMutation.mutate(deleting.id)}>{deleteMutation.isPending ? "Deleting..." : "Delete building"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
