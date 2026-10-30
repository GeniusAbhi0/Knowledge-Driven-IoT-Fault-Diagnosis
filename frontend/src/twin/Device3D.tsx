import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { DeviceState } from "../utils/deviceState";
import { Machine, StatusBeacon } from "./models";

export default function Device3D({ type, state, animate }: { type: string; state: DeviceState; animate: boolean }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [3.6, 2.6, 4.2], fov: 40 }} aria-label={`3D model of a ${type}`}>
      <color attach="background" args={["#0a1020"]} />
      <ambientLight intensity={0.8} /><directionalLight position={[4, 6, 4]} intensity={1.1} /><pointLight position={[-3, 2, -2]} intensity={5} color="#38bdf8" distance={10} />
      <gridHelper args={[12, 12, "#1d4468", "#0f1d33"]} />
      <Machine type={type} state={state} animate={animate} />
      <StatusBeacon state={state} position={[0, 2, 0]} animate={animate} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={animate} autoRotateSpeed={1.4} target={[0, 0.9, 0]} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}
