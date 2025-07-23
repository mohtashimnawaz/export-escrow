'use client';

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

const Box = ({ position, text }: { position: THREE.Vector3; text: string }) => {
  const mesh = useRef<THREE.Mesh>(null!);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.x += delta * 0.1;
      mesh.current.rotation.y += delta * 0.1;
    }
  });

  const color = useMemo(() => {
    if (isActive) return '#ff7f50'; // Coral
    if (isHovered) return '#add8e6'; // Light Blue
    return '#ffffff'; // White
  }, [isActive, isHovered]);

  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <mesh
        ref={mesh}
        position={position}
        scale={isActive ? 1.2 : 1}
        onClick={() => setIsActive(!isActive)}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={color} wireframe />
        <Suspense fallback={null}>
          <Text
            position={[0, 0, 1.1]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {text}
          </Text>
        </Suspense>
      </mesh>
    </Float>
  );
};

const SceneContent = () => {
  const boxCount = 10;
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < boxCount; i++) {
      pos.push([
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
      ] as [number, number, number]);
    }
    return pos;
  }, [boxCount]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      {positions.map((pos, i) => (
        <Box key={i} position={new THREE.Vector3(...pos)} text={`Order ${i + 1}`} />
      ))}
      <OrbitControls />
    </>
  );
};

export const ThreeScene = () => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#1a1a1a' }}>
      <Canvas>
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
};
