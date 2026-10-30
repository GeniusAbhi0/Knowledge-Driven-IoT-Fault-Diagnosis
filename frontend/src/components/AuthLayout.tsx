import { Activity, Cpu, Network, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const POINTS = [
  { icon: Cpu, text: "Live status of every monitored machine" },
  { icon: Network, text: "Knowledge-driven rules, not black-box alerts" },
  { icon: ShieldCheck, text: "Every diagnosis shows its evidence and actions" },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[.06] bg-ink-900/60 p-10 lg:flex" aria-hidden>
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(56,189,248,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.08)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400"><Activity className="h-5 w-5" /></span>
          <span className="text-sm font-semibold leading-tight tracking-[.14em] text-white">K-IOT<br /><span className="font-normal text-slate-400">DIAGNOSTICS</span></span></div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">Industrial monitoring with explainable fault diagnosis.</h2>
          <ul className="space-y-3">{POINTS.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-sm text-slate-300"><Icon className="h-4 w-4 shrink-0 text-sky-400" />{text}</li>)}</ul>
          <svg viewBox="0 0 320 120" className="w-full max-w-sm text-sky-400/70" fill="none" stroke="currentColor"><rect x="125" y="6" width="70" height="22" rx="6" /><path d="M160 28V40M160 60V70M50 70H270M50 70V80M160 70V80M270 70V80" strokeDasharray="4 4" className="animate-dash-flow" />
            <rect x="125" y="40" width="70" height="20" rx="6" /><rect x="15" y="80" width="70" height="26" rx="6" /><rect x="125" y="80" width="70" height="26" rx="6" /><rect x="235" y="80" width="70" height="26" rx="6" />
            <circle cx="30" cy="93" r="3" fill="#34d399" stroke="none" /><circle cx="140" cy="93" r="3" fill="#f87171" stroke="none" className="animate-pulse-soft" /><circle cx="250" cy="93" r="3" fill="#34d399" stroke="none" /></svg>
        </div>
        <p className="relative text-xs text-slate-500">Software-based IoT simulation. No physical hardware required.</p>
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="card w-full max-w-sm space-y-5 p-6 shadow-2xl">
          <div className="space-y-1">
            <div className="mb-3 flex items-center gap-2 font-semibold tracking-wide text-white lg:hidden"><Activity className="h-5 w-5 text-sky-400" aria-hidden /> K-IOT DIAGNOSTICS</div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({ id, label, error, ...props }: { id: string; label: string; error?: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-slate-300">{label}</label>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      {error && <p id={`${id}-err`} className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
