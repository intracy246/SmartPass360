import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/api-client";
import { getOwnerBuildings, provisionBuilding } from "../../api/owner-api";
import { clearSession } from "../../auth/session";
import "./OwnerDashboardPage.css";

export function OwnerDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const buildingsQuery = useQuery({ queryKey: ["owner-buildings"], queryFn: getOwnerBuildings });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", address: "", city: "", country: "Tanzania",
    adminUsername: "", temporaryPassword: ""
  });

  const mutation = useMutation({
    mutationFn: provisionBuilding,
    onSuccess: async (response) => {
      setMessage(`Building provisioned: ${response.data.name}. Share the username and temporary password with the customer.`);
      setOpen(false);
      setForm({ name:"", code:"", address:"", city:"", country:"Tanzania", adminUsername:"", temporaryPassword:"" });
      await queryClient.invalidateQueries({ queryKey: ["owner-buildings"] });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not register building.")
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      adminUsername: form.adminUsername.trim(),
      temporaryPassword: form.temporaryPassword
    });
  }

  const buildings = buildingsQuery.data?.data ?? [];
  const active = buildings.filter((b) => b.status === "ACTIVE").length;
  const pending = buildings.filter((b) => b.status === "PENDING").length;
  const kiosks = buildings.reduce((sum,b)=>sum+b.counts.kiosks,0);
  const organizations = buildings.reduce((sum,b)=>sum+b.counts.organizations,0);

  return (
    <main className="owner-page">
      <header className="owner-header">
        <div>
          <p>SMARTCYCLE SOLUTIONS</p>
          <h1>SmartPass360 Owner Dashboard</h1>
          <span>Provision customer buildings and monitor SmartPass360 deployments.</span>
        </div>
        <div className="owner-actions">
          <button className="secondary" onClick={()=>{clearSession();navigate("/login",{replace:true});}}>Sign out</button>
          <button onClick={()=>setOpen(true)}>+ Register Building</button>
        </div>
      </header>

      <section className="owner-stats">
        <article><span>Total buildings</span><strong>{buildings.length}</strong></article>
        <article><span>Active buildings</span><strong>{active}</strong></article>
        <article><span>Pending activation</span><strong>{pending}</strong></article>
        <article><span>Kiosks / Organizations</span><strong>{kiosks} / {organizations}</strong></article>
      </section>

      {message && <div className="owner-message">{message}</div>}

      <section className="owner-panel">
        <div className="owner-panel__title"><div><p>CUSTOMERS</p><h2>Registered Buildings</h2></div><button className="secondary" onClick={()=>buildingsQuery.refetch()}>Refresh</button></div>
        {buildingsQuery.isPending && <div className="owner-empty">Loading buildings...</div>}
        {buildingsQuery.isError && <div className="owner-empty">Building service is unavailable.</div>}
        {!buildingsQuery.isPending && !buildingsQuery.isError && buildings.length===0 && <div className="owner-empty">No customer building has been registered yet.</div>}
        <div className="owner-grid">
          {buildings.map((building)=>(
            <article className="owner-building" key={building.id}>
              <div className="owner-building__top"><span className={`badge ${building.status.toLowerCase()}`}>{building.status}</span><strong>{building.code}</strong></div>
              <h3>{building.name}</h3>
              <p>{[building.city,building.country].filter(Boolean).join(", ") || "Location not recorded"}</p>
              <dl>
                <div><dt>Username</dt><dd>{building.adminUsername || "—"}</dd></div>
                <div><dt>Organizations</dt><dd>{building.counts.organizations}</dd></div>
                <div><dt>Kiosks</dt><dd>{building.counts.kiosks}</dd></div>
                <div><dt>Password change</dt><dd>{building.mustChangePassword ? "Required" : "Completed"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {open && (
        <div className="owner-modal">
          <form className="owner-modal__card" onSubmit={submit}>
            <div className="owner-modal__title"><div><p>NEW CUSTOMER</p><h2>Register Building</h2></div><button type="button" className="icon" onClick={()=>setOpen(false)}>×</button></div>
            <div className="owner-form-grid">
              <label><span>Building name *</span><input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></label>
              <label><span>Building code *</span><input required value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="BANDARI" /></label>
              <label><span>Admin username *</span><input required value={form.adminUsername} onChange={(e)=>setForm({...form,adminUsername:e.target.value})} /></label>
              <label><span>Temporary password *</span><input required type="password" minLength={8} value={form.temporaryPassword} onChange={(e)=>setForm({...form,temporaryPassword:e.target.value})} /></label>
              <label><span>City</span><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} /></label>
              <label><span>Country</span><input value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})} /></label>
              <label className="wide"><span>Address</span><textarea value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} /></label>
            </div>
            <p className="owner-note">The customer will sign in with this username and temporary password, then SmartPass360 will force a password change before opening the building dashboard.</p>
            {message && <div className="owner-message">{message}</div>}
            <div className="owner-modal__actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancel</button><button disabled={mutation.isPending}>{mutation.isPending?"Registering...":"Register Building"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
