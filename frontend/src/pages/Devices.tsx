import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Modal from "../components/Modal";
import { EmptyState, ErrorState, Skeleton, Spinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useLiveEvents } from "../contexts/LiveContext";
import { useToast } from "../contexts/ToastContext";
import { devicesApi, errorMessage } from "../services/api";
import { DEVICE_TYPES, type Device, type DeviceInput } from "../types";
import { timeAgo } from "../utils/time";

const healthColor = (h: number) => (h >= 80 ? "#34d399" : h >= 50 ? "#fbbf24" : "#f87171");
const EMPTY: DeviceInput = { name: "", type: "Industrial Motor", location: "", sim_interval_s: 5 };

export function validateDevice(f: DeviceInput): string | null {
  if (!f.name.trim()) return "Device name is required";
  if (f.name.length > 120) return "Device name must be 120 characters or fewer";
  if (!Number.isInteger(f.sim_interval_s) || f.sim_interval_s < 1 || f.sim_interval_s > 3600) return "Interval must be a whole number between 1 and 3600 seconds";
  return null;
}

function DeviceForm({ initial, onSaved, onClose }: { initial?: Device; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<DeviceInput>(initial ? { name: initial.name, type: initial.type as DeviceInput["type"], location: initial.location, sim_interval_s: initial.sim_interval_s } : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateDevice(form);
    if (invalid) return setError(invalid);
    setBusy(true); setError(null);
    try {
      const body = { ...form, name: form.name.trim(), location: form.location.trim() };
      if (initial) await devicesApi.update(initial.id, body); else await devicesApi.create(body);
      toast.push("success", initial ? "Device updated" : "Device created");
      onSaved();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? "Edit device" : "Add device"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Name</span>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Motor-001" autoFocus /></label>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Type</span>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DeviceInput["type"] })}>
            {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Location</span>
          <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Plant A, Line 2" /></label>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Simulation interval (seconds)</span>
          <input className="input" type="number" min={1} max={3600} value={form.sim_interval_s} onChange={(e) => setForm({ ...form, sim_interval_s: Number(e.target.value) })} /></label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy && <Spinner />} Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Devices() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  useEffect(() => { setQuery(params.get("q") ?? ""); }, [params]);
  const [editing, setEditing] = useState<Device | "new" | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);

  const load = useCallback(async () => {
    try { setDevices(await devicesApi.list()); setError(null); } catch (err) { setError(errorMessage(err)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useLiveEvents((e) => {
    if (e.type === "tick") setDevices((prev) => prev?.map((d) => (d.id === e.device_id ? { ...d, health_score: e.health_score, status: "online", last_active: new Date().toISOString() } : d)) ?? prev);
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try { await devicesApi.remove(deleting.id); toast.push("success", `${deleting.name} deleted`); setDeleting(null); void load(); }
    catch (err) { toast.push("error", errorMessage(err)); setDeleting(null); }
  };

  if (error && !devices) return <ErrorState message={error} onRetry={load} />;
  const shown = (devices ?? []).filter((d) => `${d.name} ${d.type} ${d.location}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-white">Devices</h1><p className="text-sm text-slate-400">Virtual IoT devices and their health</p></div>
        {isAdmin && <button className="btn" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add device</button>}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
        <input className="input pl-9" placeholder="Search devices" aria-label="Search devices" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!devices ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState title={devices.length ? "No devices match your search" : "No devices yet"} hint={devices.length || !isAdmin ? undefined : "Add your first virtual device to start simulating sensor data."} /></div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <li key={d.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/devices/${d.id}`} className="min-w-0 rounded focus-visible:ring-2">
                  <p className="truncate font-semibold text-white hover:text-sky-300">{d.name}</p>
                  <p className="truncate text-xs text-slate-400">{d.type}{d.location ? ` · ${d.location}` : ""}</p>
                </Link>
                <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${d.status === "online" ? "text-emerald-400" : "text-slate-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${d.status === "online" ? "bg-emerald-400" : "bg-slate-600"}`} aria-hidden />{d.status}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Health</span><span className="text-white">{Math.round(d.health_score)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={`${d.name} health`} aria-valuenow={Math.round(d.health_score)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.health_score}%`, background: healthColor(d.health_score) }} />
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
                <span>{d.last_active ? `Active ${timeAgo(d.last_active)}` : "No data yet"}</span>
                {isAdmin && (
                  <span className="flex gap-1">
                    <button className="btn-ghost p-1.5" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-ghost p-1.5 hover:text-red-300" onClick={() => setDeleting(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-4 w-4" /></button>
                  </span>)}
              </div>
            </li>))}
        </ul>
      )}

      {editing && <DeviceForm initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
      {deleting && (
        <Modal title="Delete device?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-300">This permanently removes <strong>{deleting.name}</strong> with its readings and fault history.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn bg-red-500 hover:bg-red-400" onClick={confirmDelete}>Delete</button>
          </div>
        </Modal>)}
    </div>
  );
}
