'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowLeft, CheckCircle2, Clock, MessageCircle } from 'lucide-react';

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
        if (data.success) setChats(data.data);
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
      <div className="flex flex-col h-screen bg-zinc-950 items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-4 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0 flex items-center gap-3">
        <Link
          href="/dashboard/chat-foreigners"
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">My Chats</h1>
          <p className="text-xs text-zinc-500">Your active conversations</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600 px-6 text-center">
            <MessageCircle className="w-14 h-14 mb-4 text-zinc-700" />
            <p className="font-semibold text-zinc-400">No conversations yet</p>
            <p className="text-sm mt-1 text-zinc-600">Unlock a personality to start chatting.</p>
            <Link
              href="/dashboard/chat-foreigners"
              className="mt-6 bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse Personalities
            </Link>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <Link
                key={chat.botId}
                href={`/dashboard/chat-foreigners/chat/${chat.botId}`}
                className="block"
              >
                <div className="p-3 rounded-xl hover:bg-zinc-900 transition-colors flex items-center gap-3 cursor-pointer">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-800 bg-zinc-800 flex items-center justify-center">
                      {chat.botAvatar ? (
                        <img src={chat.botAvatar} alt={chat.botName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-zinc-300 font-bold">
                          {chat.botName.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary rounded-full border-2 border-zinc-950" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold truncate text-zinc-100">{chat.botName}</h3>
                      <span className="text-xs text-zinc-500 ml-2 shrink-0">
                        {new Date(chat.unlockedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-zinc-500 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {chat.messageCount} messages
                      </p>
                      {chat.firstMilestoneComplete ? (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Milestone reached
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          In progress
                        </span>
                      )}
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
