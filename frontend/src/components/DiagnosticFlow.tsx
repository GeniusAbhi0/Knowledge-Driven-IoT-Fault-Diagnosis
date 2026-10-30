import { motion } from "framer-motion";
import { BookOpen, Check, ClipboardList, Cpu, Database, Radar, ScanSearch, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DiagnosisReport } from "../types";

const STEPS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "data", label: "Sensor data", icon: Database },
  { key: "abn", label: "Abnormality detection", icon: Radar },
  { key: "rules", label: "Rule engine", icon: Cpu },
  { key: "kb", label: "Knowledge base", icon: BookOpen },
  { key: "ev", label: "Evidence matching", icon: ScanSearch },
  { key: "dx", label: "Fault diagnosis", icon: ClipboardList },
  { key: "act", label: "Recommended action", icon: Wrench },
];

/** Presentation of the existing diagnosis run: animates while it runs, then summarises what each stage produced. */
export function stageDetails(report: DiagnosisReport | null, readingCount: number): string[] {
  const top = report?.diagnoses[0];
  const evidence = report?.diagnoses.reduce((n, d) => n + d.evidence.length, 0) ?? 0;
  return [
    `${readingCount} readings`,
    report ? (evidence ? `${evidence} outside rules` : "none found") : "",
    report ? `${report.diagnoses.length} rule${report.diagnoses.length === 1 ? "" : "s"} fired` : "",
    top ? top.fault : report ? "no match" : "",
    report ? `${evidence} evidence item${evidence === 1 ? "" : "s"}` : "",
    top ? `${top.severity} · ${top.confidence}%` : report ? "System healthy" : "",
    top ? `${top.actions.length} step${top.actions.length === 1 ? "" : "s"}` : report ? "None needed" : "",
  ];
}

export default function DiagnosticFlow({ running, report, readingCount }: { running: boolean; report: DiagnosisReport | null; readingCount: number }) {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (running) {
      setActive(0);
      const t = setInterval(() => setActive((i) => Math.min(i + 1, STEPS.length - 2)), 420);
      return () => clearInterval(t);
    }
    setActive(report ? STEPS.length : -1);
  }, [running, report]);
  const details = stageDetails(report, readingCount);

  return (
    <section className="card p-4 sm:p-5" aria-label="Diagnostic reasoning flow">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-white">Reasoning flow</h2>
        <p className="text-xs text-slate-500">{running ? "Analyzing diagnostic information…" : report ? "Diagnosis complete" : "Run a diagnosis to see how the conclusion is reached"}</p>
      </div>
      <ol className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-0">
        {STEPS.map((s, i) => {
          const done = i < active, current = i === active && running, Icon = s.icon;
          return (
            <li key={s.key} className="flex flex-1 items-center lg:flex-col lg:items-stretch">
              <div className="flex flex-1 items-center gap-3 lg:flex-col lg:gap-2 lg:text-center">
                <motion.div animate={{ scale: current ? 1.08 : 1 }} transition={{ duration: 0.25 }}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${done ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300" : current ? "border-sky-400 bg-sky-500/15 text-sky-300" : "border-white/10 bg-white/[.03] text-slate-500"}`}>
                  {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                  {current && <span className="absolute inset-0 animate-ping rounded-full border border-sky-400/60" aria-hidden />}
                </motion.div>
                <div className="min-w-0 lg:px-1"><p className={`text-xs font-medium ${done || current ? "text-slate-100" : "text-slate-500"}`}>{s.label}</p>
                  <p className="min-h-4 truncate text-[11px] text-slate-500 first-letter:uppercase">{done && !running ? details[i] : ""}</p></div>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-5 h-4 w-px self-stretch lg:hidden ${done ? "bg-emerald-400/40" : "bg-white/10"}`} aria-hidden />}
            </li>);
        })}
      </ol>
      <div className="relative mt-3 hidden h-px bg-white/10 lg:block" aria-hidden>
        <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-sky-400" animate={{ width: `${Math.max(0, Math.min(active, STEPS.length)) / STEPS.length * 100}%` }} transition={{ duration: 0.35 }} />
      </div>
    </section>
  );
}
