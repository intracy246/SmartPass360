import { useQuery } from "@tanstack/react-query";
import { getOwnerBuildings } from "../../api/owner-api";
import "./OwnerBuildingsPage.css";

export function OwnerBuildingsPage() {
  const query = useQuery({ queryKey: ["owner-buildings"], queryFn: getOwnerBuildings });
  const buildings = query.data?.data ?? [];
  return (
    <main className="owner-buildings-page">
      <header><div><p>CUSTOMERS</p><h1>Buildings</h1><span>Browse all registered customer buildings and their deployment status.</span></div></header>
      <section className="owner-buildings-grid">
        {query.isPending && <div className="owner-buildings-empty">Loading buildings...</div>}
        {query.isError && <div className="owner-buildings-empty">Building service is unavailable.</div>}
        {buildings.map((building) => <article key={building.id} className="owner-buildings-card"><div><span className={"owner-buildings-status " + building.status.toLowerCase()}>{building.status}</span><strong>{building.code}</strong></div><h2>{building.name}</h2><p>{[building.city, building.country].filter(Boolean).join(", ") || "Location not recorded"}</p><dl><div><dt>Admin username</dt><dd>{building.adminUsername || "—"}</dd></div><div><dt>Organizations</dt><dd>{building.counts.organizations}</dd></div><div><dt>Kiosks</dt><dd>{building.counts.kiosks}</dd></div><div><dt>Activation</dt><dd>{building.mustChangePassword ? "Pending first login" : "Activated"}</dd></div></dl></article>)}
      </section>
    </main>
  );
}
