import { Brain, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader, SensorCard, StatusBadge } from "../components/industrial";
import { SeverityBadge, Spinner } from "../components/ui";
import { assistantApi, dashboardApi, devicesApi, errorMessage, faultHistoryApi, kbApi } from "../services/api";
import type { Device, FaultRecord, KnowledgeEntry } from "../types";
import { deviceState } from "../utils/deviceState";

interface Msg { role: "user" | "bot"; text: string; note?: string }
const SUGGESTIONS = ["Why is this device showing a fault?", "What are the possible causes?", "What should I do to fix it?"];
const OPEN = ["detected", "investigating"];

export default function Assistant() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<number | undefined>();
  const [readings, setReadings] = useState<Record<string, number>>({});
  const [fault, setFault] = useState<FaultRecord | null>(null);
  const [kb, setKb] = useState<KnowledgeEntry | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: "Select a device and ask about its faults. I answer from the live diagnoses and the knowledge base, and show the evidence alongside." }]);
  const end = useRef<HTMLDivElement>(null);
  const device = devices.find((d) => d.id === deviceId);

  useEffect(() => { devicesApi.list().then(setDevices).catch(() => undefined); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  // Diagnostic context shown next to the conversation (all real data).
  useEffect(() => {
    setFault(null); setKb(null); setReadings({});
    if (deviceId === undefined) return;
    dashboardApi.series(deviceId, 1).then((s) => setReadings(Object.fromEntries(Object.entries(s).flatMap(([k, v]) => (v.points.length ? [[k, v.points[v.points.length - 1].value]] : []))))).catch(() => undefined);
    faultHistoryApi.page({ device_id: deviceId, sort: "severity", limit: 10 }).then(({ items }) => {
      const f = items.find((x) => OPEN.includes(x.status)) ?? null;
      setFault(f);
      if (f) kbApi.list(f.fault).then((l) => setKb(l.find((k) => k.fault_name === f.fault) ?? null)).catch(() => undefined);
    }).catch(() => undefined);
  }, [deviceId]);

  const send = async (text: string) => {
    const q = text.trim();
    if (q.length < 2 || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]); setInput(""); setBusy(true);
    try { const r = await assistantApi.ask(q, deviceId); setMsgs((m) => [...m, { role: "bot", text: r.answer, note: r.source === "llm" ? "AI-generated from diagnosis data" : "Generated from rules and diagnosis data" }]); }
    catch (e) { setMsgs((m) => [...m, { role: "bot", text: errorMessage(e) }]); } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void send(input); };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Diagnostic assistant" subtitle="Plain-language explanations grounded in live diagnoses and the knowledge base" />
      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        <aside className="card space-y-4 p-4" aria-label="Diagnostic context">
          <label className="block text-sm"><span className="kpi-label mb-1 block">Device in context</span>
            <select className="input" value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">None (mention a device name)</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          {device ? (<>
            <div className="flex items-center justify-between"><StatusBadge state={deviceState(device)} /><span className="text-sm text-slate-400">Health <b className="text-white">{Math.round(device.health_score)}%</b></span></div>
            {fault ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2"><p className="font-medium text-white">{fault.fault}</p><SeverityBadge severity={fault.severity} /></div>
                <p className="kpi-label">Evidence</p>
                <ul className="space-y-1 text-sm">{fault.evidence.map((e) => <li key={`${e.sensor}${e.op}${e.threshold}`} className="text-slate-300"><span className="text-emerald-400">✓</span> <span className="capitalize">{e.sensor}</span> {e.value} <span className="text-slate-500">({e.op} {e.threshold})</span></li>)}</ul>
                {kb && (<><p className="kpi-label pt-1">Related knowledge</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">{kb.causes.slice(0, 3).map((c) => <li key={c}>{c}</li>)}</ul>
                  {kb.rule?.actions[0] && <p className="text-xs text-slate-400"><span className="text-emerald-400">Action:</span> {kb.rule.actions[0]}</p>}</>)}
                <Link to={`/faults/${fault.id}`} className="inline-block text-sm text-sky-300 hover:underline">Open full diagnosis →</Link>
              </div>
            ) : <p className="text-sm text-emerald-300/80">No open faults for this device.</p>}
            <div className="grid grid-cols-2 gap-2">{["temperature", "vibration", "current", "rpm"].map((k) => { const s = device.sensors.find((x) => x.kind === k); return s && <SensorCard key={k} label={k} value={readings[k]} unit={s.unit} tone={readings[k] !== undefined && (readings[k] < s.min_normal || readings[k] > s.max_normal) ? "warn" : "ok"} />; })}</div>
          </>) : <p className="text-sm text-slate-500">Pick a device to see its status, evidence and related knowledge here while you chat.</p>}
        </aside>

        <section className="card flex min-h-[32rem] flex-col" aria-label="Conversation">
          <header className="flex items-center gap-2 border-b border-white/[.06] px-4 py-3"><Brain className="h-5 w-5 text-sky-400" aria-hidden /><h2 className="text-sm font-semibold text-white">Diagnostic assistant{device ? ` · ${device.name}` : ""}</h2></header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-sky-500/15 text-sky-100" : "border border-white/[.06] bg-white/[.03] text-slate-200"}`}>
                  {m.role === "bot" && <p className="kpi-label mb-1">Assistant</p>}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>{m.note && <p className="mt-1.5 text-[11px] text-slate-500">{m.note}</p>}</div>
              </div>))}
            {busy && <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner />Analyzing diagnostic information…</div>}
            <div ref={end} />
          </div>
          <div className="space-y-3 border-t border-white/[.06] p-3">
            <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/5" onClick={() => send(s)} disabled={busy}>{s}</button>)}</div>
            <form onSubmit={submit} className="flex gap-2">
              <input className="input" aria-label="Your question" placeholder={device ? `Ask about ${device.name}…` : "Why is Motor-001 showing a critical fault?"} maxLength={500} value={input} onChange={(e) => setInput(e.target.value)} />
              <button className="btn" disabled={busy || input.trim().length < 2} aria-label="Send"><Send className="h-4 w-4" /></button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
