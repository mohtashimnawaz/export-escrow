'use client';

import dynamic from 'next/dynamic';

const ThreeScene = dynamic(() => import('@/components/3d/ThreeScene').then(mod => mod.ThreeScene), {
  ssr: false,
});

export default function ThreePage() {
  return <ThreeScene />;
}
