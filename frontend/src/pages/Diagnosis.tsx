import { Stethoscope } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DiagnosisReportView } from "../components/DiagnosisCard";
import DiagnosticFlow from "../components/DiagnosticFlow";
import { EmptyState, ErrorState, SeverityBadge, Skeleton, Spinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { dashboardApi, devicesApi, errorMessage, faultHistoryApi, faultsApi } from "../services/api";
import type { Device, DiagnosisReport, FaultRecord, SeriesData } from "../types";
import { timeAgo } from "../utils/time";

export default function Diagnosis() {
  const { user } = useAuth();
  const toast = useToast();
  const canRun = user?.role !== "viewer";
  const wanted = Number(useSearchParams()[0].get("device")) || null;
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [history, setHistory] = useState<FaultRecord[]>([]);
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { devicesApi.list().then((d) => { setDevices(d); setDeviceId(d.find((x) => x.id === wanted)?.id ?? d[0]?.id ?? null); }).catch((e) => setError(errorMessage(e))); }, []);

  const loadDevice = useCallback(async (id: number) => {
    try {
      const [s, h] = await Promise.all([dashboardApi.series(id), faultHistoryApi.page({ device_id: id, limit: 8 })]);
      setSeries(s); setHistory(h.items);
    } catch (e) { toast.push("error", errorMessage(e)); }
  }, [toast]);
  useEffect(() => { setReport(null); if (deviceId !== null) void loadDevice(deviceId); }, [deviceId, loadDevice]);

  const run = async () => {
    if (deviceId === null) return;
    setBusy(true);
    try { setReport(await faultsApi.run(deviceId)); void loadDevice(deviceId); }
    catch (e) { toast.push("error", errorMessage(e)); } finally { setBusy(false); }
  };

  if (error) return <ErrorState message={error} />;
  if (!devices) return <Skeleton className="h-64" />;
  if (!devices.length) return <div className="card"><EmptyState title="No devices to diagnose" hint="Create a device first, then generate some readings." /></div>;
  const device = devices.find((d) => d.id === deviceId);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-xl font-semibold text-white">Fault diagnosis</h1><p className="text-sm text-slate-400">Evaluate a device's latest readings against the knowledge base</p></div>
      <section className="card space-y-4 p-4 sm:p-5">
        <label className="block text-sm"><span className="mb-1 block text-slate-400">Device</span>
          <select className="input max-w-xs" value={deviceId ?? ""} onChange={(e) => setDeviceId(Number(e.target.value))}>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {device?.sensors.map((s) => { const v = series?.[s.kind]?.points.at(-1)?.value; return (
            <div key={s.kind}><dt className="text-xs capitalize text-slate-500">{s.kind === "rpm" ? "RPM" : s.kind}</dt><dd className="font-semibold text-white">{v ?? "—"} <span className="text-xs font-normal text-slate-500">{s.unit}</span></dd></div>); })}
        </dl>
        {canRun
          ? <button className="btn" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Stethoscope className="h-4 w-4" aria-hidden />} Run diagnosis</button>
          : <p className="text-sm text-slate-500">Viewers can browse results but not run diagnoses.</p>}
      </section>

      <DiagnosticFlow running={busy} report={report} readingCount={device?.sensors.filter((x) => series?.[x.kind]?.points.length).length ?? 0} />

      {report && <section aria-label="Diagnosis result" className="space-y-3"><h2 className="font-semibold text-white">Diagnosis result</h2><DiagnosisReportView report={report} /></section>}

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-semibold text-white">Diagnosis history</h2>
        {history.length === 0 ? <p className="text-sm text-slate-500">No diagnoses recorded for this device yet.</p> : (
          <ul className="divide-y divide-white/5">{history.map((f) => (
            <li key={f.id}><Link to={`/faults/${f.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/5">
              <div className="min-w-0"><p className="truncate text-sm text-slate-200">{f.fault}</p><p className="text-xs text-slate-500">{timeAgo(f.detected_at)} · {f.confidence}% · {f.status}</p></div>
              <SeverityBadge severity={f.severity} /></Link></li>))}</ul>)}
      </section>
    </div>
  );
}
