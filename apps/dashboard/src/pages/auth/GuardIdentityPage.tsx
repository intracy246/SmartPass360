import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { identifyGuard } from "../../api/auth-api";
import { ApiError } from "../../api/api-client";
import { getStoredUser, saveSession } from "../../auth/session";
import "./LoginPage.css";

export function GuardIdentityPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => identifyGuard(fullName.trim()),
    onSuccess: (response) => {
      saveSession(response.data.token, response.data.user);
      navigate("/", { replace: true });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not identify this guard session.")
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    mutation.mutate();
  }

  if (!currentUser || currentUser.scope !== "BUILDING" || currentUser.mustChangePassword) {
    return <main className="login-page"><section className="login-card"><h1>Sign in required</h1><p>Please sign in with your building credentials first.</p><button type="button" onClick={() => navigate("/login", { replace: true })}>Back to sign in</button></section></main>;
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span>SP</span><div><strong>SMARTPASS360</strong><small>Security shift identification</small></div></div>
        <div><p>GUARD IDENTIFICATION</p><h1>Who is on duty?</h1><span>Enter your full name for this shift. The shared building account identifies the site; your name identifies this working session.</span></div>
        <label><span>Guard full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Enter your full name" minLength={2} maxLength={120} required autoFocus /></label>
        {message && <div className="login-message" role="alert">{message}</div>}
        <button type="submit" disabled={mutation.isPending || fullName.trim().length < 2}>{mutation.isPending ? "Starting session..." : "Continue to dashboard"}</button>
      </form>
    </main>
  );
}
