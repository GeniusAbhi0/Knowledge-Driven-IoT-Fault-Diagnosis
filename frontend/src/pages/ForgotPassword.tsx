import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, Field } from "../components/AuthLayout";
import { Spinner } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { authApi, errorMessage } from "../services/api";
import { firstError, validateEmail, validateMatch, validatePassword } from "../utils/validators";

/** Handles both steps: request a link (no token) and set a new password (?token=...). */
export default function ForgotPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = token ? firstError(validatePassword(password), validateMatch(password, confirm)) : validateEmail(email);
    if (invalid) return setError(invalid);
    setBusy(true); setError(null);
    try {
      if (token) { await authApi.reset(token, password); toast.push("success", "Password updated. Please sign in."); navigate("/login"); }
      else setMessage((await authApi.forgot(email.trim())).detail);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout title={token ? "Set a new password" : "Reset your password"}
      subtitle={token ? "Choose a new password for your account." : "Enter your email and we'll issue a reset link."}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {token ? (<>
          <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </>) : <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
        <button className="btn w-full" disabled={busy}>{busy && <Spinner />} {token ? "Update password" : "Send reset link"}</button>
      </form>
      <Link to="/login" className="text-sm text-sky-400 hover:underline">Back to sign in</Link>
    </AuthLayout>
  );
}
