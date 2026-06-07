'use client';

import { useState, useEffect } from 'react';
import { useAISupportAssistant } from '@/app/hooks/useAISupportAssistant';
import { Bot, AlertCircle, CheckCircle } from 'lucide-react';
import type { AISupportMessage, AIMetadata } from '@/app/types/ai-support';

interface AIAssistantPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * AI Support Assistant Panel
 * Standalone panel for AI-powered support chat
 * Integrates with existing UserChatWidget but can operate independently
 */
export function AIAssistantPanel({ isVisible, onClose }: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AISupportMessage[]>([]);
  const [metadata, setMetadata] = useState<AIMetadata | null>(null);
  const [showEscalation, setShowEscalation] = useState(false);

  const { sendMessage, isLoading, error } = useAISupportAssistant({
    onResponse: (message, meta) => {
      setMessages(prev => [...prev, message]);
      setMetadata(meta);
      if (meta.escalated && meta.ticket_id) {
        setShowEscalation(true);
      }
    },
    onError: (err) => {
      console.error('[AI Support] Error:', err);
    }
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    await sendMessage(userMsg);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-semibold">HustleHub Support Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-purple-700 p-1 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Ask me anything about HustleHub!</p>
            <p className="text-xs mt-2 text-gray-400">Registration • Referrals • Withdrawals • Account Issues</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.escalated && (
                  <p className="text-xs mt-1 opacity-75">✓ Escalated to support team</p>
                )}
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {showEscalation && metadata?.ticket_id && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-start space-x-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Ticket #{metadata.ticket_id} - Support specialist will contact you shortly</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
        <div className="flex space-x-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
