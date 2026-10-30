import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeEntry } from "../types";
import { buildGraph, layoutGraph, type GNode, type NodeKind } from "../utils/knowledge";
import { SEVERITY_COLORS } from "./ui";

const KIND: Record<NodeKind, { color: string; label: string }> = {
  sensor: { color: "#38bdf8", label: "Sensor" }, fault: { color: "#f87171", label: "Fault" },
  cause: { color: "#94a3b8", label: "Cause" }, action: { color: "#34d399", label: "Corrective action" },
};
const W = 168, H = 34;

/** Interactive graph built from the real knowledge base: drag to pan, wheel/buttons to zoom, click a node to trace its relationships. */
export default function KnowledgeGraph({ entries }: { entries: KnowledgeEntry[] }) {
  const { nodes, edges } = useMemo(() => buildGraph(entries), [entries]);
  const pos = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const [view, setView] = useState({ x: 20, y: 20, k: 0.85 });
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setView((v) => ({ ...v, k: Math.min(2.2, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) })); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const related = useMemo(() => {
    if (!selected) return null;
    const ids = new Set([selected]);
    edges.forEach((e) => { if (e.from === selected) ids.add(e.to); if (e.to === selected) ids.add(e.from); });
    // a fault's neighbours' other faults are intentionally not expanded, to keep the trace readable
    return ids;
  }, [selected, edges]);

  useEffect(() => {
    const p = selected ? pos[selected] : null, el = svgRef.current;
    if (p && el) { const r = el.getBoundingClientRect(); setView((v) => ({ ...v, x: r.width / 2 - (1.5 * 260 + W / 2) * v.k, y: r.height / 2 - p.y * v.k })); /* all four columns stay in view; follow the node vertically */ }
  }, [selected, pos]);

  const sel: GNode | undefined = nodes.find((n) => n.id === selected);
  const connected = sel ? nodes.filter((n) => related?.has(n.id) && n.id !== sel.id) : [];
  const entry = sel?.entryId ? entries.find((e) => e.id === sel.entryId) : undefined;
  const colorOf = (n: GNode) => (n.kind === "fault" && n.severity ? SEVERITY_COLORS[n.severity as keyof typeof SEVERITY_COLORS] : KIND[n.kind].color);

  if (nodes.length === 0) return <p className="card p-8 text-center text-sm text-slate-500">No knowledge data to graph yet.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="card relative h-[32rem] overflow-hidden bg-ink-950">
        <svg ref={svgRef} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" role="group" aria-label="Knowledge graph of sensors, faults, causes and actions"
          onPointerDown={(e) => { if ((e.target as Element).closest("[data-node]")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
          onClick={(e) => { if (!(e.target as Element).closest("[data-node]")) setSelected(null); }}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {edges.map((e) => {
              const a = pos[e.from], b = pos[e.to]; if (!a || !b) return null;
              const on = related ? related.has(e.from) && related.has(e.to) && (e.from === selected || e.to === selected) : false;
              const x1 = a.x + W, x2 = b.x, mid = (x1 + x2) / 2;
              return <path key={`${e.from}>${e.to}`} d={`M${x1} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${x2} ${b.y}`} fill="none"
                stroke={on ? "#38bdf8" : "#334766"} strokeWidth={on ? 1.8 : 1} strokeDasharray={on ? "5 4" : undefined} className={on ? "animate-dash-flow" : ""} opacity={related && !on ? 0.12 : 0.8} />;
            })}
            {nodes.map((n) => {
              const p = pos[n.id]; const dim = related && !related.has(n.id); const isSel = n.id === selected; const c = colorOf(n);
              return (
                <g key={n.id} data-node transform={`translate(${p.x} ${p.y - H / 2})`} tabIndex={0} role="button" aria-label={`${KIND[n.kind].label}: ${n.label}`} aria-pressed={isSel}
                  opacity={dim ? 0.25 : 1} style={{ cursor: "pointer", transition: "opacity .2s" }}
                  onClick={(ev) => { ev.stopPropagation(); setSelected(isSel ? null : n.id); }} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setSelected(isSel ? null : n.id)}>
                  <rect width={W} height={H} rx={8} fill="#0c1220" stroke={isSel ? "#e0f2fe" : c} strokeWidth={isSel ? 2 : 1.2} />
                  <circle cx={14} cy={H / 2} r={4.5} fill={c} />
                  <text x={26} y={H / 2 + 4} fontSize={11.5} fill="#e2e8f0" className="select-none">{n.label.length > 21 ? `${n.label.slice(0, 20)}…` : n.label}</text>
                  <title>{n.label}</title>
                </g>);
            })}
            {(["Sensors", "Faults", "Causes", "Corrective actions"] as const).map((t, i) => <text key={t} x={i * 260} y={-8} fontSize={10} letterSpacing={1.5} fill="#64748b">{t.toUpperCase()}</text>)}
          </g>
        </svg>
        <div className="absolute bottom-3 left-3 flex gap-1">
          <button className="btn-ghost border border-white/10 bg-ink-900 px-2" aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, k: Math.min(2.2, v.k * 1.2) }))}><Plus className="h-4 w-4" /></button>
          <button className="btn-ghost border border-white/10 bg-ink-900 px-2" aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))}><Minus className="h-4 w-4" /></button>
          <button className="btn-ghost border border-white/10 bg-ink-900 px-2" aria-label="Reset view" onClick={() => { setView({ x: 20, y: 20, k: 0.85 }); setSelected(null); }}><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      <aside className="card p-4" aria-live="polite">
        {sel ? (
          <div className="space-y-3">
            <div><p className="kpi-label">{KIND[sel.kind].label}</p><h3 className="text-lg font-semibold text-white first-letter:uppercase">{sel.label}</h3></div>
            {entry?.description && <p className="text-sm text-slate-400">{entry.description}</p>}
            <div><p className="kpi-label mb-1">Connected ({connected.length})</p>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">{connected.map((n) => (
                <li key={n.id}><button className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-slate-200 hover:bg-white/5" onClick={() => setSelected(n.id)}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(n) }} /><span className="truncate first-letter:uppercase">{n.label}</span><span className="ml-auto text-[10px] text-slate-500">{KIND[n.kind].label}</span></button></li>))}</ul></div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-400">
            <p>Select a node to trace how a <b className="text-slate-200">sensor</b> leads to a <b className="text-slate-200">fault</b>, its <b className="text-slate-200">causes</b> and the <b className="text-slate-200">corrective actions</b>.</p>
            <ul className="space-y-1.5">{(Object.keys(KIND) as NodeKind[]).map((k) => <li key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND[k].color }} />{KIND[k].label}</li>)}</ul>
            <p className="text-xs text-slate-500">Drag to pan. Scroll or use the buttons to zoom.</p>
          </div>)}
      </aside>
    </div>
  );
}
