import { FileText, Sheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FaultFilterBar, { DEFAULT_FILTERS } from "../components/FaultFilters";
import { LoadingPanel, PageHeader } from "../components/industrial";
import { EmptyState, ErrorState, SEVERITY_COLORS, Spinner, StatCard } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { devicesApi, downloadFile, errorMessage, faultHistoryApi, faultParams } from "../services/api";
import type { Device, FaultFilters, FaultRecord } from "../types";
import { deviceState, STATE_STYLE } from "../utils/deviceState";
import { parseTs } from "../utils/time";

const LIMIT = 200;
const TT = { background: "#0c1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 };
const AX = { fill: "#64748b", fontSize: 10 };

/** Pure summaries of the fetched fault records (also unit-tested). */
export function summarize(items: FaultRecord[]) {
  const count = <T extends string>(keys: T[]) => keys.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});
  const sev = count(items.map((f) => f.severity)), status = count(items.map((f) => f.status)), byFault = count(items.map((f) => f.fault));
  const days = count(items.map((f) => parseTs(f.detected_at).toISOString().slice(0, 10)));
  const resolved = status.resolved ?? 0;
  return {
    total: items.length, resolved, open: (status.detected ?? 0) + (status.investigating ?? 0), critical: sev.critical ?? 0,
    resolutionRate: items.length ? Math.round((resolved / items.length) * 100) : 0,
    severity: (["low", "medium", "high", "critical"] as const).map((s) => ({ name: s, count: sev[s] ?? 0 })),
    faults: Object.entries(byFault).map(([fault, n]) => ({ fault, count: n })).sort((a, b) => b.count - a.count).slice(0, 8),
    statuses: (["detected", "investigating", "resolved", "ignored"] as const).map((s) => ({ name: s, count: status[s] ?? 0 })),
    trend: Object.entries(days).map(([date, n]) => ({ date, count: n })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
  };
}

export default function Reports() {
  const toast = useToast();
  const [filters, setFilters] = useState<FaultFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<{ items: FaultRecord[]; total: number } | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { devicesApi.list().then(setDevices).catch(() => undefined); }, []);
  useEffect(() => {
    setData(null);
    faultHistoryApi.page({ ...faultParams(filters), limit: LIMIT }).then((d) => { setData(d); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, [filters]);
  const sum = useMemo(() => summarize(data?.items ?? []), [data]);

  const get = async (ext: "csv" | "pdf") => {
    setBusy(ext);
    try { await downloadFile(`/reports/faults.${ext}`, faultParams(filters), `fault-report.${ext}`); toast.push("success", `${ext.toUpperCase()} report downloaded`); }
    catch (e) { toast.push("error", errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Reports" subtitle="Fault statistics for the selected filters, with PDF and CSV export"
        actions={<div className="flex gap-2">
          <button className="btn" disabled={busy !== null} onClick={() => get("pdf")}>{busy === "pdf" ? <Spinner /> : <FileText className="h-4 w-4" aria-hidden />} Generate report</button>
          <button className="btn-ghost border border-white/10" disabled={busy !== null} onClick={() => get("csv")}>{busy === "csv" ? <Spinner /> : <Sheet className="h-4 w-4" aria-hidden />} Export CSV</button></div>} />
      <FaultFilterBar value={filters} onChange={setFilters} showSort={false} />

      {error ? <ErrorState message={error} onRetry={() => setFilters({ ...filters })} /> : !data ? <LoadingPanel message="Compiling report data…" /> : data.items.length === 0 ? <div className="card"><EmptyState title="No faults match these filters" hint="Change the filters, or run a simulation to generate faults." /></div> : (<>
        {data.total > LIMIT && <p className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">Charts summarise the {LIMIT} most recent of {data.total} matching records. Exports include all matching records.</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Faults" value={sum.total} icon={<FileText className="h-5 w-5" />} accent="#38bdf8" hint="Matching the filters" />
          <StatCard label="Open" value={sum.open} icon={<FileText className="h-5 w-5" />} tone="text-amber-400" accent="#fbbf24" hint="Detected or investigating" />
          <StatCard label="Critical" value={sum.critical} icon={<FileText className="h-5 w-5" />} tone="text-red-400" accent="#f87171" hint="Highest severity" />
          <StatCard label="Resolution rate" value={sum.resolutionRate} suffix="%" icon={<FileText className="h-5 w-5" />} tone="text-emerald-400" accent="#34d399" hint={`${sum.resolved} resolved`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="card p-4"><figcaption className="mb-2 text-sm font-semibold text-slate-200">Severity distribution</figcaption>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={sum.severity} margin={{ left: -20, right: 4 }}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="name" tick={AX} /><YAxis allowDecimals={false} tick={AX} /><Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>{sum.severity.map((s) => <Cell key={s.name} fill={SEVERITY_COLORS[s.name]} />)}</Bar></BarChart></ResponsiveContainer></div></figure>
          <figure className="card p-4"><figcaption className="mb-2 text-sm font-semibold text-slate-200">Faults by type</figcaption>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={sum.faults} layout="vertical" margin={{ left: 0, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={AX} /><YAxis type="category" dataKey="fault" width={110} tick={AX} /><Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} /><Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></figure>
          <figure className="card p-4"><figcaption className="mb-2 text-sm font-semibold text-slate-200">Resolution status</figcaption>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={sum.statuses} margin={{ left: -20, right: 4 }}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="name" tick={AX} /><YAxis allowDecimals={false} tick={AX} /><Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>{sum.statuses.map((s) => <Cell key={s.name} fill={s.name === "resolved" ? "#34d399" : s.name === "ignored" ? "#64748b" : s.name === "investigating" ? "#38bdf8" : "#fbbf24"} />)}</Bar></BarChart></ResponsiveContainer></div></figure>
          <figure className="card p-4"><figcaption className="mb-2 text-sm font-semibold text-slate-200">Fault trend (last 14 active days)</figcaption>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={sum.trend} margin={{ left: -20, right: 4 }}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" tick={AX} tickFormatter={(d: string) => d.slice(5)} /><YAxis allowDecimals={false} tick={AX} /><Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} /><Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></figure>
        </div>
        {devices.length > 0 && <section className="card p-4"><h2 className="mb-3 text-sm font-semibold text-slate-200">Device health</h2>
          <ul className="grid gap-3 sm:grid-cols-2">{devices.map((d) => { const st = deviceState(d); return (
            <li key={d.id}><div className="mb-1 flex justify-between text-sm"><span className="truncate">{d.name}</span><span className="tabular-nums text-slate-400">{Math.round(d.health_score)}%</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full" style={{ width: `${d.health_score}%`, background: STATE_STYLE[st].hex }} /></div></li>); })}</ul></section>}
      </>)}
    </div>
  );
}
