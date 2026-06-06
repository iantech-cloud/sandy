'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, Loader, XCircle, CheckCircle2, AlertCircle,
  Lock, Sparkles, Zap, MessageCircle, Globe,
} from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Person {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  tagline?: string;
  welcomeMessage?: string;
  purpose?: string;
  nationality?: string;
  languages?: string[];
  availabilityNote?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  category: string;
}

// Quick-start prompt suggestions per personality type
const QUICK_PROMPTS: Record<string, string[]> = {
  therapist: ['How do I handle anxiety?', "I'm feeling overwhelmed lately", 'Help me build confidence'],
  relationship_coach: ['How do I communicate better?', "I'm having relationship problems", 'How do I meet new people?'],
  finance_mentor: ['How do I start investing?', 'Help me make a budget', 'What is the stock market?'],
  business_advisor: ['I have a business idea', 'How do I grow my business?', 'What makes a good leader?'],
  tech_mentor: ['I want to learn coding', 'What tech skills should I learn?', 'Explain AI to me simply'],
  gaming_friend: ['What games are trending?', 'How do I improve my gameplay?', 'Best PC build for gaming?'],
  companion: ['Tell me about yourself', "What's your favorite topic?", 'Give me some life advice'],
  default: ['Tell me about yourself', "What's your specialty?", 'How can you help me?'],
};

const MIN_MESSAGES_TO_CLOSE = 20;
const FREE_PREVIEW_MESSAGES = 2; // messages allowed before unlock gate

