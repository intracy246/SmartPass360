import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/api-client";
import { getBuildings } from "../../api/building-api";
import { createKiosk, getKiosks } from "../../api/kiosk-api";
import "./KiosksPage.css";

export function KiosksPage() {
  const queryClient = useQueryClient();
  const buildingsQuery = useQuery({ queryKey: ["buildings"], queryFn: getBuildings });
  const kiosksQuery = useQuery({ queryKey: ["kiosks"], queryFn: getKiosks });
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createKiosk,
    onSuccess: async () => {
      setOpen(false); setName(""); setCode(""); setLocation(""); setMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not register kiosk.")
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const selectedSite = siteId || buildingsQuery.data?.data?.[0]?.id || "";
    if (!selectedSite || !name.trim() || !code.trim()) {
      setMessage("Building, kiosk name and kiosk code are required.");
      return;
    }
    mutation.mutate({ siteId: selectedSite, name: name.trim(), code: code.trim(), location: location.trim() || undefined });
  }

  const buildings = buildingsQuery.data?.data ?? [];
  const kiosks = kiosksQuery.data?.data ?? [];

  return (
    <main className="kiosks-page">
      <header className="kiosks-page__header">
        <div><p>SMARTPASS360 KIOSKS</p><h1>Kiosk Management</h1><span>Register and monitor the real kiosks serving each building.</span></div>
        <button onClick={() => setOpen(true)}>+ Register Kiosk</button>
      </header>

      {(buildingsQuery.isError || kiosksQuery.isError) && <div className="kiosks-page__notice">Kiosk service is unavailable. Confirm the API and database migration are running.</div>}

      <section className="kiosks-page__grid">
        {kiosks.map((kiosk) => (
          <article key={kiosk.id} className="kiosk-card">
            <div><span className={kiosk.isActive ? "status active" : "status"}>{kiosk.isActive ? "ACTIVE" : "INACTIVE"}</span><strong>{kiosk.name}</strong></div>
            <p>{kiosk.site.name}</p>
            <dl><div><dt>Code</dt><dd>{kiosk.code}</dd></div><div><dt>Location</dt><dd>{kiosk.location || "—"}</dd></div><div><dt>Activation code</dt><dd>{kiosk.activationCode}</dd></div><div><dt>Device</dt><dd>{kiosk.deviceId ? "Activated" : "Not activated"}</dd></div></dl>
          </article>
        ))}
        {!kiosksQuery.isPending && !kiosksQuery.isError && kiosks.length === 0 && <div className="kiosks-page__empty">No kiosk has been registered yet. Use Register Kiosk to add the first physical kiosk.</div>}
      </section>

      {open && (
        <div className="kiosk-modal" role="dialog" aria-modal="true">
          <form onSubmit={submit} className="kiosk-modal__card">
            <div className="kiosk-modal__title"><div><p>NEW KIOSK</p><h2>Register Kiosk</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></div>
            <label><span>Building *</span><select value={siteId} onChange={(e) => setSiteId(e.target.value)} required><option value="">Select building</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label><span>Kiosk name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Main Lobby Kiosk" required /></label>
            <label><span>Kiosk code *</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Example: BANDARI-K01" required /></label>
            <label><span>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Example: Ground Floor Reception" /></label>
            {message && <div className="kiosks-page__notice">{message}</div>}
            <div className="kiosk-modal__actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Registering..." : "Register Kiosk"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
