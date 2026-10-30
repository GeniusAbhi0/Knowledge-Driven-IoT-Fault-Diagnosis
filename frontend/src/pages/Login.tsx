import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout, Field } from "../components/AuthLayout";
import { Spinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../services/api";
import { firstError, validateEmail } from "../utils/validators";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = firstError(validateEmail(email), password ? null : "Password is required");
    if (invalid) return setError(invalid);
    setBusy(true); setError(null);
    try { await login(email.trim(), password); navigate("/"); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Monitor devices and review explainable diagnoses.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy && <Spinner />} Sign in</button>
      </form>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-sky-400 hover:underline">Forgot password?</Link>
        <Link to="/register" className="text-sky-400 hover:underline">Create account</Link>
      </div>
    </AuthLayout>
  );
}
