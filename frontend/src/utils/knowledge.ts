import type { KnowledgeEntry } from "../types";

/** Category derived from the sensors a rule actually uses (no invented data). */
export function categoryOf(e: KnowledgeEntry): string {
  const sensors = e.rule?.conditions.map((c) => c.sensor) ?? [];
  if (e.rule?.mode === "any" && new Set(sensors).size > 1) return "Sensor integrity";
  const first = sensors[0];
  if (first === "temperature") return "Thermal";
  if (first === "current" || first === "voltage") return "Electrical";
  if (first === "vibration" || first === "rpm") return "Mechanical";
  if (first === "pressure") return "Fluid & pressure";
  if (first === "humidity") return "Environmental";
  return "General";
}

export type NodeKind = "sensor" | "fault" | "cause" | "action";
export interface GNode { id: string; kind: NodeKind; label: string; severity?: string; entryId?: number }
export interface GEdge { from: string; to: string }

/** Sensors -> Fault (from rule conditions), Fault -> Causes, Fault -> Actions. Duplicate causes/actions are merged. */
export function buildGraph(entries: KnowledgeEntry[]): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges = new Map<string, GEdge>();
  const add = (n: GNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); };
  const link = (from: string, to: string) => edges.set(`${from}>${to}`, { from, to });
  for (const e of entries) {
    const fid = `fault:${e.id}`;
    add({ id: fid, kind: "fault", label: e.fault_name, severity: e.rule?.severity, entryId: e.id });
    for (const c of e.rule?.conditions ?? []) { const sid = `sensor:${c.sensor}`; add({ id: sid, kind: "sensor", label: c.sensor }); link(sid, fid); }
    for (const t of e.causes) { const id = `cause:${t.trim().toLowerCase()}`; add({ id, kind: "cause", label: t.trim() }); link(fid, id); }
    for (const t of e.rule?.actions ?? []) { const id = `action:${t.trim().toLowerCase()}`; add({ id, kind: "action", label: t.trim() }); link(fid, id); }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export const COLUMN: Record<NodeKind, number> = { sensor: 0, fault: 1, cause: 2, action: 3 };

/** Deterministic layered layout; causes/actions are ordered by the average position of their faults to reduce crossings. */
export function layoutGraph(nodes: GNode[], edges: GEdge[], colW = 260, rowH = 54): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const cols: Record<number, GNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  nodes.forEach((n) => cols[COLUMN[n.kind]].push(n));
  const height = Math.max(...Object.values(cols).map((c) => c.length), 1) * rowH;
  const place = (list: GNode[], col: number) => list.forEach((n, i) => { pos[n.id] = { x: col * colW, y: (i + 0.5) * (height / Math.max(list.length, 1)) }; });
  place(cols[1], 1);
  const bary = (n: GNode) => { const ys = edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => pos[e.from === n.id ? e.to : e.from]?.y).filter((y): y is number => y !== undefined); return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0; };
  [0, 2, 3].forEach((c) => { cols[c].sort((a, b) => bary(a) - bary(b)); place(cols[c], c); });
  return pos;
}
