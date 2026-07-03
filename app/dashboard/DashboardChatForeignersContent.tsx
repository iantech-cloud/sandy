'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Wallet, Coins, ArrowLeft, Lock, Unlock } from 'lucide-react';

// Country flag emoji map — nationality to flag
const NATIONALITY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸', 'American': '🇺🇸', 'United Kingdom': '🇬🇧', 'British': '🇬🇧',
  'Canada': '🇨🇦', 'Canadian': '🇨🇦', 'Australia': '🇦🇺', 'Australian': '🇦🇺',
  'Germany': '🇩🇪', 'German': '🇩🇪', 'France': '🇫🇷', 'French': '🇫🇷',
  'Spain': '🇪🇸', 'Spanish': '🇪🇸', 'Mexico': '🇲🇽', 'Mexican': '🇲🇽',
  'Brazil': '🇧🇷', 'Brazilian': '🇧🇷', 'Japan': '🇯🇵', 'Japanese': '🇯🇵',
  'China': '🇨🇳', 'Chinese': '🇨🇳', 'India': '🇮🇳', 'Indian': '🇮🇳',
  'South Africa': '🇿🇦', 'South African': '🇿🇦', 'Nigeria': '🇳🇬', 'Nigerian': '🇳🇬',
  'Kenya': '🇰🇪', 'Kenyan': '🇰🇪', 'Ghana': '🇬🇭', 'Ghanaian': '🇬🇭',
  'Ethiopia': '🇪🇹', 'Ethiopian': '🇪🇹', 'Egypt': '🇪🇬', 'Egyptian': '🇪🇬',
  'Italy': '🇮🇹', 'Italian': '🇮🇹', 'Portugal': '🇵🇹', 'Portuguese': '🇵🇹',
  'Netherlands': '🇳🇱', 'Dutch': '🇳🇱', 'Sweden': '🇸🇪', 'Swedish': '🇸🇪',
  'Norway': '🇳🇴', 'Norwegian': '🇳🇴', 'South Korea': '🇰🇷', 'Korean': '🇰🇷',
  'Philippines': '🇵🇭', 'Filipino': '🇵🇭', 'Indonesia': '🇮🇩', 'Indonesian': '🇮🇩',
  'Pakistan': '🇵🇰', 'Pakistani': '🇵🇰', 'Argentina': '🇦🇷', 'Argentine': '🇦🇷',
  'Colombia': '🇨🇴', 'Colombian': '🇨🇴', 'Turkey': '🇹🇷', 'Turkish': '🇹🇷',
  'Saudi Arabia': '🇸🇦', 'Saudi': '🇸🇦',
};

interface Person {
  id: string;
  name: string;
  username?: string;
  bio?: string;
  tagline?: string;
  avatar_url?: string;
  nationality?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  category: string;
  unlockCost_cents: number;
  unlockPrice: number;
}

interface ChatStats {
  chats: number;
  messages: number;
  unlockCost: number;
}

interface DashboardChatForeignersContentProps {
  initialPersons: Person[];
  initialUserAccess: Set<string>;
  initialStats: ChatStats;
}

export function DashboardChatForeignersContent({
  initialPersons,
  initialUserAccess,
  initialStats,
}: DashboardChatForeignersContentProps) {
  // useState: selected category filter (ephemeral UI state, rule 6)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredPersons = selectedCategory
    ? initialPersons.filter((p) => p.category === selectedCategory)
    : initialPersons;

  const categories = Array.from(new Set(initialPersons.map((p) => p.category)));

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d14] text-zinc-100 overflow-y-auto">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#00c97a]" />
            <h1 className="text-xl font-bold tracking-tight">Chat Foreigners</h1>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 py-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-[#00c97a]" />
            <span className="text-zinc-400 text-sm">Active Chats</span>
          </div>
          <p className="text-2xl font-bold">{initialStats.chats}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-zinc-400 text-sm">Persons</span>
          </div>
          <p className="text-2xl font-bold">{initialPersons.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-zinc-400 text-sm">Messages</span>
          </div>
          <p className="text-2xl font-bold">{initialStats.messages}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-zinc-400 text-sm">Unlock Cost</span>
          </div>
          <p className="text-2xl font-bold">KES {initialStats.unlockCost}</p>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-[#00c97a] text-black font-semibold'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#00c97a] text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Persons Grid */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPersons.map((person) => {
            const flag = NATIONALITY_FLAGS[person.nationality || ''] || '🌍';
            const isUnlocked = initialUserAccess.has(person.id);

            return (
              <div
                key={person.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-[#00c97a] transition-colors group cursor-pointer"
              >
                {/* Avatar */}
                <div className="relative w-full aspect-square bg-zinc-800 overflow-hidden">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={person.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {flag}
                    </div>
                  )}
                  {isUnlocked ? (
                    <div className="absolute top-2 right-2 bg-[#00c97a] text-black rounded-full p-2">
                      <Unlock className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{person.name}</h3>
                      <p className="text-zinc-400 text-sm">@{person.username || 'unknown'}</p>
                    </div>
                    <span className="text-lg">{flag}</span>
                  </div>
                  {person.bio && <p className="text-zinc-300 text-sm mb-2 line-clamp-2">{person.bio}</p>}
                  <div className="flex gap-2 text-xs text-zinc-400 mb-3">
                    {person.personalityType && <span className="bg-zinc-800 px-2 py-1 rounded">{person.personalityType}</span>}
                    {person.speakingStyle && <span className="bg-zinc-800 px-2 py-1 rounded">{person.speakingStyle}</span>}
                  </div>
                  <button
                    className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                      isUnlocked
                        ? 'bg-[#00c97a] text-black hover:bg-[#00b86d]'
                        : 'bg-zinc-700 text-white hover:bg-zinc-600'
                    }`}
                  >
                    {isUnlocked ? 'Start Chat' : `Unlock - KES ${(person.unlockPrice || 100).toLocaleString()}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPersons.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <p className="text-zinc-400">No persons found in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
