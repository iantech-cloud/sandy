'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader, MoreVertical, Phone, Video, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
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
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  category: string;
}

const MIN_MESSAGES_TO_CLOSE = 20;

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [chatClosed, setChatClosed] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canClose = messageCount >= MIN_MESSAGES_TO_CLOSE;

  useEffect(() => {
    const loadData = async () => {
      try {
        const personRes = await fetch(`/api/chat-foreigners/bots?type=details&botId=${personId}`);
        const personData = await personRes.json();

        if (!personData.success) {
          router.push('/dashboard/chat-foreigners');
          return;
        }
        setPerson(personData.data);

        const accessRes = await fetch(`/api/chat-foreigners/bots?type=check&botId=${personId}`);
        const accessData = await accessRes.json();

        if (!accessData.success || !accessData.hasAccess) {
          router.push(`/dashboard/chat-foreigners/unlock/${personId}`);
          return;
        }

        setHasAccess(true);
        setMessageCount(accessData.data?.messageCount || 0);

        if (personData.data) {
          const greetings = [
            `Hey you! How are you doing today? Like really doing? 😊`,
            `Hi! So glad you reached out. What's on your mind?`,
            `Hey! Good timing — I was just thinking. How are you?`,
            `Hello! You caught me at a great time. What's up?`,
          ];
          const greeting = greetings[Math.floor(Math.random() * greetings.length)];
          setMessages([
            {
              role: 'assistant',
              content: greeting,
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        console.error('[v0] Error loading chat:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [personId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !person || chatClosed) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat-foreigners/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          message: userMessage.content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            timestamp: new Date(),
          },
        ]);
        setMessageCount((prev) => prev + 1);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, could not process your message right now. Try again in a moment.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('[v0] Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
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
    } catch (err) {
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
      <div className="flex flex-col h-screen bg-zinc-950 items-center justify-center">
        <Loader className="animate-spin text-primary" size={32} />
        <p className="text-zinc-500 mt-3 text-sm">Loading chat...</p>
      </div>
    );
  }

  if (!person || !hasAccess) return null;

  // Chat closed — show success screen
  if (chatClosed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-8 max-w-sm w-full text-center text-zinc-100 space-y-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Chat Completed!</h2>
          <p className="text-zinc-400 text-sm">
            KES {creditAmount} has been credited to your Chat Foreigners wallet (non-withdrawable).
          </p>
          <p className="text-xs text-zinc-500">
            To chat with {person.name} again, you&apos;ll need to unlock with a fresh KES 100 payment.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/dashboard/chat-foreigners/wallet"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-full flex items-center justify-center transition-colors"
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

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="px-3 py-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/chat-foreigners"
            className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-300 font-bold text-sm">
                    {person.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-zinc-900" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{person.name}</h2>
              <p className="text-xs text-primary">Active now</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowEndChatConfirm(true)}
            disabled={closingChat}
            className="p-2 text-zinc-400 hover:text-red-400 rounded-full hover:bg-zinc-800 transition-colors"
            title="End Chat"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Close error banner */}
      {closeError && (
        <div className="bg-red-950/50 border-b border-red-900/50 px-4 py-2 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{closeError}</span>
          <button
            onClick={() => setCloseError('')}
            className="ml-auto text-red-500 hover:text-red-300 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* End chat confirm dialog */}
      {showEndChatConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-zinc-100">End Chat Session?</h3>
            {canClose ? (
              <p className="text-zinc-400 text-sm">
                You will receive <span className="text-primary font-semibold">KES 100</span> credited to your Chat Foreigners wallet (non-withdrawable). To chat with {person.name} again you will need to pay KES 100 to unlock.
              </p>
            ) : (
              <p className="text-zinc-400 text-sm">
                You need at least <span className="text-primary font-semibold">{MIN_MESSAGES_TO_CLOSE} messages</span> to end the chat and receive your reward. You currently have <span className="font-semibold">{messageCount}</span>.
              </p>
            )}
            <div className="flex gap-3">
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
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {closingChat ? <Loader size={16} className="animate-spin" /> : null}
                  End & Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-zinc-950 relative">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="text-center text-xs text-zinc-500 my-2">
          Chat started today
        </div>

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
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-zinc-800 text-zinc-100 rounded-tl-sm border border-zinc-700/50'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <div className={`text-[10px] mt-1 text-right ${isUser ? 'text-primary-foreground/70' : 'text-zinc-500'}`}>
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </div>
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
            <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center border border-zinc-700/50">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message count + close CTA */}
      <div className="bg-zinc-950 px-4 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-0.5">
          {messageCount} / {MIN_MESSAGES_TO_CLOSE} messages
        </span>
        {canClose ? (
          <button
            onClick={() => setShowEndChatConfirm(true)}
            className="text-[11px] font-semibold text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 rounded-full px-3 py-0.5 transition-colors"
          >
            End Chat &amp; Claim KES 100
          </button>
        ) : (
          <span className="text-[11px] text-zinc-600">
            {MIN_MESSAGES_TO_CLOSE - messageCount} more to claim reward
          </span>
        )}
      </div>

      {/* Input Area */}
      <div className="px-3 py-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${person.name}...`}
            rows={1}
            disabled={chatClosed}
            className="flex-1 resize-none bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 max-h-28 leading-relaxed disabled:opacity-50"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim() || chatClosed}
            className="p-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
