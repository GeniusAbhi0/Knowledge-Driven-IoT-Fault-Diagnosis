/** Single source of truth for how a device's health is classified (dashboard, digital twin, cards). */
export type DeviceState = "healthy" | "warning" | "critical" | "offline";

export function deviceState(d: { status: string; health_score: number }): DeviceState {
  if (d.status !== "online") return "offline";
  if (d.health_score < 50) return "critical";
  if (d.health_score < 80) return "warning";
  return "healthy";
}

export const STATE_STYLE: Record<DeviceState, { label: string; hex: string; text: string; bg: string; ring: string }> = {
  healthy: { label: "Healthy", hex: "#34d399", text: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  warning: { label: "Warning", hex: "#fbbf24", text: "text-amber-300", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  critical: { label: "Critical", hex: "#f87171", text: "text-red-300", bg: "bg-red-500/10", ring: "ring-red-500/30" },
  offline: { label: "Offline", hex: "#64748b", text: "text-slate-400", bg: "bg-slate-500/10", ring: "ring-slate-500/30" },
};
