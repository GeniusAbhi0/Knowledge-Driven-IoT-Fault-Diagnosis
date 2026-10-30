import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useToast } from "../contexts/ToastContext";
import { errorMessage, kbApi } from "../services/api";
import { SENSOR_KINDS, type Condition, type KnowledgeEntry, type KnowledgeInput } from "../types";
import Modal from "./Modal";
import { Spinner } from "./ui";

const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
const text = (a: string[]) => a.join("\n");
const BLANK: Condition = { sensor: "temperature", op: ">", threshold: 0, weight: 1 };

export function validateKnowledge(k: KnowledgeInput): string | null {
  if (!k.fault_name.trim()) return "Fault name is required";
  if (k.rule.conditions.length === 0) return "Add at least one condition";
  if (k.rule.conditions.some((c) => !Number.isFinite(c.threshold))) return "Every condition needs a numeric threshold";
  if (k.rule.conditions.some((c) => !(c.weight > 0))) return "Condition weights must be greater than 0";
  return null;
}

export const describeRule = (e: KnowledgeEntry): string =>
  e.rule ? e.rule.conditions.map((c) => `${c.sensor} ${c.op} ${c.threshold}`).join(e.rule.mode === "all" ? " AND " : " OR ") : "No rule";

export default function KnowledgeEditor({ entry, onSaved, onClose }: { entry?: KnowledgeEntry; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(entry?.fault_name ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [symptoms, setSymptoms] = useState(text(entry?.symptoms ?? []));
  const [causes, setCauses] = useState(text(entry?.causes ?? []));
  const [prevention, setPrevention] = useState(text(entry?.prevention ?? []));
  const [actions, setActions] = useState(text(entry?.rule?.actions ?? []));
  const [mode, setMode] = useState<"all" | "any">(entry?.rule?.mode ?? "all");
  const [severity, setSeverity] = useState<KnowledgeInput["rule"]["severity"]>(entry?.rule?.severity ?? "medium");
  const [conds, setConds] = useState<Condition[]>(entry?.rule?.conditions ?? [{ ...BLANK }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, c: Partial<Condition>) => setConds(conds.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: KnowledgeInput = { fault_name: name.trim(), description, symptoms: lines(symptoms), causes: lines(causes), prevention: lines(prevention),
      rule: { mode, severity, conditions: conds, actions: lines(actions) } };
    const invalid = validateKnowledge(body);
    if (invalid) return setError(invalid);
    setBusy(true); setError(null);
    try { if (entry) await kbApi.update(entry.id, body); else await kbApi.create(body); toast.push("success", "Knowledge base saved"); onSaved(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const F = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-slate-400">{t}</span>{children}</label>;

  return (
    <Modal title={entry ? "Edit fault" : "Add fault"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <F t="Fault name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></F>
        <F t="Description"><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></F>
        <fieldset className="space-y-2 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-slate-400">Diagnostic rule (IF … THEN)</legend>
          <div className="grid grid-cols-2 gap-2">
            <F t="Conditions must match"><select className="input" value={mode} onChange={(e) => setMode(e.target.value as "all" | "any")}><option value="all">ALL (AND)</option><option value="any">ANY (OR)</option></select></F>
            <F t="Severity"><select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>{["low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}</select></F>
          </div>
          {conds.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_4rem_1fr_auto] items-end gap-2" role="group" aria-label={`Condition ${i + 1}`}>
              <select className="input" aria-label="Sensor" value={c.sensor} onChange={(e) => patch(i, { sensor: e.target.value })}>{SENSOR_KINDS.map((s) => <option key={s}>{s}</option>)}</select>
              <select className="input px-1" aria-label="Operator" value={c.op} onChange={(e) => patch(i, { op: e.target.value as Condition["op"] })}>{[">", ">=", "<", "<="].map((o) => <option key={o}>{o}</option>)}</select>
              <input className="input" type="number" step="any" aria-label="Threshold" value={c.threshold} onChange={(e) => patch(i, { threshold: Number(e.target.value) })} />
              <button type="button" className="btn-ghost p-2" aria-label="Remove condition" onClick={() => setConds(conds.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
            </div>))}
          <button type="button" className="btn-ghost" onClick={() => setConds([...conds, { ...BLANK }])}><Plus className="h-4 w-4" aria-hidden /> Add condition</button>
          <F t="Recommended actions (one per line)"><textarea className="input" rows={3} value={actions} onChange={(e) => setActions(e.target.value)} /></F>
        </fieldset>
        <F t="Symptoms (one per line)"><textarea className="input" rows={2} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} /></F>
        <F t="Possible causes (one per line)"><textarea className="input" rows={3} value={causes} onChange={(e) => setCauses(e.target.value)} /></F>
        <F t="Preventive measures (one per line)"><textarea className="input" rows={2} value={prevention} onChange={(e) => setPrevention(e.target.value)} /></F>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy && <Spinner />} Save</button></div>
      </form>
    </Modal>
  );
}
