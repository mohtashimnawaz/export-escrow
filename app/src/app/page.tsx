'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const EscrowDashboard = dynamic(
  () => import("../components/EscrowDashboard").then(mod => ({ default: mod.EscrowDashboard })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Escrow System...</p>
        </div>
      </div>
    )
  }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="p-4 text-center">
        <Link href="/3d" className="text-lg bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
          View 3D Experience
        </Link>
      </div>
      <EscrowDashboard />
    </main>
  );
}
