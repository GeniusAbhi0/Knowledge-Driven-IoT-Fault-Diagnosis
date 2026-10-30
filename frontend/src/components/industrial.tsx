import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { STATE_STYLE, type DeviceState } from "../utils/deviceState";

/** Counts smoothly to the new value (instant when the user prefers reduced motion). */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const prev = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); prev.current = value; return; }
    const controls = animate(prev.current, value, { duration: 0.7, ease: "easeOut", onUpdate: setShown });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <>{shown.toFixed(decimals)}</>;
}

export function StatusBadge({ state, className = "" }: { state: DeviceState; className?: string }) {
  const s = STATE_STYLE[state];
  const pulse = state === "critical" ? "animate-pulse-soft" : "";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.bg} ${s.text} ${s.ring} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pulse}`} style={{ background: s.hex }} aria-hidden />{s.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}</div>
      {actions}
    </div>
  );
}

/** Compact live-reading tile; `tone` colours the value when a reading leaves its normal range. */
export function SensorCard({ label, value, unit, tone = "ok", range }: { label: string; value?: number; unit: string; tone?: "ok" | "warn"; range?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone === "warn" ? "border-amber-400/40 bg-amber-500/5" : "border-white/[.08] bg-white/[.02]"}`}>
      <p className="kpi-label truncate">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "warn" ? "text-amber-300" : "text-white"}`}>
        {value === undefined ? "—" : Number.isInteger(value) ? value : Math.round(value * 10) / 10} <span className="text-xs font-normal text-slate-500">{unit}</span>
      </p>
      {range && <p className="text-[10px] text-slate-600">{range}</p>}
    </div>
  );
}

/** Circular system-health gauge. */
export function HealthGauge({ value, label = "System health" }: { value: number; label?: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const hex = value >= 80 ? "#34d399" : value >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value)} percent`}>
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
        <motion.circle cx="64" cy="64" r={r} fill="none" stroke={hex} strokeWidth="9" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, Math.max(0, value)) / 100) }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-white"><AnimatedNumber value={value} decimals={0} /><span className="text-lg text-slate-400">%</span></span>
      </div>
    </div>
    <p className="kpi-label mt-2 text-center">{label}</p>
    </div>
  );
}

/** Contextual loading state: says what is being loaded instead of a bare spinner. */
export function LoadingPanel({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`card flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${className}`}>
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/10"><div className="absolute inset-y-0 w-1/3 rounded-full bg-sky-400 animate-shimmer" /></div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
