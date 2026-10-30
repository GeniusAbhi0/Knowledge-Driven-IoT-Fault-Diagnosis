import { useEffect, useState } from "react";
import { devicesApi } from "../services/api";
import type { Device, FaultFilters } from "../types";

export const DEFAULT_FILTERS: FaultFilters = { device_id: "", severity: "", status: "", date_from: "", date_to: "", sort: "newest" };

export default function FaultFilterBar({ value, onChange, showSort = true }: { value: FaultFilters; onChange: (f: FaultFilters) => void; showSort?: boolean }) {
  const [devices, setDevices] = useState<Device[]>([]);
  useEffect(() => { devicesApi.list().then(setDevices).catch(() => undefined); }, []);
  const set = (k: keyof FaultFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-xs text-slate-400"><span className="mb-1 block">{t}</span>{children}</label>;
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Fault filters">
      <L t="Device"><select className="input" value={value.device_id} onChange={set("device_id")}><option value="">All devices</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></L>
      <L t="Severity"><select className="input" value={value.severity} onChange={set("severity")}><option value="">Any</option>{["low", "medium", "high", "critical"].map((s) => <option key={s}>{s}</option>)}</select></L>
      <L t="Status"><select className="input" value={value.status} onChange={set("status")}><option value="">Any</option>{["detected", "investigating", "resolved", "ignored"].map((s) => <option key={s}>{s}</option>)}</select></L>
      <L t="From"><input type="date" className="input" value={value.date_from} onChange={set("date_from")} /></L>
      <L t="To"><input type="date" className="input" value={value.date_to} onChange={set("date_to")} /></L>
      {showSort && <L t="Sort"><select className="input" value={value.sort} onChange={set("sort")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="severity">Highest severity</option></select></L>}
    </div>
  );
}
