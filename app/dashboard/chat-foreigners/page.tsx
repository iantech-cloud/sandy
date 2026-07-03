import { Suspense } from 'react';
import { DashboardChatForeignersContent } from '../DashboardChatForeignersContent';
import { Loader2, MessageSquare } from 'lucide-react';

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

interface AccessRecord {
  botId: string;
  messageCount?: number;
}

async function getChatForeignersData() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const [personsRes, accessRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat-foreigners/bots?type=list`, {
        cache: 'no-store',
      }).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat-foreigners/bots?type=access`, {
        cache: 'no-store',
      }).catch(() => null),
    ]);

    let persons: Person[] = [];
    let userAccess = new Set<string>();
    let totalMessages = 0;

    if (personsRes?.ok) {
      try {
        const personsData = await personsRes.json();
        persons = personsData.success ? (personsData.data || []) : [];
      } catch {
        persons = [];
      }
    }

    if (accessRes?.ok) {
      try {
        const accessData = await accessRes.json();
        if (accessData.success && Array.isArray(accessData.data)) {
          accessData.data.forEach((a: AccessRecord) => {
            userAccess.add(a.botId);
            totalMessages += a.messageCount || 0;
          });
        }
      } catch {
        userAccess = new Set<string>();
        totalMessages = 0;
      }
    }

    return {
      persons,
      userAccess,
      stats: {
        chats: userAccess.size,
        messages: totalMessages,
        unlockCost: 100,
      },
    };
  } catch (error) {
    console.error('[v0] Failed to load chat foreigners data:', error);
    return {
      persons: [],
      userAccess: new Set<string>(),
      stats: { chats: 0, messages: 0, unlockCost: 100 },
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00c97a] border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-500 mt-3 text-sm">Loading chat foreigners...</p>
    </div>
  );
}

export default async function ChatForeignersPage() {
  // Server Component: fetch all data server-side, no useState, no useEffect
  const { persons, userAccess, stats } = await getChatForeignersData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardChatForeignersContent
        initialPersons={persons}
        initialUserAccess={userAccess}
        initialStats={stats}
      />
    </Suspense>
  );
}
