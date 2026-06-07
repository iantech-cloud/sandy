'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Wallet, Coins } from 'lucide-react';

// Country flag emoji map — nationality to flag
const NATIONALITY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸',
  'American': '🇺🇸',
  'British': '🇬🇧',
  'Canadian': '🇨🇦',
  'Australian': '🇦🇺',
  'German': '🇩🇪',
  'French': '🇫🇷',
  'Spanish': '🇪🇸',
  'Mexican': '🇲🇽',
  'Brazilian': '🇧🇷',
  'Japanese': '🇯🇵',
  'Chinese': '🇨🇳',
  'Indian': '🇮🇳',
  'South African': '🇿🇦',
  'Nigerian': '🇳🇬',
  'Kenyan': '🇰🇪',
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

export default function ChatForeignersPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [userAccess, setUserAccess] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ chats: 0, messages: 0, unlockCost: 100 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [personsRes, accessRes] = await Promise.all([
          fetch('/api/chat-foreigners/bots?type=list'),
          fetch('/api/chat-foreigners/bots?type=access'),
        ]);
        const [personsData, accessData] = await Promise.all([
          personsRes.json(),
          accessRes.json(),
        ]);

        if (personsData.success) setPersons(personsData.data);
        if (accessData.success) {
          const accessSet = new Set<string>(accessData.data.map((a: any) => a.botId));
          setUserAccess(accessSet);
          setStats((s) => ({
            ...s,
            chats: accessData.data.length,
            messages: accessData.data.reduce((sum: number, a: any) => sum + (a.messageCount || 0), 0),
          }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#0d0d14] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00c97a] border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 mt-3 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d14] text-zinc-100 overflow-y-auto">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#00c97a]" />
          <h1 className="text-xl font-bold tracking-tight">Chat Foreigners</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/chat-foreigners/wallet"
            className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:text-white rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-[#00c97a]" />
            Wallet
          </Link>
          <Link
            href="/dashboard/referrals"
            className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:text-white rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#00c97a]" />
            Referrals
          </Link>
        </div>
      </header>

      {/* Stats row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-3">
        <div className="bg-[#161622] border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-100">{stats.chats}</p>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">Chats</p>
        </div>
        <div className="bg-[#161622] border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-zinc-100">{stats.messages}</p>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">Messages</p>
        </div>
        <div className="bg-[#161622] border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-zinc-100">Ksh {stats.unlockCost}</p>
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">Unlock</p>
        </div>
      </div>

      {/* Section header */}
      <div className="mx-4 mb-3 bg-[#161622] border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Rainbow top stripe */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[#00c97a] via-purple-500 via-pink-500 to-amber-400" />
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#00c97a] rounded-full animate-pulse" />
          <div>
            <p className="font-bold text-sm text-zinc-100">Foreigners online now</p>
            <p className="text-[11px] text-zinc-500">Tap anyone to preview &middot; Unlock for unlimited chat</p>
          </div>
        </div>

        {/* Bot grid */}
        {persons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <MessageSquare className="w-10 h-10 mb-2 text-zinc-700" />
            <p className="text-sm">No personalities available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-3 pb-4">
            {persons.map((person) => {
              const unlocked = userAccess.has(person.id);
              const flag = NATIONALITY_FLAGS[person.nationality || ''] ?? '🌐';
              const nationalityLabel = person.nationality || 'International';

              return (
                <Link
                  key={person.id}
                  href={`/dashboard/chat-foreigners/chat/${person.id}`}
                  className="flex flex-col items-center bg-[#1c1c2e] rounded-2xl pt-4 pb-3 px-2 gap-2 hover:bg-[#212135] transition-colors active:scale-95 duration-150"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#2a2a40] bg-zinc-800">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00c97a]/20 to-zinc-800">
                          <span className="text-zinc-200 font-bold text-lg">
                            {person.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Online dot */}
                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#00c97a] rounded-full border-2 border-[#1c1c2e]" />
                    {unlocked && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00c97a] rounded-full border-2 border-[#1c1c2e] flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <p className="text-xs font-bold text-zinc-100 text-center leading-tight">
                    {person.name}
                  </p>

                  {/* Nationality + flag */}
                  <p className="text-[10px] text-zinc-400 text-center leading-none">
                    {flag} {nationalityLabel}
                  </p>

                  {/* Earn button */}
                  <div className="w-full mt-0.5 bg-[#2a1f00] border border-[#7a5500] hover:bg-[#3a2a00] rounded-xl px-1 py-2 flex items-center justify-center gap-1 transition-colors">
                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-400 text-center leading-tight">
                      Earn Ksh{'\n'}1,000
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-6" />
    </div>
  );
}
