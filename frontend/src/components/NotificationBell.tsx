import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDismiss } from "../hooks/useDismiss";
import { useLiveEvents } from "../contexts/LiveContext";
import { alertsApi } from "../services/api";
import type { AlertItem } from "../types";
import { timeAgo } from "../utils/time";
import { SeverityBadge } from "./ui";

export default function NotificationBell() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const load = useCallback(() => { alertsApi.list(true).then(setItems).catch(() => undefined); }, []);
  useEffect(load, [load]);
  useLiveEvents((e) => { if (e.type === "fault") load(); });

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative px-2" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open} aria-label={`Notifications, ${items.length} unread`}>
        <Bell className="h-5 w-5" />
        {items.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{items.length > 99 ? "99+" : items.length}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-80 max-w-[88vw] overflow-hidden bg-ink-900 shadow-xl" role="menu">
          <p className="border-b border-white/[.06] px-4 py-2.5 text-sm font-medium text-white">Notifications</p>
          {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">No unread alerts. All clear.</p> : (
            <ul className="max-h-72 divide-y divide-white/5 overflow-y-auto">
              {items.slice(0, 6).map((a) => (
                <li key={a.id}><Link to={`/faults/${a.diagnosis_id}`} onClick={close} className="block px-4 py-2.5 hover:bg-white/5" role="menuitem">
                  <div className="mb-0.5 flex items-center justify-between"><SeverityBadge severity={a.level} /><span className="text-[11px] text-slate-500">{timeAgo(a.created_at)}</span></div>
                  <p className="truncate text-sm text-slate-200">{a.message}</p></Link></li>))}
            </ul>)}
          <Link to="/alerts" onClick={close} className="block border-t border-white/[.06] px-4 py-2.5 text-center text-sm text-sky-400 hover:bg-white/5">View all alerts</Link>
        </div>)}
    </div>
  );
}
