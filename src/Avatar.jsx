import React, { useEffect, useState, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';

export function Avatar({ isSpeaking, emotion }) {
  const [vrm, setVrm] = useState(null);
  
  // Load the VRM file with the specialized plugin
  const gltf = useLoader(GLTFLoader, '/avatar.vrm', (loader) => {
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });
  });

  useEffect(() => {
    if (gltf.userData.vrm) {
      const vrmInstance = gltf.userData.vrm;
      
      // 1. OPTIMIZE MODEL (Fixes colors/rendering)
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrmInstance.scene.traverse((obj) => {
        obj.frustumCulled = false; // Prevents flickering when moving
      });

      // 2. FORCE ARMS DOWN (Using Standard Humanoid Bones)
      // VRM guarantees these bone names exist
      const leftArm = vrmInstance.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rightArm = vrmInstance.humanoid.getNormalizedBoneNode('rightUpperArm');
      
      if (leftArm) {
        leftArm.rotation.z = Math.PI / 2.5; // Rotate down ~70 degrees
        leftArm.rotation.y = 0.1;
      }
      if (rightArm) {
        rightArm.rotation.z = -Math.PI / 2.5; // Mirror for right arm
        rightArm.rotation.y = -0.1;
      }

      setVrm(vrmInstance);
      console.log("VRM Loaded Successfully!");
    }
  }, [gltf]);

  useFrame((state, delta) => {
    if (vrm) {
      // Update VRM internal physics (hair/clothes movement)
      vrm.update(delta);

      // 3. LIP SYNC (Standard VRM 'aa' Blendshape)
      if (vrm.expressionManager) {
        // Calculate volume (Sine wave for now)
        const volume = isSpeaking ? (Math.sin(state.clock.elapsedTime * 15) + 1) / 2 : 0;
        
        // 'aa' is the standard VRM key for "Mouth Open"
        vrm.expressionManager.setValue('aa', THREE.MathUtils.lerp(vrm.expressionManager.getValue('aa'), volume, 0.2));
        
        // 4. EMOTIONS (Standard VRM Keys)
        // Reset emotions first
        vrm.expressionManager.setValue('happy', 0);
        vrm.expressionManager.setValue('angry', 0);
        vrm.expressionManager.setValue('sad', 0);

        // Apply active emotion
        if (emotion === 'HAPPY') vrm.expressionManager.setValue('happy', 1);
        if (emotion === 'ANGRY') vrm.expressionManager.setValue('angry', 1);
        if (emotion === 'SAD') vrm.expressionManager.setValue('sad', 1);
        
        // 5. BLINKING (Auto)
        const blinkVal = Math.sin(state.clock.elapsedTime * 0.5) > 0.98 ? 1 : 0;
        vrm.expressionManager.setValue('blink', blinkVal);
      }
      
      // 6. IDLE HEAD MOVEMENT
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) {
        head.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      }
    }
  });

  // VRM models are usually in meters (approx 1.6 units tall)
  // We position y: -1.0 to center the chest/face in the camera
  return <primitive object={gltf.scene} position={[0, -1.0, 0]} rotation={[0, 0, 0]} />;
}