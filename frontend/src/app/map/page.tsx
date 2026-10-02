"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-slate-800 flex items-center justify-center border border-slate-700 rounded-lg">Loading map...</div>
});

export default function SituationMap() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <h1 className="text-3xl font-bold">Situation Map</h1>
      <div className="flex-1 min-h-[600px] rounded-lg overflow-hidden border border-slate-700">
        {isClient && <MapComponent />}
      </div>
    </div>
  );
}
