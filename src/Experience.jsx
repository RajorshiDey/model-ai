import { OrbitControls, Environment } from "@react-three/drei";
import { Avatar } from "./Avatar";

export default function Experience({ isSpeaking, emotion }) {
  return (
    <>
      <OrbitControls enableZoom={false} enableRotate={false} 
        enablePan={false} target={[0, 0.5, 0]} /> {/* Target the face height */}
      
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 2, 2]} intensity={1.5} castShadow />
      <Environment preset="city" />

      {/* No manual positioning needed, Avatar.jsx handles local position */}
      <Avatar isSpeaking={isSpeaking} emotion={emotion} />
    </>
  );
}