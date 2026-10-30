import type { Device } from "../types";
import { deviceState, STATE_STYLE } from "../utils/deviceState";

/** 2D topology used when WebGL is unavailable, 3D is switched off, or the 3D scene fails. Same data, same selection. */
export default function TwinFallback({ devices, selectedId, onSelect }: { devices: Device[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const shown = devices.slice(0, 16);
  const w = Math.max(360, shown.length * 96), cx = w / 2;
  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden">
      <svg viewBox={`0 0 ${w} 260`} style={{ minWidth: w }} className="mx-auto h-full w-full" role="group" aria-label="Device topology">
        <rect x={cx - 52} y="10" width="104" height="34" rx="8" fill="#131b2e" stroke="#334766" /><text x={cx} y="31" textAnchor="middle" fontSize="11" fill="#cbd5e1">Cloud Platform</text>
        <line x1={cx} y1="44" x2={cx} y2="84" stroke="#38bdf8" strokeOpacity=".6" strokeDasharray="4 4" className="animate-dash-flow" />
        <rect x={cx - 48} y="84" width="96" height="30" rx="8" fill="#131b2e" stroke="#334766" /><text x={cx} y="103" textAnchor="middle" fontSize="11" fill="#cbd5e1">IoT Gateway</text>
        {shown.map((d, i) => {
          const x = 48 + i * ((w - 96) / Math.max(1, shown.length - 1 || 1)) * (shown.length > 1 ? 1 : 0) + (shown.length === 1 ? cx - 48 : 0);
          const st = deviceState(d), hex = STATE_STYLE[st].hex, sel = d.id === selectedId;
          return (
            <g key={d.id} tabIndex={0} role="button" aria-label={`${d.name}, ${STATE_STYLE[st].label}`} aria-pressed={sel} style={{ cursor: "pointer" }}
              onClick={() => onSelect(d.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d.id)}>
              <line x1={cx} y1="114" x2={x} y2="170" stroke={hex} strokeOpacity={st === "offline" ? 0.2 : 0.6} strokeDasharray="4 4" className={st === "offline" ? "" : "animate-dash-flow"} />
              <rect x={x - 38} y="170" width="76" height="54" rx="8" fill={sel ? "#1c2740" : "#131b2e"} stroke={sel ? "#e0f2fe" : hex} strokeOpacity={sel ? 1 : 0.55} />
              <circle cx={x} cy="187" r="5" fill={hex} className={st === "critical" ? "animate-pulse-soft" : ""} />
              <text x={x} y="208" textAnchor="middle" fontSize="10" fill="#e2e8f0">{d.name.length > 11 ? `${d.name.slice(0, 10)}…` : d.name}</text>
              <text x={x} y="219" textAnchor="middle" fontSize="8" fill="#64748b">{STATE_STYLE[st].label}</text>
            </g>);
        })}
      </svg>
    </div>
  );
}
