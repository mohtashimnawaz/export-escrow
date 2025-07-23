'use client';

import React, { useMemo, useRef, Suspense } from 'react';
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

const Particle = ({ position }: { position: THREE.Vector3 }) => {
  const mesh = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if(mesh.current) {
        mesh.current.position.y = position.y + Math.sin(time + position.x) * 0.2;
    }
  });

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
    </mesh>
  );
};

export const Background3D = () => {
  const particleCount = 200;
  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < particleCount; i++) {
      pos.push([
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
      ]);
    }
    return pos;
  }, [particleCount]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        {positions.map((pos, i) => (
          <Particle key={i} position={new THREE.Vector3(...pos)} />
        ))}
      </Canvas>
    </div>
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
