import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingPanel, PageHeader, SensorCard, StatusBadge } from "../components/industrial";
import SensorChart from "../components/SensorChart";
import { EmptyState, ErrorState } from "../components/ui";
import { useLiveEvents } from "../contexts/LiveContext";
import { dashboardApi, devicesApi, errorMessage } from "../services/api";
import type { Device, SeriesData } from "../types";
import { deviceState } from "../utils/deviceState";

const RANGES = [{ n: 30, label: "30 readings" }, { n: 60, label: "60 readings" }, { n: 120, label: "120 readings" }, { n: 300, label: "300 readings" }];
const COLORS: Record<string, string> = { temperature: "#f87171", humidity: "#38bdf8", vibration: "#fbbf24", pressure: "#a78bfa", voltage: "#fb923c", current: "#34d399", rpm: "#2dd4bf" };

export default function Monitoring() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [range, setRange] = useState(60);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { devicesApi.list().then((d) => { setDevices(d); setDeviceId(d[0]?.id ?? null); }).catch((e) => setError(errorMessage(e))); }, []);
  const load = useCallback(async () => {
    if (deviceId === null) return;
    try { setSeries(await dashboardApi.series(deviceId, range)); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [deviceId, range]);
  useEffect(() => { setSeries(null); void load(); }, [load]);

  useLiveEvents((e) => {
    if (e.type !== "tick" || e.device_id !== deviceId) return;
    const ts = new Date().toISOString();
    setDevices((p) => p?.map((d) => (d.id === e.device_id ? { ...d, health_score: e.health_score, status: "online" } : d)) ?? p);
    setSeries((prev) => prev && Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, k in e.readings ? { ...v, points: [...v.points, { ts, value: e.readings[k] }].slice(-range) } : v])));
  });

  if (error && !devices) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!devices) return <LoadingPanel message="Synchronizing IoT devices…" />;
  if (devices.length === 0) return <div className="card"><EmptyState title="No devices to monitor" hint="Create a device to see its live sensor data here." /></div>;
  const device = devices.find((d) => d.id === deviceId);

  return (
    <div className="mx-auto max-w-[90rem] space-y-5">
      <PageHeader title="Live monitoring" subtitle="Real-time sensor readings with selectable history"
        actions={<div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" aria-label="Select device" value={deviceId ?? ""} onChange={(e) => setDeviceId(Number(e.target.value))}>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="History length">{RANGES.map((r) => (
            <button key={r.n} aria-pressed={range === r.n} onClick={() => setRange(r.n)} className={`rounded-md px-2.5 py-1.5 text-xs transition ${range === r.n ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:text-white"}`}>{r.n}</button>))}</div></div>} />
      {device && <div className="flex flex-wrap items-center gap-3"><StatusBadge state={deviceState(device)} /><span className="text-sm text-slate-400">{device.type} · health {Math.round(device.health_score)}%</span><Link to={`/devices/${device.id}`} className="text-sm text-sky-300 hover:underline">Open device →</Link></div>}
      {error ? <ErrorState message={error} onRetry={load} /> : !series ? <LoadingPanel message="Loading sensor data…" /> : (<>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label="Latest readings">
          {device?.sensors.map((s) => { const v = series[s.kind]?.points.at(-1)?.value; return <SensorCard key={s.kind} label={s.kind} value={v} unit={s.unit} tone={v !== undefined && (v < s.min_normal || v > s.max_normal) ? "warn" : "ok"} range={`normal ${s.min_normal}–${s.max_normal}`} />; })}
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Sensor history">
          {device?.sensors.map((s) => <SensorChart key={s.kind} title={s.kind === "rpm" ? "RPM" : s.kind[0].toUpperCase() + s.kind.slice(1)} unit={s.unit} color={COLORS[s.kind] ?? "#38bdf8"} points={series[s.kind]?.points ?? []} />)}
        </section>
      </>)}
    </div>
  );
}
