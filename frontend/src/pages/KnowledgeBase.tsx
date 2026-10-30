import { ChevronDown, Network, Pencil, Plus, Search, Trash2, LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import KnowledgeEditor, { describeRule } from "../components/KnowledgeEditor";
import KnowledgeGraph from "../components/KnowledgeGraph";
import Modal from "../components/Modal";
import { LoadingPanel, PageHeader } from "../components/industrial";
import { EmptyState, ErrorState, SeverityBadge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage, kbApi } from "../services/api";
import type { KnowledgeEntry } from "../types";
import { categoryOf } from "../utils/knowledge";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details open className="group rounded-lg border border-white/[.06] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">{title}<ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden /></summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-300">{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </details>
  );
}

/** Shared by /knowledge-base (cards + graph) and /rules (IF/THEN rule view). */
export default function KnowledgeBase({ rulesView = false }: { rulesView?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<KnowledgeEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<"cards" | "graph">("cards");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<KnowledgeEntry | "new" | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeEntry | null>(null);

  const load = useCallback(async () => { try { setItems(await kbApi.list(q, severity)); setError(null); } catch (e) { setError(errorMessage(e)); } }, [q, severity]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  const categories = useMemo(() => [...new Set((items ?? []).map(categoryOf))].sort(), [items]);
  const shown = useMemo(() => (items ?? []).filter((k) => !category || categoryOf(k) === category), [items, category]);
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const remove = async () => {
    if (!deleting) return;
    try { await kbApi.remove(deleting.id); toast.push("success", "Fault deleted"); void load(); } catch (e) { toast.push("error", errorMessage(e)); }
    setDeleting(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title={rulesView ? "Rule management" : "Knowledge base"} subtitle={rulesView ? "IF/THEN rules evaluated by the diagnosis engine" : "Known faults, symptoms, causes and corrective actions"}
        actions={isAdmin && <button className="btn" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add fault</button>} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
          <input className="input pl-9" placeholder="Search faults" aria-label="Search faults" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" aria-label="Filter by severity" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">All severities</option>{["low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input w-auto" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        {!rulesView && (
          <div className="ml-auto flex rounded-lg border border-white/10 p-0.5" role="tablist" aria-label="View">
            {([["cards", "Cards", LayoutGrid], ["graph", "Graph", Network]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${tab === k ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" aria-hidden />{label}</button>))}
          </div>)}
      </div>

      {error && !items ? <ErrorState message={error} onRetry={load} /> : !items ? <LoadingPanel message="Loading knowledge network…" /> : shown.length === 0 ? <div className="card"><EmptyState title="No faults found" hint="Try a different search or filter." /></div>
        : !rulesView && tab === "graph" ? <KnowledgeGraph entries={shown} /> : (
        <ul className="grid items-start gap-4 md:grid-cols-2">{shown.map((k) => {
          const expanded = open.has(k.id);
          return (
            <li key={k.id} className="card card-hover flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h2 className="truncate font-semibold text-white">{k.fault_name}</h2><p className="text-xs text-slate-500">{categoryOf(k)}</p></div>
                {k.rule && <SeverityBadge severity={k.rule.severity} />}
              </div>
              {rulesView
                ? <p className="rounded-lg bg-black/30 p-2 font-mono text-xs leading-relaxed text-slate-300"><span className="text-sky-400">IF</span> {describeRule(k)} <span className="text-sky-400">THEN</span> {k.fault_name}</p>
                : <p className="text-sm text-slate-400">{k.description}</p>}
              {expanded && (
                <div className="space-y-2">
                  {!rulesView && <p className="rounded-lg bg-black/30 p-2 font-mono text-xs text-slate-300"><span className="text-sky-400">IF</span> {describeRule(k)}</p>}
                  <Section title="Symptoms" items={k.symptoms} /><Section title="Possible causes" items={k.causes} />
                  <Section title="Recommended action" items={k.rule?.actions ?? []} /><Section title="Preventive measures" items={k.prevention} />
                </div>)}
              <div className="mt-auto flex items-center justify-between">
                <button className="btn-ghost -ml-2 text-sky-300" onClick={() => toggle(k.id)} aria-expanded={expanded}><ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} aria-hidden />{expanded ? "Hide details" : "Show details"}</button>
                {isAdmin && <div className="flex gap-1">
                  <button className="btn-ghost p-1.5" aria-label={`Edit ${k.fault_name}`} onClick={() => setEditing(k)}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 hover:text-red-300" aria-label={`Delete ${k.fault_name}`} onClick={() => setDeleting(k)}><Trash2 className="h-4 w-4" /></button></div>}
              </div>
            </li>);
        })}</ul>)}

      {editing && <KnowledgeEditor entry={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
      {deleting && <Modal title="Delete fault?" onClose={() => setDeleting(null)}><p className="text-sm text-slate-300">Remove <strong>{deleting.fault_name}</strong> and its rule? Past diagnoses are kept.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button><button className="btn bg-red-500 hover:bg-red-400" onClick={remove}>Delete</button></div></Modal>}
    </div>
  );
}
