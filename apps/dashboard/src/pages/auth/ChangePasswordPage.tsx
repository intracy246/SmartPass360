import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { changeBuildingPassword } from "../../api/auth-api";
import { ApiError } from "../../api/api-client";
import { saveSession } from "../../auth/session";
import "./LoginPage.css";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changeBuildingPassword(currentPassword, newPassword),
    onSuccess: (response) => {
      saveSession(response.data.token, response.data.user);
      navigate("/", { replace: true });
    },
    onError: (error) => setMessage(error instanceof ApiError ? error.message : "Could not change password.")
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) { setMessage("New passwords do not match."); return; }
    if (newPassword.length < 8) { setMessage("New password must have at least 8 characters."); return; }
    mutation.mutate();
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div><p>FIRST SIGN IN</p><h1>Change your password</h1><span>Create the password your building will use from now on.</span></div>
        <label><span>Temporary password</span><input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} required /></label>
        <label><span>New password</span><input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required /></label>
        <label><span>Confirm new password</span><input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required /></label>
        {message && <div className="login-message">{message}</div>}
        <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating..." : "Change Password & Continue"}</button>
      </form>
    </main>
  );
}
