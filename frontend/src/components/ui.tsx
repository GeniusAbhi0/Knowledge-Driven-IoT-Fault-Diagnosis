import { AlertCircle, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Severity } from "../types";
import { AnimatedNumber } from "./industrial";

const SEVERITY_STYLES: Record<Severity, string> = {
  normal: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  low: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  critical: "bg-red-500/15 text-red-300 ring-red-500/30",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  normal: "#34d399", low: "#38bdf8", medium: "#fbbf24", high: "#fb923c", critical: "#f87171",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ring-1 ring-inset ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} aria-hidden />;
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />;
}

export function StatCard({ label, value, icon, tone = "text-sky-400", hint, suffix, accent }: { label: string; value: ReactNode | number; icon: ReactNode; tone?: string; hint?: string; suffix?: string; accent?: string }) {
  return (
    <div className="card card-hover relative overflow-hidden p-4">
      {accent && <span className="absolute inset-y-0 left-0 w-0.5" style={{ background: accent }} aria-hidden />}
      <div className="flex items-start justify-between gap-2">
        <p className="kpi-label leading-tight">{label}</p>
        <div className={`shrink-0 ${tone}`} aria-hidden>{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}{suffix && <span className="ml-0.5 text-lg text-slate-400">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, hint, tone = "neutral" }: { title: string; hint?: string; tone?: "neutral" | "ok" }) {
  const Icon = tone === "ok" ? CheckCircle2 : Inbox;
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className={`mb-3 rounded-full p-3 ${tone === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-slate-500"}`}><Icon className="h-6 w-6" aria-hidden /></div>
      <p className="font-medium text-slate-200">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-red-500/30 p-8 text-center">
      <div className="rounded-full bg-red-500/10 p-3 text-red-400"><AlertCircle className="h-6 w-6" aria-hidden /></div>
      <p className="font-medium text-slate-100">Something went wrong</p>
      <p className="max-w-md text-sm text-slate-400">{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}
