import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Device } from "../types";
import { deviceState, STATE_STYLE, type DeviceState } from "../utils/deviceState";
import { Machine, StatusBeacon } from "./models";

const MAX_DEVICES = 16;
const GATEWAY = new THREE.Vector3(0, 1, -4.5);
const CLOUD = new THREE.Vector3(0, 5.8, -7);
const FOV = 42;
const HOME_LOOK = new THREE.Vector3(0, 2.4, -1.5);

/** Camera pose that frames every device for the current count and screen aspect (wide or portrait). */
export function homeFor(count: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const perRow = count <= 6 ? Math.max(count, 1) : Math.ceil(count / 2);
  const halfWidth = ((perRow - 1) * 3.6) / 2 + 3.2;
  const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const dist = Math.min(32, Math.max(15, halfWidth / (tanV * Math.max(aspect, 0.3))));
  return { look: HOME_LOOK, pos: new THREE.Vector3(0, HOME_LOOK.y + dist * 0.5, HOME_LOOK.z + dist * 0.87) };
}

export function layout(count: number): [number, number, number][] {
  const perRow = count <= 6 ? count : Math.ceil(count / 2);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, count - row * perRow);
    return [(col - (inRow - 1) / 2) * 3.6, 0, 1.5 + row * 3.8];
  });
}

/** Moves the camera toward the selected device (or home) for ~1.6s, then hands control back to the user. */
function CameraRig({ target, home }: { target: THREE.Vector3 | null; home: { pos: THREE.Vector3; look: THREE.Vector3 } }) {
  const { camera, controls } = useThree();
  const remaining = useRef(0);
  const ready = useRef(false);
  useEffect(() => { remaining.current = 1.6; }, [target, home]);
  useFrame((_, dt) => {
    const oc = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!oc) return;
    if (!ready.current) { camera.position.copy(home.pos); oc.target.copy(home.look); oc.update(); ready.current = true; return; }
    if (remaining.current <= 0) return;
    remaining.current -= dt;
    const k = 1 - Math.exp(-4 * dt);
    camera.position.lerp(target ? new THREE.Vector3(target.x + 3.4, 3.6, target.z + 6.2) : home.pos, k);
    oc.target.lerp(target ? new THREE.Vector3(target.x, 1, target.z) : home.look, k);
    oc.update();
  });
  return null;
}

let dotTexture: THREE.CanvasTexture | null = null;
function roundDot(): THREE.CanvasTexture {
  if (!dotTexture) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d")!; const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "#fff"); grad.addColorStop(0.55, "#fff"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32); dotTexture = new THREE.CanvasTexture(c);
  }
  return dotTexture;
}

/** Particles travelling a -> b; the count is small by design. */
function DataFlow({ from, to, color, active, count = 3, speed = 0.35 }: { from: THREE.Vector3; to: THREE.Vector3; color: string; active: boolean; count?: number; speed?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  useFrame(({ clock }) => {
    const pts = ref.current; if (!pts || !active) return;
    for (let i = 0; i < count; i++) {
      const t = (clock.getElapsedTime() * speed + i / count) % 1;
      positions[i * 3] = from.x + (to.x - from.x) * t;
      positions[i * 3 + 1] = from.y + (to.y - from.y) * t;
      positions[i * 3 + 2] = from.z + (to.z - from.z) * t;
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  if (!active) return null;
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} /></bufferGeometry>
      <pointsMaterial color={color} size={0.24} map={roundDot()} alphaTest={0.05} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

function Link({ a, b, color }: { a: THREE.Vector3; b: THREE.Vector3; color: string }) {
  const line = useMemo(() => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 })), [a, b, color]);
  return <primitive object={line} />;
}

function Label({ text, sub, color }: { text: string; sub?: string; color?: string }) {
  return (
    <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded border border-white/10 bg-ink-950/80 px-2 py-0.5 text-center text-[11px] font-medium text-slate-100">
        {color && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />}{text}
        {sub && <span className="block text-[9px] font-normal uppercase tracking-wider text-slate-500">{sub}</span>}
      </div>
    </Html>
  );
}

function DeviceNode({ device, position, selected, animate, compact, onSelect }: { device: Device; position: [number, number, number]; selected: boolean; animate: boolean; compact: boolean; onSelect: (id: number) => void }) {
  const state: DeviceState = deviceState(device);
  const hex = STATE_STYLE[state].hex;
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.scale.lerp(new THREE.Vector3().setScalar(selected ? 1.08 : 1), 1 - Math.exp(-8 * dt));
    if (halo.current && selected && animate) halo.current.rotation.z += dt * 0.8;
  });
  return (
    <group position={position}>
      <group ref={group}
        onClick={(e) => { e.stopPropagation(); onSelect(device.id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}>
        <Machine type={device.type} state={state} highlight={selected} animate={animate} />
        <StatusBeacon state={state} position={[0, 2.0, 0]} animate={animate} />
      </group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[selected ? 1.5 : 1.35, selected ? 1.6 : 1.4, 48]} />
        <meshBasicMaterial color={selected ? "#e0f2fe" : hex} transparent opacity={selected ? 0.9 : 0.35} />
      </mesh>
      {(!compact || selected) && <group position={[0, 2.6, 0]}><Label text={device.name} sub={STATE_STYLE[state].label} color={hex} /></group>}
    </group>
  );
}

