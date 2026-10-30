import { Cpu } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import { STATE_STYLE, type DeviceState } from "../utils/deviceState";
import { hasWebGL, prefersReducedMotion } from "./webgl";

const Device3D = lazy(() => import("./Device3D"));

function Placeholder({ state, label }: { state: DeviceState; label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-ink-950 text-center">
      <Cpu className="h-10 w-10" style={{ color: STATE_STYLE[state].hex }} aria-hidden />
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

/** 3D model of one real device (type + state); falls back to an icon without WebGL. */
export default function DeviceModelView({ type, state }: { type: string; state: DeviceState }) {
  const webgl = useMemo(hasWebGL, []);
  const reduce = useMemo(prefersReducedMotion, []);
  if (!webgl) return <Placeholder state={state} label="3D preview unavailable on this device" />;
  return (
    <ErrorBoundary fallback={<Placeholder state={state} label="3D preview unavailable" />}>
      <Suspense fallback={<Placeholder state={state} label="Loading 3D model…" />}>
        <Device3D type={type} state={state} animate={!reduce} />
      </Suspense>
    </ErrorBoundary>
  );
}
