import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout, Field } from "../components/AuthLayout";
import { Spinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { errorMessage } from "../services/api";
import { firstError, validateEmail, validateMatch, validateName, validatePassword } from "../utils/validators";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = firstError(validateName(form.name), validateEmail(form.email), validatePassword(form.password), validateMatch(form.password, form.confirm));
    if (invalid) return setError(invalid);
    setBusy(true); setError(null);
    try { await register(form.name.trim(), form.email.trim(), form.password); navigate("/"); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Create account" subtitle="New accounts start as viewers; the first account becomes admin.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="name" label="Name" autoComplete="name" value={form.name} onChange={set("name")} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
        <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy && <Spinner />} Create account</button>
      </form>
      <p className="text-sm text-slate-400">Already registered? <Link to="/login" className="text-sky-400 hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}
