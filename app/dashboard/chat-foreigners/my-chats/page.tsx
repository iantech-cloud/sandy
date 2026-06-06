'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

interface ChatAccess {
  botId: string;
  botName: string;
  botAvatar?: string;
  messageCount: number;
  firstMilestoneComplete: boolean;
  unlockedAt: string;
}

export default function MyChatsPage() {
  const [chats, setChats] = useState<ChatAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const res = await fetch('/api/chat-foreigners/bots?type=access');
        const data = await res.json();
        if (data.success) {
          setChats(data.data);
        }
      } catch (err) {
        console.error('[v0] Error loading chats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/chat-foreigners"
            className="text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Chats</h1>
            <p className="text-slate-600">Your active conversations with foreign personalities</p>
          </div>
        </div>

        {chats.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <MessageSquare className="mx-auto text-slate-300 mb-4" size={48} />
            <h2 className="text-xl font-bold text-slate-700 mb-2">No chats yet</h2>
            <p className="text-slate-500 mb-6">
              Unlock a personality to start chatting with them.
            </p>
            <Link
              href="/dashboard/chat-foreigners"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-semibold"
            >
              Browse Personalities
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chats.map((chat) => (
              <Link
                key={chat.botId}
                href={`/dashboard/chat-foreigners/chat/${chat.botId}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition flex items-center gap-4"
              >
                {chat.botAvatar ? (
                  <img
                    src={chat.botAvatar}
                    alt={chat.botName}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xl">{chat.botName[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{chat.botName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-slate-500 flex items-center gap-1">
                      <MessageSquare size={14} />
                      {chat.messageCount} messages
                    </span>
                    {chat.firstMilestoneComplete ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Milestone reached
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        In progress
                      </span>
                    )}
                  </div>
                </div>
                <MessageSquare size={20} className="text-blue-500 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
