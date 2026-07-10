'use client';

import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';

export default function ChatForeignersPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d14] text-zinc-100">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Chat Foreigners</h1>
      </header>

      {/* Coming Soon Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#00c97a]/10 border border-[#00c97a]/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-[#00c97a]" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Coming Soon</h2>
          <p className="text-zinc-400 max-w-sm mx-auto mb-8">
            Chat Foreigners is under development. We&apos;re working hard to bring you an amazing experience.
          </p>
          <p className="text-sm text-zinc-500">Stay tuned for updates!</p>
        </div>
      </div>
    </div>
  );
}
