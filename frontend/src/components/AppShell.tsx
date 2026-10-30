import { AnimatePresence, motion } from "framer-motion";
import { Activity, BookOpen, Bot, Bell, ChevronDown, Cpu, FileText, History, LayoutDashboard, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Radio, Search, Settings as Cog, Stethoscope, User as UserIcon, X, type LucideIcon } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLiveStatus } from "../contexts/LiveContext";
import { useDismiss } from "../hooks/useDismiss";
import NotificationBell from "./NotificationBell";

// Add an entry here whenever a page is added to the router.
const GROUPS: { label: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
  { label: "Monitor", items: [{ to: "/", label: "Overview", icon: LayoutDashboard }, { to: "/devices", label: "Devices", icon: Cpu }, { to: "/monitoring", label: "Live monitoring", icon: Radio }] },
  { label: "Diagnose", items: [{ to: "/diagnosis", label: "Diagnostics", icon: Stethoscope }, { to: "/faults", label: "Fault history", icon: History }, { to: "/alerts", label: "Alerts", icon: Bell }] },
  { label: "Knowledge", items: [{ to: "/knowledge-base", label: "Knowledge base", icon: BookOpen }, { to: "/rules", label: "Rules", icon: ListChecks }, { to: "/assistant", label: "AI Assistant", icon: Bot }] },
  { label: "Manage", items: [{ to: "/reports", label: "Reports", icon: FileText }, { to: "/settings", label: "Settings", icon: Cog }] },
];
const STORE = "iot.sidebar";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1" aria-label="K-IoT Diagnostics home">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400"><Activity className="h-[18px] w-[18px]" /></span>
      {!compact && <span className="text-[13px] font-semibold leading-tight tracking-[.12em] text-white">K-IOT<br /><span className="font-normal text-slate-400">DIAGNOSTICS</span></span>}
    </Link>
  );
}

function SideNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-visible py-2">
      {GROUPS.map((g) => (
        <div key={g.label}>
          {!collapsed && <p className="kpi-label mb-1 px-3">{g.label}</p>}
          {collapsed && <div className="mx-3 mb-1 border-t border-white/[.06]" />}
          <ul className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} end={to === "/"} onClick={onNavigate} aria-label={collapsed ? label : undefined}
                  className={({ isActive }) => `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${collapsed ? "justify-center" : ""} ${isActive ? "bg-sky-500/10 text-sky-300 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-400" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {collapsed && <span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-xs text-slate-100 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>}
                </NavLink>
              </li>))}
          </ul>
        </div>))}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const initials = (user?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/5" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open} aria-label="Account menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">{initials}</span>
        <span className="hidden text-left sm:block"><span className="block text-sm leading-tight text-white">{user?.name}</span><span className="block text-[11px] capitalize leading-tight text-slate-500">{user?.role}</span></span>
        <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" aria-hidden />
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-56 bg-ink-900 p-1 shadow-xl" role="menu">
          <p className="truncate px-3 py-2 text-xs text-slate-500">{user?.email}</p>
          <Link to="/profile" onClick={close} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><UserIcon className="h-4 w-4" aria-hidden />Profile</Link>
          <button onClick={logout} role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
        </div>)}
    </div>
  );
}

function LiveChip() {
  const status = useLiveStatus();
  const cfg = { live: ["Live", "bg-emerald-400", "text-emerald-300"], connecting: ["Connecting", "bg-amber-400", "text-amber-300"], offline: ["Offline", "bg-slate-500", "text-slate-400"] }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs ${cfg[2]}`} role="status" aria-label={`Live data connection: ${cfg[0]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg[1]} ${status === "live" ? "animate-pulse-soft" : ""}`} aria-hidden /><span className="hidden sm:inline">{cfg[0]}</span>
    </span>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => { const s = localStorage.getItem(STORE); return s ? s === "collapsed" : window.innerWidth < 1280; });
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const toggle = () => { const next = !collapsed; setCollapsed(next); localStorage.setItem(STORE, next ? "collapsed" : "expanded"); };
  const search = (e: FormEvent) => { e.preventDefault(); const t = q.trim(); if (t) navigate(`/devices?q=${encodeURIComponent(t)}`); };

  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[.06] bg-ink-950 p-3 transition-[width] duration-200 md:flex ${collapsed ? "w-[4.5rem]" : "w-60"}`}>
        <div className={`mb-3 flex h-10 items-center ${collapsed ? "justify-center" : ""}`}><Brand compact={collapsed} /></div>
        <SideNav collapsed={collapsed} />
        <button onClick={toggle} className="btn-ghost mt-2 justify-center" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" /><span>Collapse</span></>}
        </button>
      </aside>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.div className="absolute inset-y-0 left-0 flex w-64 max-w-[85%] flex-col bg-ink-950 p-3" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "tween", duration: 0.2 }}>
              <div className="mb-3 flex h-10 items-center justify-between"><Brand /><button className="btn-ghost p-2" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
              <SideNav collapsed={false} onNavigate={() => setDrawer(false)} />
            </motion.div>
          </div>)}
      </AnimatePresence>

      <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-[4.5rem]" : "md:pl-60"}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[.06] bg-ink-950/85 px-3 backdrop-blur-sm sm:gap-3 sm:px-6">
          <button className="btn-ghost px-2 md:hidden" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}><Menu className="h-5 w-5" /></button>
          <span className="md:hidden"><Brand compact /></span>
          <form onSubmit={search} role="search" className="relative min-w-0 max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
            <input className="input pl-9" placeholder="Search devices…" aria-label="Search devices" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:gap-2"><LiveChip /><NotificationBell /><UserMenu /></div>
        </header>
        <motion.main key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-4 sm:p-6">
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
