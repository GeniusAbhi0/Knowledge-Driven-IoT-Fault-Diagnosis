import { ArrowLeft, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DiagnosisCard } from "../components/DiagnosisCard";
import { ErrorState, Skeleton, Spinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { devicesApi, downloadFile, errorMessage, faultHistoryApi, kbApi } from "../services/api";
import type { DiagnosisItem, FaultRecord, FaultStatus, KnowledgeEntry } from "../types";
import { dateTime } from "../utils/time";

const STATUSES: FaultStatus[] = ["detected", "investigating", "resolved", "ignored"];

export default function FaultDetail() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role !== "viewer";
  const [fault, setFault] = useState<FaultRecord | null>(null);
  const [kb, setKb] = useState<KnowledgeEntry | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<FaultStatus>("detected");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const f = await faultHistoryApi.get(id);
        setFault(f); setStatus(f.status); setNotes(f.resolution_notes);
        devicesApi.get(f.device_id).then((d) => setDeviceName(d.name)).catch(() => undefined);
        kbApi.list(f.fault).then((l) => setKb(l.find((k) => k.fault_name === f.fault) ?? null)).catch(() => undefined);
      } catch (e) { setError(errorMessage(e)); }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try { setFault(await faultHistoryApi.update(id, status, notes)); toast.push("success", "Fault updated"); }
    catch (e) { toast.push("error", errorMessage(e)); } finally { setSaving(false); }
  };

  if (error) return <ErrorState message={error} />;
  if (!fault) return <Skeleton className="h-64" />;
  const item: DiagnosisItem = { fault: fault.fault, severity: fault.severity, confidence: fault.confidence, what_happened: fault.summary, evidence: fault.evidence,
    causes: kb?.causes ?? [], actions: kb?.rule?.actions ?? [], prevention: kb?.prevention ?? [], detected_at: fault.detected_at };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/faults" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Fault history</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{deviceName || `Device #${fault.device_id}`} · detected {dateTime(fault.detected_at)}</p>
        <button className="btn-ghost border border-white/10" onClick={() => downloadFile(`/reports/diagnosis/${id}.pdf`, {}, `diagnosis-${id}.pdf`).catch((e) => toast.push("error", errorMessage(e)))}><Download className="h-4 w-4" aria-hidden /> PDF report</button>
      </div>
      <DiagnosisCard d={item} />
      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold text-white">Sensor values at detection</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(fault.readings).map(([k, v]) => <div key={k}><dt className="text-xs capitalize text-slate-500">{k}</dt><dd className="font-medium text-white">{v}</dd></div>)}</dl>
      </section>
      <section className="card space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold text-white">Status &amp; resolution</h2>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Status</span>
          <select className="input max-w-xs capitalize" value={status} disabled={!canEdit} onChange={(e) => setStatus(e.target.value as FaultStatus)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Resolution notes</span>
          <textarea className="input min-h-24" value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></label>
        {canEdit ? <button className="btn" onClick={save} disabled={saving}>{saving && <Spinner />} Save changes</button> : <p className="text-sm text-slate-500">Viewers cannot change fault status.</p>}
      </section>
    </div>
  );
}
