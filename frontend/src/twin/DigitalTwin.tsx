import { Box, LayoutGrid, RotateCcw, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";
import { LoadingPanel, SensorCard, StatusBadge } from "../components/industrial";
import { EmptyState } from "../components/ui";
import { useLiveEvents } from "../contexts/LiveContext";
import { dashboardApi } from "../services/api";
import type { Device } from "../types";
import { deviceState, STATE_STYLE, type DeviceState } from "../utils/deviceState";
import TwinFallback from "./TwinFallback";
import { hasWebGL, prefersReducedMotion } from "./webgl";

const Scene = lazy(() => import("./DigitalTwin3D"));
const PRIMARY = ["temperature", "vibration", "current", "rpm"];
const STORE_KEY = "iot.twin3d";
type Readings = Record<number, Record<string, number>>;

export default function DigitalTwin({ devices }: { devices: Device[] | null }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const webgl = useMemo(hasWebGL, []);
  const reduce = useMemo(prefersReducedMotion, []);
  const [want3d, setWant3d] = useState(() => localStorage.getItem(STORE_KEY) !== "off");
  const use3d = webgl && want3d;
  const [live, setLive] = useState<Readings>({});
  const [latest, setLatest] = useState<Readings>({});

  useLiveEvents((e) => { if (e.type === "tick") setLive((p) => ({ ...p, [e.device_id]: e.readings })); });

  useEffect(() => {
    if (selectedId === null) return;
    dashboardApi.series(selectedId, 1).then((s) => {
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(s)) { const last = v.points[v.points.length - 1]; if (last) values[k] = last.value; }
      setLatest((p) => ({ ...p, [selectedId]: values }));
    }).catch(() => undefined);
  }, [selectedId]);

  const selected = devices?.find((d) => d.id === selectedId) ?? null;
  const toggle3d = () => { const next = !want3d; setWant3d(next); localStorage.setItem(STORE_KEY, next ? "on" : "off"); };
  const value = (id: number, kind: string) => live[id]?.[kind] ?? latest[id]?.[kind];

  let view: React.ReactNode;
  if (devices === null) view = <LoadingPanel message="Synchronizing IoT devices…" className="h-full rounded-none border-0" />;
  else if (devices.length === 0) view = <div className="flex h-full items-center justify-center"><EmptyState title="No devices to visualise" hint="Add a device and your digital twin will appear here." /></div>;
  else if (!use3d) view = <TwinFallback devices={devices} selectedId={selectedId} onSelect={setSelectedId} />;
  else view = (
    <ErrorBoundary fallback={<TwinFallback devices={devices} selectedId={selectedId} onSelect={setSelectedId} />}>
      <Suspense fallback={<LoadingPanel message="Loading 3D digital twin…" className="h-full rounded-none border-0" />}>
        <Scene devices={devices} selectedId={selectedId} onSelect={setSelectedId} animate={!reduce} />
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <section className="card overflow-hidden" aria-label="Digital twin">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-4 py-3">
        <div><h2 className="text-sm font-semibold text-white">Digital twin</h2><p className="text-xs text-slate-500">Live state of your real devices. Select a machine to inspect it.</p></div>
        <div className="flex items-center gap-1">
          <ul className="mr-2 hidden items-center gap-3 text-[11px] text-slate-400 sm:flex" aria-label="Legend">
            {(Object.keys(STATE_STYLE) as DeviceState[]).map((s) => <li key={s} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STATE_STYLE[s].hex }} />{STATE_STYLE[s].label}</li>)}
          </ul>
          {selected && <button className="btn-ghost px-2" onClick={() => setSelectedId(null)} aria-label="Reset view"><RotateCcw className="h-4 w-4" /></button>}
          <button className="btn-ghost px-2" onClick={toggle3d} disabled={!webgl} aria-pressed={use3d} title={webgl ? (use3d ? "Switch to 2D topology" : "Switch to 3D view") : "WebGL is unavailable on this device"}>
            {use3d ? <LayoutGrid className="h-4 w-4" /> : <Box className="h-4 w-4" />}<span className="text-xs">{use3d ? "2D" : "3D"}</span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_21rem]">
        <div className="relative h-[24rem] bg-ink-950 sm:h-[28rem]">{view}</div>
        <aside className="max-h-[28rem] overflow-y-auto border-t border-white/[.06] p-4 lg:border-l lg:border-t-0" aria-live="polite">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate text-lg font-semibold text-white">{selected.name}</h3><p className="truncate text-xs text-slate-500">{selected.type}{selected.location ? ` · ${selected.location}` : ""}</p></div>
                <button className="btn-ghost p-1" onClick={() => setSelectedId(null)} aria-label="Close details"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center justify-between"><StatusBadge state={deviceState(selected)} /><span className="text-sm text-slate-400">Health <b className="text-white">{Math.round(selected.health_score)}%</b></span></div>
              <div className="grid grid-cols-2 gap-2">
                {[...PRIMARY.filter((k) => selected.sensors.some((s) => s.kind === k)), ...selected.sensors.map((s) => s.kind).filter((k) => !PRIMARY.includes(k))].slice(0, 6).map((kind) => {
                  const s = selected.sensors.find((x) => x.kind === kind)!, v = value(selected.id, kind);
                  return <SensorCard key={kind} label={kind} value={v} unit={s.unit} tone={v !== undefined && (v < s.min_normal || v > s.max_normal) ? "warn" : "ok"} range={`normal ${s.min_normal}–${s.max_normal}`} />;
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/diagnosis?device=${selected.id}`} className="btn">View diagnostics</Link>
                <Link to={`/devices/${selected.id}`} className="btn-ghost border border-white/10">Open device</Link>
              </div>
            </div>
          ) : devices && devices.length > 0 ? (
            <div>
              <p className="kpi-label mb-2">Devices</p>
              <ul className="space-y-1">
                {devices.map((d) => (
                  <li key={d.id}><button onClick={() => setSelectedId(d.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-white/5">
                    <span className="truncate">{d.name}</span><StatusBadge state={deviceState(d)} /></button></li>))}
              </ul>
              {devices.length > 16 && <p className="mt-2 text-xs text-slate-500">The 3D scene shows the first 16 of {devices.length} devices; all are listed here.</p>}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
