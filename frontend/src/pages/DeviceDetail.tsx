import { ArrowLeft, FlaskConical, Play, RotateCcw, Square, StepForward, Stethoscope, Syringe } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DiagnosisReportView } from "../components/DiagnosisCard";
import SensorChart from "../components/SensorChart";
import { LoadingPanel, StatusBadge } from "../components/industrial";
import { ErrorState, SeverityBadge, Spinner } from "../components/ui";
import DeviceModelView from "../twin/DeviceModelView";
import { deviceState } from "../utils/deviceState";
import { useAuth } from "../contexts/AuthContext";
import { useLiveEvents } from "../contexts/LiveContext";
import { useToast } from "../contexts/ToastContext";
import { dashboardApi, devicesApi, errorMessage, faultsApi, simulatorApi } from "../services/api";
import type { Device, DiagnosisReport, FaultRecord, Scenario, SeriesData, SimStatus, TickResult } from "../types";
import { timeAgo } from "../utils/time";

const META: Record<string, { title: string; color: string; min: number; max: number; step: number }> = {
  temperature: { title: "Temperature", color: "#f87171", min: 0, max: 150, step: 1 },
  humidity: { title: "Humidity", color: "#38bdf8", min: 0, max: 110, step: 1 },
  vibration: { title: "Vibration", color: "#fbbf24", min: 0, max: 25, step: 0.1 },
  pressure: { title: "Pressure", color: "#a78bfa", min: 0, max: 6, step: 0.1 },
  voltage: { title: "Voltage", color: "#fb923c", min: 150, max: 280, step: 1 },
  current: { title: "Current", color: "#34d399", min: 0, max: 25, step: 0.1 },
  rpm: { title: "RPM", color: "#2dd4bf", min: 0, max: 3000, step: 10 },
};
const MODES = [["normal", "Normal"], ["warning", "Warning drift"], ["random", "Random"]] as const;
const MAX_POINTS = 60;

/** Module-level on purpose: defining it inside the page would remount buttons (losing focus) on every live update. */
function ActionButton({ label, icon, onClick, busy, variant = "btn-ghost", children }: { label: string; icon: React.ReactNode; onClick: () => void; busy: string | null; variant?: string; children: React.ReactNode }) {
  return (
    <button className={`${variant} ${variant === "btn-ghost" ? "border border-white/10" : ""}`} disabled={busy !== null} onClick={onClick} aria-label={label}>
      {busy === label ? <Spinner /> : icon}{children}
    </button>
  );
}

