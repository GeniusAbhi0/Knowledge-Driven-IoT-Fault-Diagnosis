import { CheckCircle2 } from "lucide-react";
import type { DiagnosisItem, DiagnosisReport } from "../types";
import { SEVERITY_COLORS, SeverityBadge } from "./ui";

const OP_WORDS: Record<string, string> = { ">": "above", ">=": "at or above", "<": "below", "<=": "at or below" };

/** Explainable view of one detected fault: what, why, evidence, causes, actions. */
export function DiagnosisCard({ d }: { d: DiagnosisItem }) {
  const color = SEVERITY_COLORS[d.severity];
  return (
    <article className="card overflow-hidden" aria-label={`Diagnosis: ${d.fault}`}>
      <div className="h-1" style={{ background: color }} />
      <div className="space-y-4 p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">{d.fault}</h3>
          <SeverityBadge severity={d.severity} />
        </header>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Confidence</span><span className="font-medium text-white">{d.confidence}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Confidence" aria-valuenow={d.confidence} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${d.confidence}%`, background: color }} />
          </div>
        </div>

        <p className="text-sm text-slate-300">{d.what_happened}</p>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="pb-1 pr-3 font-medium">Sensor</th><th className="pb-1 pr-3 font-medium">Reading</th><th className="pb-1 font-medium">Threshold</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {d.evidence.map((e) => (
                  <tr key={`${e.sensor}${e.op}${e.threshold}`} title={e.explanation}>
                    <td className="py-1.5 pr-3 capitalize text-slate-200">{e.sensor}</td>
                    <td className="py-1.5 pr-3 font-medium" style={{ color }}>{e.value}</td>
                    <td className="py-1.5 text-slate-400">{OP_WORDS[e.op] ?? e.op} {e.threshold}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <List title="Possible causes" items={d.causes} />
          <List title="Recommended actions" items={d.actions} ordered />
        </div>
        {d.prevention.length > 0 && <List title="Preventive measures" items={d.prevention} />}
      </div>
    </article>
  );
}

function List({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <Tag className={`space-y-1 pl-5 text-sm text-slate-300 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((i) => <li key={i}>{i}</li>)}</Tag>
    </section>
  );
}

export function DiagnosisReportView({ report }: { report: DiagnosisReport }) {
  if (report.healthy) {
    return (
      <div className="card flex items-center gap-3 border-emerald-500/30 p-4 text-emerald-300" role="status">
        <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden />
        <div><p className="font-medium">System healthy</p><p className="text-sm text-emerald-300/70">All readings are within the knowledge-base rules.</p></div>
      </div>
    );
  }
  return <div className="space-y-4">{report.diagnoses.map((d) => <DiagnosisCard key={d.fault} d={d} />)}</div>;
}
