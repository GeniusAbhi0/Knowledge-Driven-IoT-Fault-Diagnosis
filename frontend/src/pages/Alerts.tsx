import { BellOff, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, SeverityBadge, Skeleton } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useLiveEvents } from "../contexts/LiveContext";
import { useToast } from "../contexts/ToastContext";
import { alertsApi, errorMessage } from "../services/api";
import type { AlertItem } from "../types";
import { timeAgo } from "../utils/time";

export default function Alerts() {
  const { user } = useAuth();
  const toast = useToast();
  const canAck = user?.role !== "viewer";
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [unread, setUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { try { setItems(await alertsApi.list(unread)); setError(null); } catch (e) { setError(errorMessage(e)); } }, [unread]);
  useEffect(() => { void load(); }, [load]);
  useLiveEvents((e) => { if (e.type === "fault") void load(); });

  const run = async (fn: () => Promise<void>) => { try { await fn(); await load(); } catch (e) { toast.push("error", errorMessage(e)); } };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-white">Alerts</h1><p className="text-sm text-slate-400">High and critical faults raise an alert</p></div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Unread only</label>
          {canAck && <button className="btn-ghost border border-white/10" onClick={() => run(alertsApi.readAll)}><CheckCheck className="h-4 w-4" aria-hidden /> Mark all read</button>}
        </div>
      </div>
      {error && !items ? <ErrorState message={error} onRetry={load} /> : !items ? <Skeleton className="h-48" /> : items.length === 0 ? <div className="card"><EmptyState title={unread ? "No unread alerts" : "No alerts yet"} /></div> : (
        <ul className="space-y-2">{items.map((a) => (
          <li key={a.id} className={`card flex items-center justify-between gap-3 p-3 ${a.is_read ? "opacity-60" : ""}`}>
            <div className="min-w-0"><div className="mb-1 flex items-center gap-2"><SeverityBadge severity={a.level} />{!a.is_read && <span className="h-2 w-2 rounded-full bg-sky-400" aria-label="Unread" />}</div>
              <Link to={`/faults/${a.diagnosis_id}`} className="block truncate text-sm text-slate-200 hover:text-sky-300">{a.message}</Link>
              <p className="text-xs text-slate-500">{timeAgo(a.created_at)}</p></div>
            {canAck && !a.is_read && <button className="btn-ghost p-2" aria-label="Mark as read" onClick={() => run(() => alertsApi.read(a.id))}><BellOff className="h-4 w-4" /></button>}
          </li>))}</ul>)}
    </div>
  );
}
