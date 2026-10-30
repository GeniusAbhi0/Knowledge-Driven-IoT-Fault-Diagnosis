import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TOKEN_KEY } from "../services/api";
import type { LiveEvent } from "../types";
import { useToast } from "./ToastContext";

export type LiveStatus = "connecting" | "live" | "offline";
type Listener = (e: LiveEvent) => void;
interface LiveApi { status: LiveStatus; subscribe: (l: Listener) => () => void }
const Ctx = createContext<LiveApi | null>(null);

/** One authenticated WebSocket for the whole app, with exponential-backoff reconnect. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const listeners = useRef(new Set<Listener>());
  const toast = useToast();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;

    const connect = () => {
      setStatus("connecting");
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      ws.onopen = () => ws?.send(JSON.stringify({ token: localStorage.getItem(TOKEN_KEY) }));
      ws.onmessage = (msg) => {
        let data: { type: string };
        try { data = JSON.parse(msg.data as string); } catch { return; }
        if (data.type === "connected") { retry = 0; setStatus("live"); return; }
        if (data.type !== "tick" && data.type !== "fault") return;
        const event = data as LiveEvent;
        if (event.type === "fault" && (event.severity === "critical" || event.severity === "high")) {
          toast.push("error", `${event.severity.toUpperCase()}: ${event.fault} on ${event.device} (${event.confidence}%)`);
        }
        listeners.current.forEach((l) => l(event));
      };
      ws.onclose = () => {
        setStatus("offline");
        if (!closed) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, [toast]);

  const subscribe = useCallback((l: Listener) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; }, []);
  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveStatus(): LiveStatus {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLiveStatus must be used inside LiveProvider");
  return ctx.status;
}

/** Subscribe to live events for the lifetime of the calling component. */
export function useLiveEvents(handler: Listener): void {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLiveEvents must be used inside LiveProvider");
  const ref = useRef(handler);
  ref.current = handler;
  const { subscribe } = ctx;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
