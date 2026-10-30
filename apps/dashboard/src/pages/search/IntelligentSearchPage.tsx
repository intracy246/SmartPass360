import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchPeople, type IntelligentSearchResult } from "../../api/visitor-api";
import "./IntelligentSearchPage.css";

function displayDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

export function IntelligentSearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const results = useQuery({
    queryKey: ["intelligent-people-search", query],
    queryFn: () => searchPeople(query),
    enabled: query.trim().length >= 2,
    staleTime: 15_000
  });
  const records = useMemo(() => results.data?.data ?? [], [results.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
  }

  return (
    <main className="intelligent-search">
      <header className="intelligent-search__heading">
        <p>ACCESS INTELLIGENCE</p>
        <h1>Intelligent Search</h1>
        <span>Search visitor and permanent-pass records by name, phone, company, department, office, organization, host, pass number, vehicle registration and recorded purpose.</span>
      </header>
      <form className="intelligent-search__form" onSubmit={submit}>
        <input value={input} onChange={event => setInput(event.target.value)} minLength={2} maxLength={120}
          placeholder="Name, phone, company, department, plate, pass number…" aria-label="Search records" />
        <button type="submit" disabled={input.trim().length < 2 || results.isFetching}>Search</button>
      </form>
      {query ? <p className="intelligent-search__meta">{results.isFetching ? "Searching this building…" : results.data ? results.data.meta.total + " matching records" : ""}</p> : <p className="intelligent-search__meta">Enter at least two characters. Search results are restricted to the signed-in building.</p>}
      {results.isError ? <div className="intelligent-search__state error" role="alert">{results.error instanceof Error ? `${results.error.message}${"status" in results.error ? ` (HTTP ${results.error.status})` : ""}` : "Search failed."}</div> : null}
      {results.isPending && query ? <div className="intelligent-search__state">Loading records…</div> : null}
      {results.isSuccess && records.length === 0 ? <div className="intelligent-search__state">No matching records were found in this building.</div> : null}
      <section className="intelligent-search__results">
        {records.map((record: IntelligentSearchResult) => (
          <article className="intelligent-search__card" key={record.recordType + record.id}>
            <div className="intelligent-search__cardtop">
              <div><h2>{record.fullName}</h2><span>{record.recordType === "VISITOR" ? "Visitor record" : record.recordType === "ORGANIZATION" ? "Organization record" : "Permanent pass holder"}</span></div>
              <strong>{record.status.replaceAll("_", " ")}</strong>
            </div>
            <div className="intelligent-search__grid">
              <div><label>Phone</label><span>{record.phone || "—"}</span></div>
              <div><label>Company</label><span>{record.company || "—"}</span></div>
              <div><label>Organization</label><span>{record.organizationName || "—"}</span></div>
              <div><label>Department / Office</label><span>{record.department || "—"}</span></div>
              <div><label>Host / Position</label><span>{record.hostName || "—"}</span></div>
              <div><label>Vehicle registration</label><span>{record.vehicleNumber || "—"}</span></div>
              <div><label>Pass number</label><span>{record.passNumber || "—"}</span></div>
              <div><label>Last activity</label><span>{displayDate(record.lastActivityAt)}</span></div>
              <div><label>Purpose</label><span>{record.purpose || "—"}</span></div>
              <div><label>Created</label><span>{displayDate(record.createdAt)}</span></div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
