import { useQuery } from "@tanstack/react-query";
import { getGuardSessions } from "../../api/auth-api";
import "./UsersPage.css";

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsersPage() {
  const query = useQuery({ queryKey: ["guard-sessions"], queryFn: getGuardSessions, refetchInterval: 15000 });
  const sessions = query.data?.data ?? [];
  const online = sessions.filter((session) => session.isOnline);
  return (
    <main className="users-page">
      <header className="users-page__header">
        <div><p>SECURITY TEAM</p><h1>Users & active guards</h1><span>See which guard is currently using this building account and review recent sign-in sessions.</span></div>
        <button type="button" onClick={() => void query.refetch()}>Refresh</button>
      </header>
      <section className="users-page__stats">
        <article><span>Online now</span><strong>{online.length}</strong></article>
        <article><span>Recorded sessions</span><strong>{sessions.length}</strong></article>
      </section>
      <section className="users-page__panel">
        <div className="users-page__panel-title"><div><h2>Guard activity</h2><span>Presence updates every 15 seconds. A guard is considered online while their session heartbeat is recent.</span></div><span className="users-page__live"><i/> LIVE</span></div>
        {query.isPending && <p className="users-page__empty">Loading guard sessions…</p>}
        {query.isError && <p className="users-page__empty">Could not load guard sessions. Check the connection and refresh.</p>}
        {!query.isPending && !query.isError && sessions.length === 0 && <p className="users-page__empty">No guard sessions have been recorded yet.</p>}
        {sessions.length > 0 && <div className="users-page__table-wrap"><table className="users-page__table"><thead><tr><th>Guard</th><th>Status</th><th>Signed in</th><th>Last activity</th><th>Signed out</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><strong>{session.guardName}</strong><small>{session.username}</small></td><td><span className={session.isOnline ? "users-page__status online" : "users-page__status"}>{session.isOnline ? "Online" : session.loggedOutAt ? "Signed out" : "Inactive"}</span></td><td>{dateTime(session.loginAt)}</td><td>{dateTime(session.lastSeenAt)}</td><td>{session.loggedOutAt ? dateTime(session.loggedOutAt) : "—"}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="users-page__note">Guard names are self-declared for each shift because the building login credentials are shared. This identifies the session but does not independently verify a person's identity.</p>
    </main>
  );
}