export default function DeviceDetail() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const toast = useToast();
  const canControl = user?.role === "admin" || user?.role === "engineer";

  const [device, setDevice] = useState<Device | null>(null);
  const [sim, setSim] = useState<SimStatus | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [slider, setSlider] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [d, s, ser, f] = await Promise.all([devicesApi.get(id), simulatorApi.status(id), dashboardApi.series(id), faultsApi.list({ device_id: id, limit: 5 })]);
      setDevice(d); setSim(s); setSeries(ser); setFaults(f); setError(null);
    } catch (err) { setError(errorMessage(err)); }
  }, [id]);

  useEffect(() => { setReport(null); void load(); }, [load]);
  useEffect(() => { if (canControl) simulatorApi.scenarios().then(setScenarios).catch(() => undefined); }, [canControl]);

  useLiveEvents((e) => {
    if (e.device_id !== id) return;
    if (e.type === "tick") {
      const ts = new Date().toISOString();
      setDevice((d) => (d ? { ...d, health_score: e.health_score, status: "online", last_active: ts } : d));
      setSeries((prev) => prev && Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, k in e.readings ? { ...v, points: [...v.points, { ts, value: e.readings[k] }].slice(-MAX_POINTS) } : v])));
    } else void faultsApi.list({ device_id: id, limit: 5 }).then(setFaults).catch(() => undefined);
  });

  const act = async (label: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(label);
    try { await fn(); if (success) toast.push("success", success); await load(); }
    catch (err) { toast.push("error", errorMessage(err)); } finally { setBusy(null); }
  };
  const showResult = (r: TickResult) => setReport(r.diagnosis);

  if (error && !device) return <ErrorState message={error} onRetry={load} />;
  if (!device || !series) return <LoadingPanel message="Loading sensor data…" className="mx-auto max-w-7xl min-h-[50vh]" />;

  const latest = (kind: string) => series[kind]?.points.at(-1)?.value;
  const sliderValue = (kind: string) => slider[kind] ?? latest(kind) ?? META[kind].min;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Devices</Link>

      <header className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 truncate text-xl font-semibold text-white">{device.name}<StatusBadge state={deviceState(device)} /></h1>
          <p className="text-sm text-slate-400">{device.type}{device.location ? ` · ${device.location}` : ""} · ID {device.id}</p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div><dt className="text-xs text-slate-500">Status</dt><dd className={device.status === "online" ? "text-emerald-400" : "text-slate-400"}>{device.status}</dd></div>
          <div><dt className="text-xs text-slate-500">Health</dt><dd className="font-semibold text-white">{Math.round(device.health_score)}%</dd></div>
          <div><dt className="text-xs text-slate-500">Last active</dt><dd className="text-slate-300">{device.last_active ? timeAgo(device.last_active) : "never"}</dd></div>
        </dl>
      </header>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="card h-56 overflow-hidden p-0 lg:h-auto lg:min-h-[16rem]"><DeviceModelView type={device.type} state={deviceState(device)} /></div>
        <section aria-label="Live readings" className="grid grid-cols-2 content-start gap-3 sm:grid-cols-4 lg:grid-cols-4">
        {device.sensors.map((s) => {
          const v = latest(s.kind);
          const out = v !== undefined && (v < s.min_normal || v > s.max_normal);
          return (
            <div key={s.kind} className={`card p-3 ${out ? "border-amber-500/40" : ""}`}>
              <p className="truncate text-xs capitalize text-slate-400">{s.kind === "rpm" ? "RPM" : s.kind}</p>
              <p className={`text-lg font-semibold ${out ? "text-amber-300" : "text-white"}`}>{v === undefined ? "—" : Number.isInteger(v) ? v : Math.round(v * 10) / 10} <span className="text-xs font-normal text-slate-500">{s.unit}</span></p>
              <p className="text-[11px] text-slate-600">normal {s.min_normal}–{s.max_normal}</p>
            </div>);
        })}
      </section>
      </div>

      {canControl && sim && (
        <section className="card space-y-5 p-4 sm:p-5" aria-label="Simulator controls">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-white"><FlaskConical className="h-5 w-5 text-sky-400" aria-hidden /> Simulator</h2>
            <div className="flex flex-wrap gap-2">
              {sim.running
                ? <ActionButton busy={busy} label="stop" icon={<Square className="h-4 w-4" />} onClick={() => act("stop", () => simulatorApi.stop(id), "Simulation stopped")}>Stop</ActionButton>
                : <ActionButton busy={busy} label="start" variant="btn" icon={<Play className="h-4 w-4" />} onClick={() => act("start", () => simulatorApi.start(id), "Simulation started")}>Start</ActionButton>}
              <ActionButton busy={busy} label="step" icon={<StepForward className="h-4 w-4" />} onClick={() => act("step", async () => showResult(await simulatorApi.tick(id)))}>Step once</ActionButton>
              <ActionButton busy={busy} label="diagnose" icon={<Stethoscope className="h-4 w-4" />} onClick={() => act("diagnose", async () => setReport(await faultsApi.run(id)))}>Run diagnosis</ActionButton>
              <ActionButton busy={busy} label="reset" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setTouched(new Set()); setSlider({}); void act("reset", () => simulatorApi.reset(id), "Simulator reset to normal"); }}>Reset</ActionButton>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Mode <span className="ml-1 normal-case text-slate-500">(current: {sim.mode.replace("_", " ")}, {sim.running ? "running" : "stopped"}, every {sim.interval_s}s)</span></p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Simulation mode">
              {MODES.map(([m, label]) => (
                <button key={m} aria-pressed={sim.mode === m} disabled={busy !== null} onClick={() => act(`mode-${m}`, () => simulatorApi.setMode(id, m))}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${sim.mode === m ? "border-sky-400 bg-sky-500/15 text-sky-300" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>{label}</button>))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Demo scenarios</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {scenarios.map((s) => (
                <button key={s.key} disabled={busy !== null} onClick={() => act(`sc-${s.key}`, async () => showResult(await simulatorApi.scenario(id, s.key)))}
                  className="rounded-lg border border-white/10 p-3 text-left hover:bg-white/5 disabled:opacity-50">
                  <span className="block text-sm font-medium text-white">{busy === `sc-${s.key}` ? <Spinner /> : s.label}</span>
                  <span className="block text-xs text-slate-500">{s.expected}</span>
                </button>))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Manual values</p>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {device.sensors.map((s) => {
                const m = META[s.kind]; if (!m) return null;
                return (
                  <label key={s.kind} className="block text-sm">
                    <span className="flex justify-between text-slate-400"><span>{m.title}</span><span className={touched.has(s.kind) ? "text-sky-300" : "text-slate-500"}>{sliderValue(s.kind)} {s.unit}</span></span>
                    <input type="range" className="w-full accent-sky-400" min={m.min} max={m.max} step={m.step} value={sliderValue(s.kind)}
                      onChange={(e) => { setSlider({ ...slider, [s.kind]: Number(e.target.value) }); setTouched(new Set(touched).add(s.kind)); }} />
                  </label>);
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton busy={busy} label="inject" variant="btn" icon={<Syringe className="h-4 w-4" />} onClick={() => act("inject", async () => { await simulatorApi.inject(id, Object.fromEntries([...touched].map((k) => [k, slider[k]]))); showResult(await simulatorApi.tick(id)); }, "Values injected")}>Inject changed values</ActionButton>
              <ActionButton busy={busy} label="custom" icon={<Syringe className="h-4 w-4" />} onClick={() => act("custom", async () => { await simulatorApi.setMode(id, "custom", Object.fromEntries(device.sensors.map((s) => [s.kind, sliderValue(s.kind)]))); showResult(await simulatorApi.tick(id)); }, "Custom values applied")}>Set all (custom mode)</ActionButton>
            </div>
            {!touched.size && <p className="mt-2 text-xs text-slate-500">Move a slider, then inject it to simulate a fault.</p>}
          </div>
        </section>
      )}

      {report && (
        <section aria-label="Latest diagnosis" className="space-y-3">
          <h2 className="font-semibold text-white">Diagnosis result</h2>
          <DiagnosisReportView report={report} />
        </section>)}

      <section aria-label="Sensor history" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {device.sensors.map((s) => META[s.kind] && <SensorChart key={s.kind} title={META[s.kind].title} unit={s.unit} color={META[s.kind].color} points={series[s.kind]?.points ?? []} />)}
      </section>

      <section className="card p-4 sm:p-5" aria-label="Recent faults">
        <h2 className="mb-3 font-semibold text-white">Recent faults</h2>
        {faults.length === 0 ? <p className="text-sm text-slate-500">No faults recorded for this device.</p> : (
          <ul className="divide-y divide-white/5">
            {faults.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm text-slate-200">{f.fault}</p><p className="text-xs text-slate-500">{timeAgo(f.detected_at)} · {f.confidence}% · {f.status}</p></div>
                <SeverityBadge severity={f.severity} />
              </li>))}
          </ul>)}
      </section>
    </div>
  );
}
