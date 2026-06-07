'use client';

import { useState, useRef, useEffect } from 'react';
import { useAISupportAssistant } from '@/app/hooks/useAISupportAssistant';
import {
  Bot,
  AlertCircle,
  CheckCircle,
  Send,
  Loader2,
  User,
  PhoneCall,
  X,
} from 'lucide-react';
import type { AISupportMessage, AIMetadata } from '@/app/types/ai-support';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  escalated?: boolean;
  ticket_id?: string;
  requires_auth?: boolean;
  timestamp: Date;
}

interface AIAssistantPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onSwitchToHuman: () => void;
}

const QUICK_REPLIES = [
  'How do I withdraw money?',
  'How do referrals work?',
  'How do I verify my account?',
  'What is Chat Foreigners?',
];

export function AIAssistantPanel({ isVisible, onClose, onSwitchToHuman }: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [escalationTicket, setEscalationTicket] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, isLoading, error, clearError } = useAISupportAssistant({
    onResponse: (message: AISupportMessage, meta: AIMetadata) => {
      setChatHistory(prev => [
        ...prev,
        {
          id: message._id,
          role: 'assistant',
          content: message.content,
          escalated: meta.escalated,
          ticket_id: meta.ticket_id,
          requires_auth: meta.requires_auth,
          timestamp: new Date(),
        },
      ]);
      if (meta.escalated && meta.ticket_id) {
        setEscalationTicket(meta.ticket_id);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput('');
    clearError();

    // Add user message to history immediately
    setChatHistory(prev => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      },
    ]);

    await sendMessage(content);
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full">
      {/* AI Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Support Assistant</p>
            <p className="text-xs text-indigo-200 mt-0.5">Powered by NVIDIA</p>
          </div>
        </div>
        <button
          onClick={onSwitchToHuman}
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Switch to human support agent"
        >
          <PhoneCall className="w-3 h-3" />
          Human support
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-gray-50 to-white min-h-0">
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bot className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Ask me anything about HustleHub</p>
              <p className="text-xs text-gray-400 mt-1">Registration · Referrals · Withdrawals · Account help</p>
            </div>
            {/* Quick reply chips */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {QUICK_REPLIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map(entry => (
          <div
            key={entry.id}
            className={`flex items-end gap-2 animate-fadeIn ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {entry.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{entry.content}</p>
              {entry.requires_auth && (
                <p className="text-xs mt-1.5 italic opacity-80">Log in to access account info</p>
              )}
              {entry.escalated && entry.ticket_id && (
                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-1.5 text-amber-600">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                  <span className="text-xs">Ticket #{entry.ticket_id} created</span>
                </div>
              )}
            </div>
            {entry.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mb-0.5">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator while waiting for AI */}
        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {escalationTicket && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Your issue has been escalated. Ticket <strong>#{escalationTicket}</strong> — a support specialist will contact you shortly.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 text-white rounded-xl transition-colors"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          AI responses may be inaccurate. For urgent issues, use human support.
        </p>
      </div>
    </div>
  );
}