const NATIONALITY_FLAGS: Record<string, string> = {
  'American': '🇺🇸',
  'African American': '🇺🇸',
  'British': '🇬🇧',
  'Canadian': '🇨🇦',
  'Australian': '🇦🇺',
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [freeMessagesUsed, setFreeMessagesUsed] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [showUnlockGate, setShowUnlockGate] = useState(false);
  const [showIntro, setShowIntro] = useState(true); // onboarding screen
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canClose = messageCount >= MIN_MESSAGES_TO_CLOSE;
  // Can send if: has full access, or still has free preview messages left
  const canSend = hasFullAccess || freeMessagesUsed < FREE_PREVIEW_MESSAGES;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [personRes, accessRes] = await Promise.all([
          fetch(`/api/chat-foreigners/bots?type=details&botId=${personId}`),
          fetch(`/api/chat-foreigners/bots?type=check&botId=${personId}`),
        ]);
        const [personData, accessData] = await Promise.all([
          personRes.json(),
          accessRes.json(),
        ]);

        if (!personData.success) {
          router.push('/dashboard/chat-foreigners');
          return;
        }
        setPerson(personData.data);

        if (accessData.success && accessData.hasAccess) {
          setHasFullAccess(true);
          setMessageCount(accessData.data?.messageCount || 0);
        }
        // If no full access, free preview mode is active — showIntro stays true
      } catch (error) {
        console.error('Error loading chat:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [personId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = (quickPrompt?: string) => {
    setShowIntro(false);
    if (quickPrompt) {
      setInput(quickPrompt);
      // auto-focus input after state update
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !person || chatClosed) return;

    // Check if free preview is exhausted and user hasn't paid
    if (!hasFullAccess && freeMessagesUsed >= FREE_PREVIEW_MESSAGES) {
      setShowUnlockGate(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    // Track free message usage
    if (!hasFullAccess) {
      setFreeMessagesUsed((prev) => prev + 1);
    }

    try {
      const res = await fetch('/api/chat-foreigners/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          message: userMessage.content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          freePreview: !hasFullAccess,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply, timestamp: new Date() },
        ]);
        if (hasFullAccess) setMessageCount((prev) => prev + 1);
      } else {
        const errMsg = data.error
          ? `Could not get a response: ${data.error}`
          : 'Sorry, could not process your message right now. Try again in a moment.';
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: errMsg, timestamp: new Date() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setSending(false);
      // Show gate after the last free message completes (freeMessagesUsed is pre-increment here)
      if (!hasFullAccess && freeMessagesUsed >= FREE_PREVIEW_MESSAGES - 1) {
        setTimeout(() => setShowUnlockGate(true), 1200);
      }
    }
  };

  const handleEndChat = async () => {
    setClosingChat(true);
    setCloseError('');
    try {
      const res = await fetch('/api/chat-foreigners/chat/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: personId }),
      });
      const data = await res.json();

      if (data.success) {
        setChatClosed(true);
        setCreditAmount(data.data?.creditAmount || 100);
        setShowEndChatConfirm(false);
      } else {
        setCloseError(data.error || 'Could not close chat. Try again.');
        setShowEndChatConfirm(false);
      }
    } catch {
      setCloseError('Something went wrong. Please try again.');
      setShowEndChatConfirm(false);
    } finally {
      setClosingChat(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#0d0d14] items-center justify-center">
        <Loader className="animate-spin text-[#00c97a]" size={32} />
        <p className="text-zinc-500 mt-3 text-sm">Loading...</p>
      </div>
    );
  }

  if (!person) return null;

  // ── Chat closed — success screen ─────────────────────────────────────────
  if (chatClosed) {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center p-6">
        <div className="bg-[#161622] border border-zinc-800 rounded-2xl shadow-xl p-8 max-w-sm w-full text-center text-zinc-100 space-y-4">
          <div className="w-16 h-16 bg-[#00c97a]/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[#00c97a]" />
          </div>
          <h2 className="text-2xl font-bold">Chat Completed!</h2>
          <p className="text-zinc-400 text-sm">
            KES {creditAmount} has been credited to your Chat Foreigners wallet.
          </p>
          <p className="text-xs text-zinc-500">
            To chat with {person.name} again, unlock with a fresh KES 100 payment.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/dashboard/chat-foreigners/wallet"
              className="w-full bg-[#00c97a] hover:bg-[#00b06a] text-white font-semibold h-11 rounded-full flex items-center justify-center transition-colors"
            >
              View Wallet
            </Link>
            <Link
              href="/dashboard/chat-foreigners"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold h-11 rounded-full flex items-center justify-center transition-colors"
            >
              Browse Personalities
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const quickPrompts =
    QUICK_PROMPTS[person.personalityType || ''] ?? QUICK_PROMPTS.default;
  const flag = NATIONALITY_FLAGS[person.nationality || ''] ?? '🌐';

  // ── Intro / Onboarding screen ─────────────────────────────────────────────
  if (showIntro) {
    return (
      <div className="flex flex-col h-screen bg-[#0d0d14] text-zinc-100">
        {/* Back */}
        <div className="px-4 pt-4 shrink-0">
          <Link
            href="/dashboard/chat-foreigners"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        {/* Intro card */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col justify-center">
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-6 space-y-5 max-w-sm mx-auto w-full">
            {/* Avatar + status */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#00c97a]/30 bg-zinc-800">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00c97a]/20 to-zinc-800">
                      <span className="text-zinc-200 font-bold text-2xl">
                        {person.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-[#00c97a] rounded-full border-2 border-[#161622]" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">{person.name}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-xs text-zinc-400">{flag} {person.nationality || 'International'}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-[#00c97a] font-medium flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 bg-[#00c97a] rounded-full animate-pulse inline-block" />
                    Online now
                  </span>
                </div>
                {person.tagline && (
                  <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">{person.tagline}</p>
                )}
              </div>
            </div>

            {/* Welcome message */}
            <div className="bg-[#1c1c2e] rounded-xl px-4 py-3 border border-zinc-700/50">
              <p className="text-sm text-zinc-200 leading-relaxed">
                {person.welcomeMessage ||
                  `Hey! I'm ${person.name}. Great to meet you — what's on your mind today?`}
              </p>
            </div>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {person.availabilityNote && (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2.5 py-1 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  {person.availabilityNote}
                </span>
              )}
              {(person.languages ?? ['English']).map((lang) => (
                <span key={lang} className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2.5 py-1 flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" />
                  {lang}
                </span>
              ))}
            </div>

            {/* Quick-start prompts */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Quick starters</p>
              <div className="flex flex-col gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => startChat(prompt)}
                    className="w-full text-left text-xs bg-[#1c1c2e] hover:bg-[#242436] border border-zinc-700/60 hover:border-[#00c97a]/40 text-zinc-300 rounded-xl px-3 py-2.5 transition-colors flex items-center gap-2"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#00c97a] shrink-0" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => startChat()}
              className="w-full bg-[#00c97a] hover:bg-[#00b06a] text-white font-bold h-12 rounded-full flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Start Chatting
            </button>

            {!hasFullAccess && (
              <p className="text-[10px] text-zinc-600 text-center">
                {FREE_PREVIEW_MESSAGES} free messages &middot; Unlock full chat for KES 100
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Unlock gate modal ─────────────────────────────────────────────────────
  const UnlockGate = () => (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#161622] border border-zinc-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00c97a]/10 border border-[#00c97a]/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#00c97a]" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-zinc-100">You&apos;re enjoying the chat!</h3>
            <p className="text-zinc-400 text-sm mt-1">
              You&apos;ve used your {FREE_PREVIEW_MESSAGES} free preview messages.
              Unlock unlimited access to {person.name} for just KES 100.
            </p>
          </div>
        </div>

        {/* Bot mini-card */}
        <div className="flex items-center gap-3 bg-[#1c1c2e] rounded-xl p-3 border border-zinc-700/50">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0">
            {person.avatar_url ? (
              <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-zinc-300 font-bold text-sm">
                {person.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-zinc-100 truncate">{person.name}</p>
            <p className="text-xs text-zinc-500 truncate">{person.tagline || person.bio?.substring(0, 40)}</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-lg font-bold text-[#00c97a]">KES 100</p>
            <p className="text-[10px] text-zinc-500">one-time</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/dashboard/chat-foreigners/unlock/${personId}`}
            className="w-full bg-[#00c97a] hover:bg-[#00b06a] text-white font-bold h-12 rounded-full flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Unlock Full Access — KES 100
          </Link>
          <button
            onClick={() => setShowUnlockGate(false)}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm h-10 rounded-full transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main chat view ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0d0d14] text-zinc-100">
      {/* Unlock gate overlay */}
      {showUnlockGate && <UnlockGate />}

      {/* Header */}
      <header className="px-3 py-2.5 border-b border-zinc-800 bg-[#161622] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/chat-foreigners"
            className="p-1.5 -ml-1 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-zinc-300 font-bold text-xs">
                    {person.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00c97a] rounded-full border-2 border-[#161622]" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">{person.name}</p>
              <p className="text-[10px] text-[#00c97a] mt-0.5 leading-none">Active now</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!hasFullAccess && (
            <Link
              href={`/dashboard/chat-foreigners/unlock/${personId}`}
              className="text-[11px] font-semibold bg-[#00c97a]/10 text-[#00c97a] border border-[#00c97a]/30 rounded-full px-3 py-1 flex items-center gap-1 hover:bg-[#00c97a]/20 transition-colors"
            >
              <Lock className="w-3 h-3" />
              Unlock
            </Link>
          )}
          {hasFullAccess && (
            <button
              onClick={() => setShowEndChatConfirm(true)}
              className="p-1.5 text-zinc-500 hover:text-red-400 rounded-full hover:bg-zinc-800 transition-colors"
              title="End Chat"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Close error banner */}
      {closeError && (
        <div className="bg-red-950/60 border-b border-red-900/50 px-4 py-2 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{closeError}</span>
          <button onClick={() => setCloseError('')} className="text-red-500 hover:text-red-300 text-xs ml-auto">
            Dismiss
          </button>
        </div>
      )}

      {/* End chat confirm dialog */}
      {showEndChatConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-zinc-100">End Chat Session?</h3>
            {canClose ? (
              <p className="text-zinc-400 text-sm">
                You will receive <span className="text-[#00c97a] font-semibold">KES 100</span> in your Chat Foreigners wallet. To chat with {person.name} again you will need to pay KES 100 to re-unlock.
              </p>
            ) : (
              <p className="text-zinc-400 text-sm">
                You need at least <span className="text-[#00c97a] font-semibold">{MIN_MESSAGES_TO_CLOSE} messages</span> to end the chat and claim your reward. You have <span className="font-semibold">{messageCount}</span> so far.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowEndChatConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold h-11 rounded-full transition-colors"
              >
                Keep Chatting
              </button>
              {canClose && (
                <button
                  onClick={handleEndChat}
                  disabled={closingChat}
                  className="flex-1 bg-[#00c97a] hover:bg-[#00b06a] text-white font-semibold h-11 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {closingChat && <Loader size={15} className="animate-spin" />}
                  End &amp; Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-[#0d0d14]">
        <div className="text-center text-[10px] text-zinc-600 mb-1">Chat started today</div>

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center mr-2 mt-1 shrink-0 self-end">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-300 font-bold text-[10px]">
                      {person.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                  isUser
                    ? 'bg-[#00c97a] text-white rounded-tr-sm'
                    : 'bg-[#1c1c2e] text-zinc-100 rounded-tl-sm border border-zinc-700/40'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-[9px] mt-1 text-right ${isUser ? 'text-white/60' : 'text-zinc-600'}`}>
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </p>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center mr-2 self-end shrink-0">
              {person.avatar_url ? (
                <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-zinc-300 font-bold text-[10px]">
                  {person.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="bg-[#1c1c2e] border border-zinc-700/40 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-[#00c97a] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-[#00c97a] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-[#00c97a] rounded-full animate-bounce" />
            </div>
          </div>
        )}

        {/* Soft unlock nudge after free messages */}
        {!hasFullAccess && freeMessagesUsed >= FREE_PREVIEW_MESSAGES && !showUnlockGate && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => setShowUnlockGate(true)}
              className="text-xs text-[#00c97a] border border-[#00c97a]/30 bg-[#00c97a]/10 rounded-full px-4 py-2 flex items-center gap-1.5 hover:bg-[#00c97a]/20 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Unlock full chat for KES 100
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Progress bar (full access only) */}
      {hasFullAccess && (
        <div className="bg-[#0d0d14] px-4 py-1.5 flex items-center justify-between border-t border-zinc-900">
          <span className="text-[10px] text-zinc-600">
            {messageCount} / {MIN_MESSAGES_TO_CLOSE} msgs
          </span>
          <div className="flex-1 mx-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00c97a] rounded-full transition-all"
              style={{ width: `${Math.min((messageCount / MIN_MESSAGES_TO_CLOSE) * 100, 100)}%` }}
            />
          </div>
          {canClose ? (
            <button
              onClick={() => setShowEndChatConfirm(true)}
              className="text-[10px] font-semibold text-[#00c97a] border border-[#00c97a]/30 bg-[#00c97a]/10 rounded-full px-2.5 py-0.5 transition-colors"
            >
              Claim KES 100
            </button>
          ) : (
            <span className="text-[10px] text-zinc-600">{MIN_MESSAGES_TO_CLOSE - messageCount} more</span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 bg-[#161622] border-t border-zinc-800 shrink-0">
        {!canSend && !hasFullAccess ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-full px-4 py-2.5 text-sm text-zinc-600 cursor-not-allowed">
              Unlock to continue chatting...
            </div>
            <Link
              href={`/dashboard/chat-foreigners/unlock/${personId}`}
              className="p-2.5 bg-[#00c97a] hover:bg-[#00b06a] text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 transition-colors"
            >
              <Lock size={18} />
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${person.name}...`}
              rows={1}
              disabled={chatClosed}
              className="flex-1 resize-none bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#00c97a]/50 focus:ring-1 focus:ring-[#00c97a]/20 max-h-28 leading-relaxed disabled:opacity-50"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim() || chatClosed}
              className="p-2.5 bg-[#00c97a] hover:bg-[#00b06a] text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
