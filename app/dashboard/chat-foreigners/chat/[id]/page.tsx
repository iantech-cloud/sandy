'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader } from 'lucide-react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load person details
        const personRes = await fetch(`/api/chat-foreigners/bots?type=details&botId=${personId}`);
        const personData = await personRes.json();

        if (!personData.success) {
          router.push('/dashboard/chat-foreigners');
          return;
        }
        setPerson(personData.data);

        // Check access
        const accessRes = await fetch(`/api/chat-foreigners/bots?type=check&botId=${personId}`);
        const accessData = await accessRes.json();

        if (!accessData.success || !accessData.hasAccess) {
          router.push(`/dashboard/chat-foreigners/unlock/${personId}`);
          return;
        }

        setHasAccess(true);
        setMessageCount(accessData.data?.messageCount || 0);

        // Add welcome message
        if (personData.data) {
          const p = personData.data;
          setMessages([
            {
              role: 'assistant',
              content: `Hi! I am ${p.name}. ${p.bio || ''} How can I help you today?`,
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
    if (!input.trim() || sending || !person) return;

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
            content: 'Sorry, I could not process your message. Please try again.',
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
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
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
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!person || !hasAccess) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shadow-sm">
        <Link
          href="/dashboard/chat-foreigners"
          className="text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft size={20} />
        </Link>
        {person.avatar_url && (
          <img
            src={person.avatar_url}
            alt={person.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <h2 className="font-bold text-slate-900">{person.name}</h2>
          {person.username && (
            <p className="text-xs text-slate-500">@{person.username} &bull; {person.category}</p>
          )}
        </div>
        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          {messageCount} messages
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}
          >
            {msg.role === 'assistant' && person.avatar_url && (
              <img
                src={person.avatar_url}
                alt={person.name}
                className="w-8 h-8 rounded-full object-cover self-end flex-shrink-0"
              />
            )}
            <div
              className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start gap-3">
            {person.avatar_url && (
              <img
                src={person.avatar_url}
                alt={person.name}
                className="w-8 h-8 rounded-full object-cover self-end flex-shrink-0"
              />
            )}
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${person.name}...`}
            rows={1}
            className="flex-1 resize-none px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {sending ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
