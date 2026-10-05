import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOwnerBuildings } from "../../api/owner-api";
import "./OwnerOrganizationsPage.css";

export function OwnerOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [buildingId, setBuildingId] = useState("all");
  const buildingsQuery = useQuery({ queryKey: ["owner-buildings"], queryFn: getOwnerBuildings });
  const buildings = buildingsQuery.data?.data ?? [];
  const rows = useMemo(() => buildings.flatMap((building) => (building.organizations ?? []).map((organization) => ({ building, organization }))).filter(({ building, organization }) => {
    if (buildingId !== "all" && building.id !== buildingId) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [organization.name, organization.code, organization.shortName, organization.organizationType, building.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
  }), [buildings, buildingId, search]);
  return (
    <main className="owner-org-page">
      <header><div><p>PLATFORM DIRECTORY</p><h1>Organizations</h1><span>View every organization grouped under its customer building.</span></div></header>
      <section className="owner-org-toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organization, code, type or building" />
        <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}><option value="all">All buildings</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select>
      </section>
      <section className="owner-org-panel">
        {buildingsQuery.isPending && <div className="owner-org-empty">Loading organizations...</div>}
        {buildingsQuery.isError && <div className="owner-org-empty">Organization service is unavailable.</div>}
        {!buildingsQuery.isPending && !buildingsQuery.isError && rows.length === 0 && <div className="owner-org-empty">No organizations match the current filters.</div>}
        <div className="owner-org-table">
          <div className="owner-org-row owner-org-row--head"><span>Organization</span><span>Building</span><span>Type</span><span>Contact</span><span>Status</span></div>
          {rows.map(({ building, organization }) => <div className="owner-org-row" key={building.id + ":" + organization.id}><div><strong>{organization.name}</strong><small>{organization.code}{organization.shortName ? " · " + organization.shortName : ""}</small></div><div><strong>{building.name}</strong><small>{building.code}</small></div><span>{organization.organizationType}</span><div><strong>{organization.email || "—"}</strong><small>{organization.phone || "No phone"}</small></div><span>{organization.isActive ? "Active" : "Inactive"}</span></div>)}
        </div>
      </section>
    </main>
  );
}
