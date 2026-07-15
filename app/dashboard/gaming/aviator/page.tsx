'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AviatorGame from '../components/AviatorGame';

export default function AviatorPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors font-semibold"
        >
          <ArrowLeft size={20} />
          Back to Games
        </button>

        {/* Game Container */}
        <AviatorGame onClose={() => router.back()} />
      </div>
    </div>
  );
}
