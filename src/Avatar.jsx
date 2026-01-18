import React, { useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';

export function Avatar({ isSpeaking, emotion }) {
  const [vrm, setVrm] = useState(null);
  
  const gltf = useLoader(GLTFLoader, '/avatar.vrm', (loader) => {
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });
  });

  useEffect(() => {
    if (gltf.userData.vrm) {
      const vrmInstance = gltf.userData.vrm;
      
      // Optimization
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrmInstance.scene.traverse((obj) => { obj.frustumCulled = false; });

      // Fix Arms (Humanoid Standard)
      const leftArm = vrmInstance.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rightArm = vrmInstance.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (leftArm) { leftArm.rotation.z = Math.PI / 2.5; leftArm.rotation.y = 0.1; }
      if (rightArm) { rightArm.rotation.z = -Math.PI / 2.5; rightArm.rotation.y = -0.1; }

      setVrm(vrmInstance);
    }
  }, [gltf]);

  useFrame((state, delta) => {
    if (vrm && vrm.expressionManager) {
      vrm.update(delta);

      // --- 1. LIP SYNC ---
      // We limit the mouth opening slightly (0.8 instead of 1.0) for a more natural look
      const talkVolume = isSpeaking ? (Math.sin(state.clock.elapsedTime * 15) + 1) / 2 : 0;
      vrm.expressionManager.setValue('aa', THREE.MathUtils.lerp(vrm.expressionManager.getValue('aa'), talkVolume * 0.8, 0.2));

      // --- 2. EMOTION TUNING (The Fix) ---
      // Reset all first
      const emotions = ['happy', 'angry', 'sad', 'surprised'];
      emotions.forEach(e => {
        // Smoothly fade out current emotion
        const currentVal = vrm.expressionManager.getValue(e);
        vrm.expressionManager.setValue(e, THREE.MathUtils.lerp(currentVal, 0, 0.1));
      });

      // Apply New Emotion
      if (emotion === 'HAPPY') {
        // FIX: If she is talking, we reduce the smile to 0.4 so it doesn't distort the mouth.
        // If silent, we set it to 0.6 (pleasant smile) instead of 1.0 (creepy grin).
        const intensity = isSpeaking ? 0.4 : 0.6;
        vrm.expressionManager.setValue('happy', THREE.MathUtils.lerp(vrm.expressionManager.getValue('happy'), intensity, 0.1));
      }
      
      else if (emotion === 'ANGRY') {
        vrm.expressionManager.setValue('angry', THREE.MathUtils.lerp(vrm.expressionManager.getValue('angry'), 0.7, 0.1));
      }
      
      else if (emotion === 'SAD') {
         vrm.expressionManager.setValue('sad', THREE.MathUtils.lerp(vrm.expressionManager.getValue('sad'), 0.7, 0.1));
      }

      // --- 3. BLINKING ---
      // Random blinking (every 3-5 seconds)
      const blinkVal = Math.sin(state.clock.elapsedTime * 0.5) > 0.98 ? 1 : 0;
      vrm.expressionManager.setValue('blink', blinkVal);
      
      // --- 4. HEAD SWAY ---
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) {
        head.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05; // Very subtle sway
      }
    }
  });

  // ... keep all your imports and logic above ...

  // FIX: Added rotation={[0, Math.PI, 0]}
  // This spins the model 180 degrees so she faces the camera immediately.
  return (
    <primitive 
      object={gltf.scene} 
      position={[0, -1.5, 0.8]} 
      rotation={[-0.6, Math.PI, 0]} 
      scale={1.6}
    />
  );
}
