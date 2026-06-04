'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MessageSquare, Wallet, Users } from 'lucide-react';

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  category: string;
  unlockCost_cents: number;
}

export default function ChatForeignersPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [userAccess, setUserAccess] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance_cents: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load bots
        const botsRes = await fetch('/api/chat-foreigners/bots?type=list');
        const botsData = await botsRes.json();
        if (botsData.success) {
          setBots(botsData.data);
        }

        // Load user access
        const accessRes = await fetch('/api/chat-foreigners/bots?type=access');
        const accessData = await accessRes.json();
        if (accessData.success) {
          setUserAccess(new Set(accessData.data.map((a: any) => a.botId)));
        }

        // Load wallet
        const walletRes = await fetch('/api/chat-foreigners/wallet');
        const walletData = await walletRes.json();
        if (walletData.success) {
          setWallet(walletData.data);
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
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4 md:px-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Chat with Foreigners</h1>
            <p className="text-slate-600">Connect with international personalities and unlock unique conversations</p>
          </div>
          <Link
            href="/dashboard/chat-foreigners/wallet"
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            <Wallet size={20} />
            <span>Wallet: KES {(wallet.balance_cents / 100).toFixed(0)}</span>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/chat-foreigners/wallet"
            className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Wallet className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-slate-900">Wallet</p>
                <p className="text-sm text-slate-600">Manage funds</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400" />
          </Link>

          <Link
            href="/refer-earn?tab=chat-foreigners"
            className="bg-white p-4 rounded-lg border border-slate-200 hover:border-green-400 hover:shadow-md transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Users className="text-green-600" size={24} />
              <div>
                <p className="font-semibold text-slate-900">Referrals</p>
                <p className="text-sm text-slate-600">Earn from friends</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400" />
          </Link>

          <Link
            href="/dashboard/chat-foreigners/my-chats"
            className="bg-white p-4 rounded-lg border border-slate-200 hover:border-purple-400 hover:shadow-md transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="text-purple-600" size={24} />
              <div>
                <p className="font-semibold text-slate-900">My Chats</p>
                <p className="text-sm text-slate-600">Your conversations</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Bots Grid */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Available Bots</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition"
            >
              {bot.avatar_url && (
                <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <img src={bot.avatar_url} alt={bot.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{bot.name}</h3>
                    <p className="text-sm text-slate-500 capitalize">{bot.category}</p>
                  </div>
                  {userAccess.has(bot.id) && (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Unlocked
                    </span>
                  )}
                </div>
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">{bot.description}</p>
                
                {userAccess.has(bot.id) ? (
                  <Link
                    href={`/dashboard/chat-foreigners/chat/${bot.id}`}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-center font-semibold"
                  >
                    Start Chat
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/chat-foreigners/unlock/${bot.id}`}
                    className="w-full bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-800 transition text-center font-semibold"
                  >
                    Unlock - KES {(bot.unlockCost_cents / 100).toFixed(0)}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