function Gateway() {
  return (
    <group position={GATEWAY.toArray()}>
      <mesh position={[0, -0.5, 0]}><boxGeometry args={[1.8, 0.6, 1.1]} /><meshStandardMaterial color="#23324f" metalness={0.6} roughness={0.45} /></mesh>
      {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.15, 0]}><cylinderGeometry args={[0.04, 0.04, 0.7, 8]} /><meshStandardMaterial color="#44557a" /></mesh>)}
      <mesh position={[0, -0.5, 0.56]}><planeGeometry args={[1.2, 0.12]} /><meshStandardMaterial color="#082f49" emissive="#38bdf8" emissiveIntensity={0.9} /></mesh>
      <group position={[0, 0.9, 0]}><Label text="IoT Gateway" sub="Edge" /></group>
    </group>
  );
}

function Cloud() {
  return (
    <group position={CLOUD.toArray()}>
      {[[-0.7, 0, 0, 0.8], [0.2, 0.25, 0, 1], [0.95, -0.05, 0, 0.7]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1.25, 0.7, 0.9]}><sphereGeometry args={[r, 18, 14]} /><meshStandardMaterial color="#334766" metalness={0.2} roughness={0.7} emissive="#38bdf8" emissiveIntensity={0.12} /></mesh>))}
      <group position={[0, 1.2, 0]}><Label text="Cloud Platform" sub="Diagnosis engine" /></group>
    </group>
  );
}

function Scene({ devices, selectedId, onSelect, animate }: { devices: Device[]; selectedId: number | null; onSelect: (id: number | null) => void; animate: boolean }) {
  const shown = devices.slice(0, MAX_DEVICES);
  const positions = useMemo(() => layout(shown.length), [shown.length]);
  const vecs = useMemo(() => positions.map((p) => new THREE.Vector3(p[0], 1.6, p[2])), [positions]);
  const selectedIdx = shown.findIndex((d) => d.id === selectedId);
  const target = selectedIdx >= 0 ? new THREE.Vector3(...positions[selectedIdx]) : null;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const compact = useThree((s) => s.size.width < 520);
  const home = useMemo(() => homeFor(shown.length, aspect), [shown.length, aspect]);
  const gwUp = useMemo(() => GATEWAY.clone().setY(1.3), []);
  const cloudDown = useMemo(() => CLOUD.clone().setY(CLOUD.y - 0.6), []);
  return (
    <>
      <color attach="background" args={["#070b14"]} />
      <fog attach="fog" args={["#070b14", 22, 52]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#a9c8ff", "#1b2540", 0.8]} />
      <directionalLight position={[6, 12, 8]} intensity={1.8} />
      <pointLight position={[0, 4, -4]} intensity={14} color="#38bdf8" distance={16} />
      <gridHelper args={[34, 34, "#1d4468", "#0f1d33"]} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={() => onSelect(null)}><planeGeometry args={[60, 60]} /><meshBasicMaterial color="#070b14" /></mesh>
      <Cloud /><Gateway />
      <Link a={gwUp} b={cloudDown} color="#38bdf8" />
      <DataFlow from={gwUp} to={cloudDown} color="#38bdf8" active={animate && shown.some((d) => deviceState(d) !== "offline")} count={4} />
      {shown.map((d, i) => {
        const st = deviceState(d);
        return (
          <group key={d.id}>
            <DeviceNode device={d} position={positions[i]} selected={d.id === selectedId} animate={animate} compact={compact} onSelect={onSelect} />
            <Link a={vecs[i]} b={gwUp} color={STATE_STYLE[st].hex} />
            <DataFlow from={vecs[i]} to={gwUp} color={STATE_STYLE[st].hex} active={animate && st !== "offline"} speed={st === "critical" ? 0.55 : 0.35} />
          </group>);
      })}
      <CameraRig target={target} home={home} />
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={4} maxDistance={36} maxPolarAngle={Math.PI / 2.1} target={HOME_LOOK.toArray()} />
    </>
  );
}

export default function DigitalTwin3D(props: { devices: Device[]; selectedId: number | null; onSelect: (id: number | null) => void; animate: boolean }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 10, 16], fov: FOV }} gl={{ antialias: true, powerPreference: "high-performance" }} aria-label="Interactive 3D digital twin of monitored devices">
      <Scene {...props} />
    </Canvas>
  );
}
