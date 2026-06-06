'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Wallet, Sparkles, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

interface Person {
  id: string;
  name: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  category: string;
  unlockCost_cents: number;
  unlockPrice: number;
}

const INTEREST_LABELS: Record<string, string> = {
  relationship_coach: 'Relationships',
  finance_mentor: 'Finance',
  social_friend: 'Lifestyle',
  business_advisor: 'Business',
  companion: 'Companion',
  therapist: 'Wellness',
  gaming_friend: 'Gaming',
  tech_mentor: 'Tech',
};

export default function ChatForeignersPage() {
  const { data: session } = useSession();
  const [persons, setPersons] = useState<Person[]>([]);
  const [userAccess, setUserAccess] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance_cents: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [personsRes, accessRes, walletRes] = await Promise.all([
          fetch('/api/chat-foreigners/bots?type=list'),
          fetch('/api/chat-foreigners/bots?type=access'),
          fetch('/api/chat-foreigners/wallet'),
        ]);
        const [personsData, accessData, walletData] = await Promise.all([
          personsRes.json(),
          accessRes.json(),
          walletRes.json(),
        ]);

        if (personsData.success) setPersons(personsData.data);
        if (accessData.success)
          setUserAccess(new Set(accessData.data.map((a: any) => a.botId)));
        if (walletData.success) setWallet(walletData.data);
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
      <div className="flex flex-col h-screen bg-zinc-950 items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 mt-3 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Header */}
      <header className="px-6 pt-6 pb-2 shrink-0 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-1">Chat Foreigners</h1>
          <p className="text-zinc-400 text-sm">
            Connect with unique personalities. Each conversation is real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/chat-foreigners/wallet"
            className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-primary/50 rounded-full px-3 py-1.5 text-sm transition-colors"
          >
            <Wallet className="w-4 h-4 text-primary" />
            <span>KES {(wallet.balance_cents / 100).toFixed(0)}</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Quick Links */}
      <div className="px-6 py-4 grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/chat-foreigners/my-chats"
          className="bg-zinc-900 border border-zinc-800 hover:border-primary/40 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors"
        >
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="text-xs text-zinc-400">My Chats</span>
        </Link>
        <Link
          href="/dashboard/referrals"
          className="bg-zinc-900 border border-zinc-800 hover:border-primary/40 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors"
        >
          <Users className="w-5 h-5 text-primary" />
          <span className="text-xs text-zinc-400">Referrals</span>
        </Link>
        <Link
          href="/dashboard/chat-foreigners/wallet"
          className="bg-zinc-900 border border-zinc-800 hover:border-primary/40 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-colors"
        >
          <Wallet className="w-5 h-5 text-primary" />
          <span className="text-xs text-zinc-400">Wallet</span>
        </Link>
      </div>

      {/* Persons Grid */}
      <div className="px-6 pb-10 flex-1">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Available Personalities
        </h2>

        {persons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <MessageSquare className="w-12 h-12 mb-3 text-zinc-700" />
            <p className="font-medium">No personalities available yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {persons.map((person) => {
              const unlocked = userAccess.has(person.id);
              const categoryLabel =
                INTEREST_LABELS[person.personalityType || ''] ??
                INTEREST_LABELS[person.category] ??
                person.category;

              return (
                <Link
                  key={person.id}
                  href={unlocked ? `/dashboard/chat-foreigners/chat/${person.id}` : `/dashboard/chat-foreigners/unlock/${person.id}`}
                  className="bg-zinc-900 border border-zinc-800 hover:border-primary/50 rounded-2xl overflow-hidden group transition-all cursor-pointer"
                >
                  {/* Cover + Avatar */}
                  <div className="h-20 bg-gradient-to-r from-zinc-800 to-zinc-900 relative">
                    <div className="absolute -bottom-8 left-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-zinc-900 bg-zinc-800 shadow-xl">
                          {person.avatar_url ? (
                            <img
                              src={person.avatar_url}
                              alt={person.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10">
                              <span className="text-zinc-200 font-bold text-xl">
                                {person.name.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* online indicator */}
                        <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-zinc-900" />
                      </div>
                    </div>
                    {unlocked && (
                      <div className="absolute top-2 right-2 bg-primary/20 text-primary border border-primary/30 rounded-full text-[10px] font-semibold px-2 py-0.5">
                        Unlocked
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-4 pt-10">
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
                          {person.name}
                        </h3>
                        {person.username && (
                          <p className="text-xs text-zinc-500">@{person.username.replace('@', '')}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2 py-0.5">
                        {categoryLabel}
                      </span>
                    </div>

                    {person.bio && (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3 h-10 leading-5">
                        {person.bio}
                      </p>
                    )}

                    <div
                      className={`flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg p-2 transition-colors ${
                        unlocked
                          ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                          : 'bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700'
                      }`}
                    >
                      {unlocked ? (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Open Chat
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Connect &mdash; KES {person.unlockPrice ?? (person.unlockCost_cents / 100).toFixed(0)}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
