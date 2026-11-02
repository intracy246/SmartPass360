import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { identifyGuard } from "../../api/auth-api";
import { ApiError } from "../../api/api-client";
import { getStoredUser, getToken, saveSession } from "../../auth/session";
import "./LoginPage.css";

export function GuardIdentityPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const token = getToken();
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => identifyGuard(fullName.trim()),
    onSuccess: (response) => {
      saveSession(response.data.token, response.data.user);
      navigate("/", { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setMessage("Your building sign-in has expired or is invalid. Please sign in again.");
      } else {
        setMessage(error instanceof ApiError ? error.message : "Could not start this guard shift.");
      }
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    mutation.mutate();
  }

  if (!token || !currentUser) return <Navigate to="/login" replace />;
  if (currentUser.scope === "OWNER") return <Navigate to="/owner" replace />;
  if (currentUser.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (currentUser.scope !== "BUILDING") return <Navigate to="/login" replace />;
  if (currentUser.guardSessionId) return <Navigate to="/" replace />;

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span>SP</span><div><strong>SMARTPASS360</strong><small>Security shift identification</small></div></div>
        <div><p>GUARD IDENTIFICATION</p><h1>Who is on duty?</h1><span>Enter your full name to start this security shift.</span></div>
        <label><span>Guard full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Enter your full name" minLength={2} maxLength={120} required autoFocus /></label>
        {message && <div className="login-message" role="alert">{message}</div>}
        <button type="submit" disabled={mutation.isPending || fullName.trim().length < 2}>{mutation.isPending ? "Starting shift..." : "Continue to dashboard"}</button>
      </form>
    </main>
  );
}
