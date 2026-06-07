/**
 * AI Support Assistant Message Type
 * Extends the chat message interface to support AI responses
 */

export interface AISupportMessage {
  _id: string;
  sender_id: string;
  sender_role: 'user' | 'ai' | 'support';
  content: string;
  message_type: 'text' | 'system' | 'ai_response';
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  is_ai_generated?: boolean;
  escalated?: boolean;
  escalation_reason?: string;
  ticket_id?: string;
  requires_auth?: boolean;
  sender?: {
    _id: string;
    username: string;
    email?: string;
    role: string;
    avatar?: string;
  };
}

export interface AIMetadata {
  escalated: boolean;
  escalation_reason?: string;
  ticket_id?: string;
  source: 'kb' | 'ai' | 'escalation';
  requires_auth: boolean;
}
