import { useQuery } from "@tanstack/react-query";
import { getGuardShiftLogs } from "../../api/auth-api";
import "./UsersPage.css";

function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export function UsersPage() {
  const query = useQuery({ queryKey: ["guard-shift-logs"], queryFn: getGuardShiftLogs, refetchInterval: 30000 });
  const logs = query.data?.data ?? [];
  return (
    <main className="users-page">
      <header className="users-page__header">
        <div><p>SECURITY SHIFT RECORDS</p><h1>Guard activity</h1><span>Records of who signed in and when each security shift ended.</span></div>
        <button type="button" onClick={() => void query.refetch()}>Refresh</button>
      </header>
      <section className="users-page__stats">
        <article><span>Recorded shifts</span><strong>{logs.length}</strong></article>
        <article><span>Currently signed in</span><strong>{logs.filter((log) => !log.loggedOutAt).length}</strong></article>
      </section>
      <section className="users-page__panel">
        <div className="users-page__panel-title"><div><h2>Shift log</h2><span>Showing the latest 200 shifts for this building.</span></div></div>
        {query.isPending && <p className="users-page__empty">Loading shift records…</p>}
        {query.isError && <p className="users-page__empty">Could not load shift records. Check the connection and refresh.</p>}
        {!query.isPending && !query.isError && logs.length === 0 && <p className="users-page__empty">No guard shifts have been recorded yet.</p>}
        {logs.length > 0 && <div className="users-page__table-wrap"><table className="users-page__table"><thead><tr><th>Guard name</th><th>Sign-in time</th><th>Sign-out time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{log.guardName}</strong></td><td>{dateTime(log.loginAt)}</td><td>{dateTime(log.loggedOutAt)}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
