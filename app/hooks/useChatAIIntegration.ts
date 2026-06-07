'use client';

/**
 * Integration hook for adding AI support to existing chat components
 * Provides minimal, non-intrusive integration without breaking existing chat flows
 */

import { useState, useCallback } from 'react';
import { AIAssistantPanel } from '@/app/components/chat/AIAssistantPanel';

export interface ChatIntegrationState {
  showAIPanel: boolean;
  toggleAIPanel: () => void;
  AIPanel: React.ComponentType<{ isVisible: boolean; onClose: () => void }>;
}

/**
 * Hook to integrate AI support into any chat component
 */
export function useChatAIIntegration(): ChatIntegrationState {
  const [showAIPanel, setShowAIPanel] = useState(false);

  const toggleAIPanel = useCallback(() => {
    setShowAIPanel(prev => !prev);
  }, []);

  return {
    showAIPanel,
    toggleAIPanel,
    AIPanel: AIAssistantPanel,
  };
}
