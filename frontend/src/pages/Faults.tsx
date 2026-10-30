import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FaultFilterBar, { DEFAULT_FILTERS } from "../components/FaultFilters";
import { LoadingPanel, PageHeader } from "../components/industrial";
import { EmptyState, ErrorState, SEVERITY_COLORS, SeverityBadge } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { devicesApi, downloadFile, errorMessage, faultHistoryApi, faultParams } from "../services/api";
import type { FaultFilters, FaultRecord } from "../types";
import { clock, parseTs } from "../utils/time";

const PAGE = 15;

export function dayLabel(ts: string, now = new Date()): string {
  const d = parseTs(ts), start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}
export function groupByDay(items: FaultRecord[], now = new Date()): { label: string; items: FaultRecord[] }[] {
  const out: { label: string; items: FaultRecord[] }[] = [];
  for (const f of items) { const label = dayLabel(f.detected_at, now); const last = out[out.length - 1]; if (last?.label === label) last.items.push(f); else out.push({ label, items: [f] }); }
  return out;
}

export default function Faults() {
  const toast = useToast();
  const [filters, setFilters] = useState<FaultFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{ items: FaultRecord[]; total: number } | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { devicesApi.list().then((d) => setNames(Object.fromEntries(d.map((x) => [x.id, x.name])))).catch(() => undefined); }, []);
  const load = useCallback(async () => {
    try { setData(await faultHistoryApi.page({ ...faultParams(filters), skip: page * PAGE, limit: PAGE })); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [filters, page]);
  useEffect(() => { void load(); }, [load]);

  const exportAs = (ext: "csv" | "pdf") => downloadFile(`/reports/faults.${ext}`, faultParams(filters), `fault-history.${ext}`).catch((e) => toast.push("error", errorMessage(e)));
  const visible = useMemo(() => (data?.items ?? []).filter((f) => !search || `${f.fault} ${names[f.device_id] ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search, names]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Fault history" subtitle={data ? `${data.total} record${data.total === 1 ? "" : "s"}` : "Loading…"}
        actions={<div className="flex gap-2"><button className="btn-ghost border border-white/10" onClick={() => exportAs("csv")}><Download className="h-4 w-4" aria-hidden /> CSV</button><button className="btn-ghost border border-white/10" onClick={() => exportAs("pdf")}><Download className="h-4 w-4" aria-hidden /> PDF</button></div>} />
      <FaultFilterBar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
        <input className="input pl-9" placeholder="Search this page by fault or device" aria-label="Search faults on this page" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      {error && !data ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingPanel message="Loading fault history…" />
        : visible.length === 0 ? <div className="card"><EmptyState title="No faults match" hint="Adjust the filters, or run a simulation to generate faults." tone="ok" /></div> : (
        <div className="space-y-6">{groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h2 className="kpi-label mb-3">{g.label}</h2>
            <ol className="relative space-y-3 border-l border-white/10 pl-6">{g.items.map((f) => {
              const resolved = f.status === "resolved", color = resolved ? "#34d399" : SEVERITY_COLORS[f.severity], expanded = open.has(f.id);
              return (
                <li key={f.id} className="relative">
                  <span className={`absolute -left-[1.95rem] top-3 h-3 w-3 rounded-full ring-4 ring-ink-950 ${f.severity === "critical" && !resolved ? "animate-pulse-soft" : ""}`} style={{ background: color }} aria-hidden />
                  <div className="card card-hover p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 tabular-nums">{clock(f.detected_at)} · {names[f.device_id] ?? `Device #${f.device_id}`}</p>
                        <Link to={`/faults/${f.id}`} className="font-medium text-white hover:text-sky-300">{resolved ? `${f.fault} resolved` : f.fault}</Link>
                      </div>
                      <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{f.confidence}%</span><SeverityBadge severity={f.severity} />
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ring-1 ring-inset ${resolved ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-white/5 text-slate-300 ring-white/10"}`}>{f.status}</span></div>
                    </div>
                    <button className="mt-2 flex items-center gap-1 text-xs text-sky-300 hover:underline" onClick={() => toggle(f.id)} aria-expanded={expanded}>
                      <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />{expanded ? "Hide details" : "Show details"}</button>
                    {expanded && (
                      <div className="mt-2 space-y-2 border-t border-white/[.06] pt-2 text-sm">
                        <p className="text-slate-400">{f.summary}</p>
                        <ul className="space-y-0.5">{f.evidence.map((e) => <li key={`${e.sensor}${e.op}${e.threshold}`} className="text-slate-300"><span className="text-emerald-400">✓</span> <span className="capitalize">{e.sensor}</span> {e.value} <span className="text-slate-500">({e.op} {e.threshold})</span></li>)}</ul>
                        {f.resolution_notes && <p className="rounded bg-white/[.03] p-2 text-slate-300"><span className="text-xs text-slate-500">Resolution notes: </span>{f.resolution_notes}</p>}
                        <Link to={`/faults/${f.id}`} className="inline-block text-sky-300 hover:underline">Open full diagnosis →</Link>
                      </div>)}
                  </div>
                </li>);
            })}</ol>
          </section>))}</div>)}

      <nav className="flex items-center justify-between text-sm text-slate-400" aria-label="Pagination">
        <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /> Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4" aria-hidden /></button>
      </nav>
    </div>
  );
}
