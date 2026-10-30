import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { DeviceState } from "../utils/deviceState";
import { STATE_STYLE } from "../utils/deviceState";

const BODY = "#4a608c";
const METAL = "#7186b0";
const DARK = "#2b3a58";

const Mat = ({ color = BODY, emissive, intensity = 0 }: { color?: string; emissive?: string; intensity?: number }) =>
  <meshStandardMaterial color={color} metalness={0.12} roughness={0.55} emissive={emissive ?? "#000000"} emissiveIntensity={intensity} />;

/** Rotating part (fans); stops when the device is offline or motion is reduced. */
function Spinner({ active, children, position = [0, 0, 0] as [number, number, number], speed = 4 }: { active: boolean; children: React.ReactNode; position?: [number, number, number]; speed?: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => { if (active && ref.current) ref.current.rotation.y += dt * speed; });
  return <group ref={ref} position={position}>{children}</group>;
}

/** Status light: steady (healthy), soft pulse (warning), fast pulse + expanding ring (critical), dark (offline). */
export function StatusBeacon({ state, position, animate = true }: { state: DeviceState; position: [number, number, number]; animate?: boolean }) {
  const core = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const hex = STATE_STYLE[state].hex;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const m = core.current?.material as MeshStandardMaterial | undefined;
    if (m) {
      const hz = state === "critical" ? 3.2 : state === "warning" ? 1.6 : 0.6;
      m.emissiveIntensity = state === "offline" ? 0 : animate ? (state === "healthy" ? 1.1 : 1.2) + Math.sin(t * hz * Math.PI * 2) * (state === "critical" ? 0.8 : state === "warning" ? 0.45 : 0.12) : 1.2;
    }
    if (ring.current) {
      const k = animate && state === "critical" ? (t * 1.3) % 1 : 0;
      ring.current.scale.setScalar(1 + k * 2.2);
      (ring.current.material as MeshStandardMaterial).opacity = state === "critical" ? 0.55 * (1 - k) : 0;
    }
  });
  return (
    <group position={position}>
      <mesh ref={core}><sphereGeometry args={[0.15, 16, 16]} /><meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={1.2} /></mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.2, 0.25, 32]} /><meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={1} transparent opacity={0} depthWrite={false} /></mesh>
    </group>
  );
}

export interface MachineProps { type: string; state: DeviceState; highlight?: boolean; animate?: boolean }

/** Low-poly stylised machine chosen by the device's real `type`. Heights keep the beacon at y ≈ 1.7. */
export function Machine({ type, state, highlight = false, animate = true }: MachineProps) {
  const spin = animate && state !== "offline";
  const glow = highlight ? STATE_STYLE[state].hex : undefined;
  const body = <Mat emissive={glow} intensity={highlight ? 0.18 : 0} />;
  return (
    <group>
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[2, 0.2, 1.4]} /><Mat color={DARK} /></mesh>
      {type === "Industrial Motor" && (<>
        <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.55, 0.55, 1.5, 24]} />{body}</mesh>
        <mesh position={[0.82, 0.85, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.6, 0.6, 0.18, 24]} /><Mat color={METAL} /></mesh>
        <mesh position={[-0.82, 0.85, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.6, 0.6, 0.18, 24]} /><Mat color={METAL} /></mesh>
        <mesh position={[0, 1.5, 0]}><boxGeometry args={[0.5, 0.25, 0.4]} /><Mat color={METAL} /></mesh>
      </>)}
      {type === "Pump" && (<>
        <mesh position={[0, 0.9, 0]}><sphereGeometry args={[0.6, 20, 16]} />{body}</mesh>
        <mesh position={[-0.9, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.22, 0.22, 1, 16]} /><Mat color={METAL} /></mesh>
        <mesh position={[0, 1.65, 0]}><cylinderGeometry args={[0.2, 0.2, 0.7, 16]} /><Mat color={METAL} /></mesh>
        <mesh position={[0.85, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.35, 0.35, 0.6, 16]} /><Mat color={BODY} /></mesh>
      </>)}
      {type === "HVAC System" && (<>
        <mesh position={[0, 0.8, 0]}><boxGeometry args={[1.8, 1.2, 1.2]} />{body}</mesh>
        <Spinner active={spin} position={[0, 1.43, 0]} speed={5}><mesh><cylinderGeometry args={[0.45, 0.45, 0.06, 20]} /><Mat color={METAL} /></mesh><mesh><boxGeometry args={[0.8, 0.07, 0.1]} /><Mat color={DARK} /></mesh></Spinner>
      </>)}
      {type === "Generator" && (<>
        <mesh position={[0, 0.7, 0]}><boxGeometry args={[1.9, 0.9, 1.1]} />{body}</mesh>
        <mesh position={[0.3, 1.3, 0]}><cylinderGeometry args={[0.32, 0.32, 0.5, 20]} /><Mat color={METAL} /></mesh>
        <mesh position={[-0.6, 1.4, 0.3]}><cylinderGeometry args={[0.08, 0.08, 0.7, 10]} /><Mat color={DARK} /></mesh>
      </>)}
      {type === "Cooling System" && (<>
        <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.6, 0.6, 1.3, 24]} />{body}</mesh>
        {[0.45, 0.85, 1.25].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.04, 8, 28]} /><Mat color={METAL} /></mesh>)}
        <Spinner active={spin} position={[0, 1.55, 0]} speed={6}><mesh><boxGeometry args={[0.9, 0.05, 0.12]} /><Mat color={DARK} /></mesh><mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.9, 0.05, 0.12]} /><Mat color={DARK} /></mesh></Spinner>
      </>)}
      {!["Industrial Motor", "Pump", "HVAC System", "Generator", "Cooling System"].includes(type) && (<>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[1.5, 0.8, 1.1]} />{body}</mesh>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.0, 0.45, 0.8]} /><Mat color={METAL} /></mesh>
        <mesh position={[0, 1.2, 0.41]}><planeGeometry args={[0.7, 0.28]} /><meshStandardMaterial color="#0e2a3a" emissive="#38bdf8" emissiveIntensity={state === "offline" ? 0 : 0.5} /></mesh>
      </>)}
    </group>
  );
}
