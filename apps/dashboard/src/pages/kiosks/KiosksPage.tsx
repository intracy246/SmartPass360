import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/api-client";
import {
  createKiosk,
  deleteKiosk,
  getKiosks,
  updateKiosk,
  type KioskRecord
} from "../../api/kiosk-api";
import "./KiosksPage.css";

export function KiosksPage() {
  const queryClient = useQueryClient();
  const kiosksQuery = useQuery({ queryKey: ["kiosks"], queryFn: getKiosks });

  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<KioskRecord | null>(null);
  const [editing, setEditing] = useState<KioskRecord | null>(null);
  const [deleting, setDeleting] = useState<KioskRecord | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createKiosk,
    onSuccess: async () => {
      setOpen(false);
      setName("");
      setCode("");
      setLocation("");
      setMessage("Kiosk registered successfully. Use its activation code on the physical kiosk.");
      await queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (error) =>
      setMessage(error instanceof ApiError ? error.message : "Could not register kiosk.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ kioskId, payload }: { kioskId: string; payload: Parameters<typeof updateKiosk>[1] }) =>
      updateKiosk(kioskId, payload),
    onSuccess: async () => {
      setEditing(null);
      setMessage("Kiosk updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (error) =>
      setMessage(error instanceof ApiError ? error.message : "Could not update kiosk.")
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKiosk,
    onSuccess: async () => {
      setDeleting(null);
      setViewing(null);
      setMessage("Kiosk deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (error) =>
      setMessage(error instanceof ApiError ? error.message : "Could not delete kiosk.")
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim() || !code.trim()) {
      setMessage("Kiosk name and kiosk code are required.");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      code: code.trim(),
      location: location.trim() || undefined
    });
  }

  const kiosks = kiosksQuery.data?.data ?? [];

  return (
    <main className="kiosks-page">
      <header className="kiosks-page__header">
        <div>
          <p>SMARTPASS360 KIOSKS</p>
          <h1>Kiosk Management</h1>
          <span>Register and manage physical kiosks assigned to this building.</span>
        </div>
        <button onClick={() => setOpen(true)}>+ Register Kiosk</button>
      </header>

      {message && <div className="kiosks-page__notice">{message}</div>}
      {kiosksQuery.isError && (
        <div className="kiosks-page__notice">
          Kiosk service is unavailable. Confirm the API is running.
        </div>
      )}

      <section className="kiosks-list">
        <div className="kiosks-list__head">
          <span>Kiosk</span>
          <span>Location</span>
          <span>Status</span>
          <span>Device</span>
          <span>Activation code</span>
          <span>Actions</span>
        </div>

        {kiosks.map((kiosk) => (
          <article key={kiosk.id} className="kiosks-list__row">
            <div className="kiosks-list__main">
              <strong>{kiosk.name}</strong>
              <small>{kiosk.code} · {kiosk.site.name}</small>
            </div>
            <span>{kiosk.location || "—"}</span>
            <span className={kiosk.isActive ? "status active" : "status"}>
              {kiosk.isActive ? "ACTIVE" : "INACTIVE"}
            </span>
            <span>{kiosk.deviceId ? "Activated" : "Not activated"}</span>
            <code>{kiosk.activationCode}</code>
            <div className="kiosks-list__actions">
              <button onClick={() => setViewing(kiosk)}>View</button>
              <button className="secondary" onClick={() => setEditing(kiosk)}>Edit</button>
            </div>
          </article>
        ))}

        {!kiosksQuery.isPending && !kiosksQuery.isError && kiosks.length === 0 && (
          <div className="kiosks-page__empty">
            No kiosk has been registered yet. Use Register Kiosk to add the first physical kiosk.
          </div>
        )}
      </section>

      {viewing && (
        <div className="kiosk-drawer">
          <div className="kiosk-drawer__backdrop" onClick={() => setViewing(null)} />
          <aside className="kiosk-drawer__panel">
            <div className="kiosk-modal__title">
              <div>
                <p>KIOSK DETAILS</p>
                <h2>{viewing.name}</h2>
              </div>
              <button type="button" onClick={() => setViewing(null)}>×</button>
            </div>

            <div className="kiosk-detail-grid">
              <div><span>Code</span><strong>{viewing.code}</strong></div>
              <div><span>Status</span><strong>{viewing.isActive ? "ACTIVE" : "INACTIVE"}</strong></div>
              <div><span>Building</span><strong>{viewing.site.name}</strong></div>
              <div><span>Location</span><strong>{viewing.location || "—"}</strong></div>
              <div className="wide"><span>Activation code</span><strong>{viewing.activationCode}</strong></div>
              <div className="wide"><span>Device</span><strong>{viewing.deviceId || "Not activated"}</strong></div>
              <div><span>Activated at</span><strong>{viewing.activatedAt ? new Date(viewing.activatedAt).toLocaleString() : "—"}</strong></div>
              <div><span>Last seen</span><strong>{viewing.lastSeenAt ? new Date(viewing.lastSeenAt).toLocaleString() : "—"}</strong></div>
            </div>

            <div className="kiosk-drawer__actions">
              <button className="secondary" onClick={() => { setEditing(viewing); setViewing(null); }}>Edit kiosk</button>
              <button className="danger" onClick={() => { setDeleting(viewing); setViewing(null); }}>Delete kiosk</button>
            </div>
          </aside>
        </div>
      )}

      {editing && (
        <div className="kiosk-modal" role="dialog" aria-modal="true">
          <form
            className="kiosk-modal__card"
            onSubmit={(event) => {
              event.preventDefault();
              updateMutation.mutate({
                kioskId: editing.id,
                payload: {
                  name: editing.name.trim(),
                  code: editing.code.trim(),
                  location: editing.location?.trim() || null,
                  isActive: editing.isActive
                }
              });
            }}
          >
            <div className="kiosk-modal__title">
              <div><p>EDIT KIOSK</p><h2>Edit Kiosk</h2></div>
              <button type="button" onClick={() => setEditing(null)}>×</button>
            </div>

            <label>
              <span>Kiosk name *</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </label>

            <label>
              <span>Kiosk code *</span>
              <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} required />
            </label>

            <label>
              <span>Location</span>
              <input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
            </label>

            <label className="kiosk-checkbox">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              <span>Kiosk active</span>
            </label>

            <div className="kiosk-modal__actions">
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="kiosk-modal" role="dialog" aria-modal="true">
          <div className="kiosk-modal__card">
            <div className="kiosk-modal__title">
              <div><p>DELETE KIOSK</p><h2>{deleting.name}</h2></div>
              <button type="button" onClick={() => setDeleting(null)}>×</button>
            </div>
            <div className="kiosks-page__notice">
              This removes the kiosk registration from this building. The physical device will no longer be recognized by this kiosk record.
            </div>
            <div className="kiosk-modal__actions">
              <button className="secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)}>
                {deleteMutation.isPending ? "Deleting..." : "Delete kiosk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="kiosk-modal" role="dialog" aria-modal="true">
          <form onSubmit={submit} className="kiosk-modal__card">
            <div className="kiosk-modal__title">
              <div><p>NEW KIOSK</p><h2>Register Kiosk</h2></div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </div>

            <label><span>Kiosk name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Main Lobby Kiosk" required /></label>
            <label><span>Kiosk code *</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Example: BANDARI-K01" required /></label>
            <label><span>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Example: Ground Floor Reception" /></label>

            <div className="kiosk-modal__actions">
              <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Registering..." : "Register Kiosk"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
