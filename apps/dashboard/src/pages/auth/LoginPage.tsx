import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth-api";
import { ApiError } from "../../api/api-client";
import { saveSession } from "../../auth/session";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: (response) => {
      saveSession(response.data.token, response.data.user);
      if (response.data.user.scope === "OWNER") {
        navigate("/owner", { replace: true });
        return;
      }
      if (response.data.user.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }
      navigate("/", { replace: true });
    },
    onError: (error) => {
      setMessage(error instanceof ApiError ? error.message : "Login service is unavailable.");
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    mutation.mutate();
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span>SP</span><div><strong>SMARTPASS360</strong><small>SmartCycle Solutions</small></div></div>
        <div><p>SECURE ACCESS</p><h1>Sign in</h1><span>Use the credentials issued for your SmartPass360 account.</span></div>
        <label><span>Username</span><input value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" required /></label>
        <label><span>Password</span><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {message && <div className="login-message">{message}</div>}
        <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
