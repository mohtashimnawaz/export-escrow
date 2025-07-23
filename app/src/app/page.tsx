'use client';

import dynamic from 'next/dynamic';

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
    <main className="min-h-screen">
      <EscrowDashboard />
    </main>
  );
}
