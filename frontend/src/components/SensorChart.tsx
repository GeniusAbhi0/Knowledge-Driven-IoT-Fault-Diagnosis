import { clock as time } from "../utils/time";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props { title: string; unit: string; color: string; points: { ts: string; value: number }[] }


export default function SensorChart({ title, unit, color, points }: Props) {
  const data = points.map((p) => ({ t: time(p.ts), value: p.value }));
  const last = points[points.length - 1]?.value;
  return (
    <figure className="card p-4" aria-label={`${title} history`}>
      <figcaption className="mb-2 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{title}</span>
        <span className="text-sm font-semibold text-white">{last !== undefined ? `${last} ${unit}` : "—"}</span>
      </figcaption>
      <div className="h-36">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} minTickGap={40} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#0c1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} ${unit}`, title]} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="flex h-full items-center justify-center text-xs text-slate-500">No readings yet</p>}
      </div>
    </figure>
  );
}
