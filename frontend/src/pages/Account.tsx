import { Bell, Bot, Palette, ShieldCheck, SlidersHorizontal, User as UserIcon, Users } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/industrial";
import { EmptyState, ErrorState, Skeleton } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { alertsApi, errorMessage, kbApi, usersApi } from "../services/api";
import type { KnowledgeEntry, Role, UserItem } from "../types";
import { describeRule } from "../components/KnowledgeEditor";

const PERMISSIONS: Record<Role, string[]> = {
  admin: ["Manage users, devices, knowledge base and rules", "Run diagnoses and update faults", "View all reports"],
  engineer: ["View devices and run diagnoses", "Update fault status and add resolution notes", "Control the simulator"],
  viewer: ["View dashboard, devices and diagnoses", "View and export reports"],
};

function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-3"><div><dt className="kpi-label">Name</dt><dd className="text-white">{user.name}</dd></div><div><dt className="kpi-label">Email</dt><dd className="break-all text-white">{user.email}</dd></div><div><dt className="kpi-label">Role</dt><dd className="capitalize text-white">{user.role}</dd></div></dl>
      <div><h3 className="kpi-label mb-1">What you can do</h3><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-300">{PERMISSIONS[user.role].map((p) => <li key={p}>{p}</li>)}</ul></div>
    </div>
  );
}

export function Profile() {
  return <div className="mx-auto max-w-2xl space-y-5"><PageHeader title="Profile" /><section className="card p-5"><ProfileCard /></section></div>;
}

function Users_() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { setUsers(await usersApi.list()); setError(null); } catch (e) { setError(errorMessage(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const change = async (u: UserItem, role: Role) => { try { await usersApi.setRole(u.id, role); toast.push("success", `${u.name} is now ${role}`); await load(); } catch (e) { toast.push("error", errorMessage(e)); } };
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!users) return <Skeleton className="h-32" />;
  return (
    <ul className="divide-y divide-white/5">{users.map((u) => (
      <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div className="min-w-0"><p className="truncate text-sm text-white">{u.name}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div>
        <select className="input w-auto capitalize" aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === user?.id} onChange={(e) => change(u, e.target.value as Role)}>{(["admin", "engineer", "viewer"] as Role[]).map((r) => <option key={r}>{r}</option>)}</select>
      </li>))}</ul>
  );
}

function Thresholds() {
  const { user } = useAuth();
  const [rules, setRules] = useState<KnowledgeEntry[] | null>(null);
  useEffect(() => { kbApi.list().then(setRules).catch(() => setRules([])); }, []);
  if (!rules) return <Skeleton className="h-32" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Sensor thresholds are the conditions of the diagnostic rules below. {user?.role === "admin" ? <>Edit them on the <Link className="text-sky-300 hover:underline" to="/rules">Rules page</Link>.</> : "Ask an administrator to change them."}</p>
      <ul className="divide-y divide-white/5">{rules.map((k) => <li key={k.id} className="py-2"><p className="text-sm text-white">{k.fault_name} <span className="text-xs capitalize text-slate-500">({k.rule?.severity})</span></p><p className="font-mono text-xs text-slate-400">{describeRule(k)}</p></li>)}</ul>
    </div>
  );
}

function Notifications() {
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => { alertsApi.list(true).then((a) => setUnread(a.length)).catch(() => setUnread(null)); }, []);
  return (
    <div className="space-y-2 text-sm text-slate-300">
      <p>An alert is raised automatically for every <b>High</b> or <b>Critical</b> fault, and shown live in the bell menu and as a pop-up.</p>
      <p className="text-slate-400">Per-user delivery preferences (email, SMS) are not available in this version.</p>
      <p>{unread === null ? "" : `You have ${unread} unread alert${unread === 1 ? "" : "s"}.`} <Link className="text-sky-300 hover:underline" to="/alerts">Open alerts</Link></p>
    </div>
  );
}

function AiInfo() {
  return (
    <div className="space-y-2 text-sm text-slate-300">
      <p>The assistant explains diagnoses using stored faults, evidence and the knowledge base. It works without any external AI service.</p>
      <p className="text-slate-400">An administrator can enable optional LLM wording by setting <code className="rounded bg-white/5 px-1">AI_API_KEY</code> on the server. Each answer states whether it was rule-generated or AI-generated.</p>
      <Link className="text-sky-300 hover:underline" to="/assistant">Open the assistant</Link>
    </div>
  );
}

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><label htmlFor={id} className="text-sm text-white">{label}</label><p className="text-xs text-slate-500">{hint}</p></div>
      <input id={id} type="checkbox" role="switch" className="h-5 w-9 cursor-pointer accent-sky-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function Appearance() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("iot.sidebar") === "collapsed");
  const [twin3d, setTwin3d] = useState(() => localStorage.getItem("iot.twin3d") !== "off");
  return (
    <div className="divide-y divide-white/5">
      <Toggle id="sb" label="Start with the sidebar collapsed" hint="Applies the next time the app loads." checked={collapsed} onChange={(v) => { setCollapsed(v); localStorage.setItem("iot.sidebar", v ? "collapsed" : "expanded"); }} />
      <Toggle id="t3" label="3D digital twin" hint="Turn off to always use the lightweight 2D topology." checked={twin3d} onChange={(v) => { setTwin3d(v); localStorage.setItem("iot.twin3d", v ? "on" : "off"); }} />
      <p className="py-3 text-xs text-slate-500">Animations automatically reduce when your device is set to “reduce motion”. These preferences are stored in this browser only.</p>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const sections: { key: string; label: string; icon: typeof UserIcon; node: ReactNode; adminOnly?: boolean }[] = [
    { key: "profile", label: "Profile", icon: UserIcon, node: <ProfileCard /> },
    { key: "users", label: "User management", icon: Users, node: isAdmin ? <Users_ /> : <EmptyState title="Administrators only" hint="Ask an administrator to change roles." /> },
    { key: "thresholds", label: "Sensor thresholds", icon: SlidersHorizontal, node: <Thresholds /> },
    { key: "notifications", label: "Notifications", icon: Bell, node: <Notifications /> },
    { key: "ai", label: "AI settings", icon: Bot, node: <AiInfo /> },
    { key: "security", label: "Security", icon: ShieldCheck, node: <p className="text-sm text-slate-300">Signed in as <b>{user?.email}</b>. Sessions expire automatically and are cleared when you sign out. To change a password, use <Link className="text-sky-300 hover:underline" to="/forgot-password">Forgot password</Link> from the sign-in page.</p> },
    { key: "appearance", label: "Appearance", icon: Palette, node: <Appearance /> },
  ];
  const [active, setActive] = useState("profile");
  const current = sections.find((s) => s.key === active) ?? sections[0];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Settings" subtitle="Account, thresholds, notifications and preferences" />
      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {sections.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActive(key)} aria-current={active === key ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active === key ? "bg-sky-500/10 text-sky-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}><Icon className="h-4 w-4" aria-hidden />{label}</button>))}
        </nav>
        <section className="card p-5" aria-label={current.label}><h2 className="mb-4 font-semibold text-white">{current.label}</h2>{current.node}</section>
      </div>
    </div>
  );
}
