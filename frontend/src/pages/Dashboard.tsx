import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Server, ShieldAlert } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HealthGauge, LoadingPanel, PageHeader, SensorCard, StatusBadge } from "../components/industrial";
import SensorChart from "../components/SensorChart";
import { EmptyState, ErrorState, SEVERITY_COLORS, SeverityBadge, StatCard } from "../components/ui";
import { useLiveEvents } from "../contexts/LiveContext";
import { dashboardApi, devicesApi, errorMessage } from "../services/api";
import type { DashboardData, Device, SeriesData } from "../types";
import { deviceState, STATE_STYLE } from "../utils/deviceState";
import { dateTime } from "../utils/time";

const DigitalTwin = lazy(() => import("../twin/DigitalTwin"));
const CHARTS = [
  { kind: "temperature", title: "Temperature", color: "#f87171" },
  { kind: "humidity", title: "Humidity", color: "#38bdf8" },
  { kind: "vibration", title: "Vibration", color: "#fbbf24" },
  { kind: "pressure", title: "Pressure", color: "#a78bfa" },
  { kind: "current", title: "Current consumption", color: "#34d399" },
];
const TOOLTIP = { background: "#0c1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 };
const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<number | null>(null);
  deviceRef.current = deviceId;

  const load = useCallback(async () => {
    try {
      const [overview, list] = await Promise.all([dashboardApi.overview(), devicesApi.list()]);
      setData(overview); setDevices(list); setError(null);
      const id = deviceRef.current ?? overview.device_health[0]?.id ?? null;
      if (id !== null) {
        if (deviceRef.current === null) setDeviceId(id);
        setSeries(await dashboardApi.series(id));
      }
    } catch (err) { setError(errorMessage(err)); }
  }, []);

  useEffect(() => { void load(); }, [load, deviceId]);

  // Refresh at most every 1.5s while live events arrive.
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useLiveEvents(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = undefined; void load(); }, 1500);
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingPanel message="Synchronizing IoT devices…" className="min-h-[60vh]" />;

  const states = (devices ?? []).map(deviceState);
  const healthy = states.filter((s) => s === "healthy").length;
  const total = data.total_devices;
  const last = (kind: string) => series?.[kind]?.points.at(-1)?.value;
  const selectedDevice = devices?.find((d) => d.id === deviceId);

  return (
    <motion.div {...fade} className="mx-auto max-w-[90rem] space-y-6">
      <PageHeader title="Command center" subtitle="Live overview of your monitored equipment, faults and diagnostics" />

      <section aria-label="System summary" className="grid gap-4 lg:grid-cols-12">
        <div className="card flex flex-col items-center justify-center gap-3 p-5 lg:col-span-3">
          <HealthGauge value={data.system_health} />
          <p className="text-center text-xs text-slate-500">{total === 0 ? "No devices yet" : `${healthy} of ${total} devices healthy`}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-9 lg:grid-cols-4">
          <StatCard label="Total devices" value={total} icon={<Server className="h-5 w-5" />} accent="#38bdf8" hint={`${data.online_devices} online · ${data.offline_devices} offline`} />
          <StatCard label="Healthy devices" value={healthy} icon={<CheckCircle2 className="h-5 w-5" />} tone="text-emerald-400" accent="#34d399" hint={total ? `${Math.round((healthy / total) * 100)}% of fleet` : "—"} />
          <StatCard label="Warnings" value={data.warning_faults} icon={<AlertTriangle className="h-5 w-5" />} tone="text-amber-400" accent="#fbbf24" hint="Open non-critical faults" />
          <StatCard label="Critical faults" value={data.critical_faults} icon={<ShieldAlert className="h-5 w-5" />} tone="text-red-400" accent="#f87171" hint={data.critical_faults ? "Need immediate attention" : "None active"} />
        </div>
      </section>

      {data.critical_faults > 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-red-200"><ShieldAlert className="h-5 w-5 shrink-0 text-red-400" aria-hidden /><span><b>{data.critical_faults} critical fault{data.critical_faults > 1 ? "s" : ""}</b> active. Review the evidence and recommended actions.</span></p>
          <Link to="/faults" className="btn-ghost border border-red-400/30 text-red-100">View fault history</Link>
        </div>
      ) : total > 0 && data.active_faults === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />All monitored devices are operating within normal parameters.
        </div>
      ) : null}

      <Suspense fallback={<LoadingPanel message="Loading digital twin…" className="h-[28rem]" />}>
        <DigitalTwin devices={devices} />
      </Suspense>

      {data.device_health.length === 0 ? (
        <div className="card"><EmptyState title="No devices yet" hint="Devices appear here once an administrator creates them." /></div>
      ) : (<>
        <section aria-label="Live sensor activity" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Live sensor activity</h2>
            <select className="input w-auto" value={deviceId ?? ""} onChange={(e) => { setSeries(null); setDeviceId(Number(e.target.value)); }} aria-label="Select device">
              {data.device_health.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {["temperature", "vibration", "current", "rpm"].map((k) => {
              const s = selectedDevice?.sensors.find((x) => x.kind === k), v = last(k);
              return <SensorCard key={k} label={k} value={v} unit={s?.unit ?? series?.[k]?.unit ?? ""} tone={s && v !== undefined && (v < s.min_normal || v > s.max_normal) ? "warn" : "ok"} range={s ? `normal ${s.min_normal}–${s.max_normal}` : undefined} />;
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CHARTS.map((c) => <SensorChart key={c.kind} title={c.title} color={c.color} unit={series?.[c.kind]?.unit ?? ""} points={series?.[c.kind]?.points ?? []} />)}
            <div className="card p-4">
              <h3 className="mb-2 text-sm text-slate-300">Fault frequency</h3>
              <div className="h-36">
                {data.fault_frequency.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.fault_frequency} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis type="category" dataKey="fault" width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No faults recorded" tone="ok" />}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Device health</h2>
            <ul className="space-y-3">
              {(devices ?? []).map((d) => {
                const st = deviceState(d);
                return (
                  <li key={d.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm"><Link to={`/devices/${d.id}`} className="truncate hover:text-sky-300">{d.name}</Link><span className="flex items-center gap-2"><StatusBadge state={st} /><span className="w-10 text-right tabular-nums">{Math.round(d.health_score)}%</span></span></div>
                    <div className="h-1.5 rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(d.health_score)} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.name} health`}>
                      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${d.health_score}%`, background: STATE_STYLE[st].hex }} />
                    </div>
                  </li>);
              })}
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Recent diagnoses</h2>
            {data.recent_diagnoses.length === 0 ? <EmptyState title="No diagnoses yet" hint="Run a simulation to generate readings and faults." /> : (
              <ul className="divide-y divide-white/5">
                {data.recent_diagnoses.map((r) => (
                  <li key={r.id}><Link to={`/faults/${r.id}`} className="flex items-center justify-between gap-3 py-2 transition hover:bg-white/[.03]">
                    <div className="min-w-0"><p className="truncate text-sm text-white">{r.fault}</p>
                      <p className="truncate text-xs text-slate-500">{r.device} · {dateTime(r.detected_at)} · {r.confidence}%</p></div>
                    <SeverityBadge severity={r.severity} /></Link></li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Activity className="h-4 w-4 text-sky-400" aria-hidden />Fault trend (7 days)</h2>
          <div className="h-40">
            {data.fault_trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.fault_trend} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>{data.fault_trend.map((_, i) => <Cell key={i} fill={SEVERITY_COLORS.medium} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No faults in the last 7 days" tone="ok" />}
          </div>
        </section>
      </>)}
    </motion.div>
  );
}
