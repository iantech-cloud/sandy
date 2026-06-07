/**
 * useAISupportAssistant Hook
 * Manages AI support interactions within the chat widget
 */

import { useState, useCallback } from 'react';
import type { AISupportMessage, AIMetadata } from '@/app/types/ai-support';

interface UseAISupportOptions {
  conversationId?: string;
  userId?: string;
  onResponse?: (message: AISupportMessage, metadata: AIMetadata) => void;
  onError?: (error: string) => void;
}

export function useAISupportAssistant(options: UseAISupportOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMetadata, setLastMetadata] = useState<AIMetadata | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string): Promise<{ message: AISupportMessage; metadata: AIMetadata } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/support/ai-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            conversationId: options.conversationId,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to process message');
        }

        const aiMessage: AISupportMessage = {
          _id: `ai_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          sender_id: 'ai-support',
          sender_role: 'ai',
          content: data.message,
          message_type: 'ai_response',
          status: 'delivered',
          created_at: new Date().toISOString(),
          is_ai_generated: true,
          escalated: data.metadata?.escalated || false,
          escalation_reason: data.metadata?.escalation_reason,
          ticket_id: data.metadata?.ticket_id,
          requires_auth: data.metadata?.requires_auth || false,
          sender: {
            _id: 'ai-support',
            username: 'HustleHub Support',
            role: 'ai',
            avatar: '🤖',
          },
        };

        const metadata: AIMetadata = {
          escalated: data.metadata?.escalated || false,
          escalation_reason: data.metadata?.escalation_reason,
          ticket_id: data.metadata?.ticket_id,
          source: data.metadata?.source || 'ai',
          requires_auth: data.metadata?.requires_auth || false,
        };

        setLastMetadata(metadata);

        if (options.onResponse) {
          options.onResponse(aiMessage, metadata);
        }

        return { message: aiMessage, metadata };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);

        if (options.onError) {
          options.onError(errorMessage);
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    clearError,
    lastMetadata,
  };
}
