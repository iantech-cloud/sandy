/**
 * Audit Logger
 * Logs all AI interactions, security events, and sensitive data access for compliance
 */

import { Schema, model, models } from 'mongoose';
import { connectToDatabase } from '@/app/lib/models';

const AuditLogSchema = new Schema(
  {
    event_type: { type: String, required: true, index: true },
    user_id: { type: String, index: true },
    conversation_id: { type: String },
    message_id: { type: String },
    action: { type: String },
    data: { type: Schema.Types.Mixed },
    ip_address: { type: String },
    user_agent: { type: String },
    status: { type: String, default: 'logged' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

AuditLogSchema.index({ event_type: 1, timestamp: -1 });
AuditLogSchema.index({ user_id: 1, timestamp: -1 });

export const AuditLog = models.AuditLog || model('AuditLog', AuditLogSchema);

export class AuditLogger {
  /**
   * Log AI interaction
   */
  async logAIInteraction(data: {
    user_id?: string;
    conversation_id?: string;
    message_id?: string;
    user_message: string;
    ai_response: string;
    kb_used: boolean;
    user_context_provided: boolean;
    timestamp: Date;
  }) {
    try {
      await connectToDatabase();

      await AuditLog.create({
        event_type: 'ai_interaction',
        user_id: data.user_id,
        conversation_id: data.conversation_id,
        message_id: data.message_id,
        data: {
          user_message: data.user_message.substring(0, 500),
          ai_response: data.ai_response.substring(0, 500),
          kb_used: data.kb_used,
          user_context_provided: data.user_context_provided,
        },
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('[AuditLogger] AI Interaction logging error:', error);
    }
  }

  /**
   * Log security event (potential threats)
   */
  async logSecurityEvent(data: {
    type: string;
    user_id?: string;
    message: string;
    timestamp: Date;
    details?: any;
  }) {
    try {
      await connectToDatabase();

      await AuditLog.create({
        event_type: 'security_event',
        user_id: data.user_id,
        action: data.type,
        data: {
          message: data.message,
          details: data.details,
        },
        timestamp: data.timestamp,
      });

      // Alert if critical security event
      if (['prompt_injection_attempt', 'unauthorized_access', 'data_breach_attempt'].includes(data.type)) {
        console.warn(`[SECURITY ALERT] ${data.type}:`, data.message);
      }
    } catch (error) {
      console.error('[AuditLogger] Security event logging error:', error);
    }
  }

  /**
   * Log access to sensitive user data
   */
  async logAccessEvent(data: {
    type: string;
    user_id: string;
    accessed_data: string[];
    timestamp: Date;
  }) {
    try {
      await connectToDatabase();

      await AuditLog.create({
        event_type: 'data_access',
        user_id: data.user_id,
        action: data.type,
        data: {
          accessed_fields: data.accessed_data,
        },
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('[AuditLogger] Access event logging error:', error);
    }
  }

  /**
   * Log support escalation
   */
  async logSupportEvent(data: {
    type: string;
    user_id: string;
    ticket_id: string;
    reason: string;
    timestamp: Date;
  }) {
    try {
      await connectToDatabase();

      await AuditLog.create({
        event_type: 'support_escalation',
        user_id: data.user_id,
        action: data.type,
        data: {
          ticket_id: data.ticket_id,
          reason: data.reason,
        },
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('[AuditLogger] Support event logging error:', error);
    }
  }

  /**
   * Log error event
   */
  async logErrorEvent(data: {
    type: string;
    user_id?: string;
    error: string;
    timestamp: Date;
  }) {
    try {
      await connectToDatabase();

      await AuditLog.create({
        event_type: 'error',
        user_id: data.user_id,
        action: data.type,
        data: {
          error_message: data.error,
        },
        status: 'error',
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('[AuditLogger] Error event logging error:', error);
    }
  }

  /**
   * Get audit logs for a user (admin only - would need authorization middleware)
   */
  static async getAuditLogsForUser(userId: string, limit: number = 100) {
    try {
      await connectToDatabase();

      const logs = await AuditLog.find({ user_id: userId }).sort({ timestamp: -1 }).limit(limit);

      return logs;
    } catch (error) {
      console.error('[AuditLogger] Retrieval error:', error);
      throw error;
    }
  }

  /**
   * Get security events (admin only)
   */
  static async getSecurityEvents(limit: number = 100) {
    try {
      await connectToDatabase();

      const events = await AuditLog.find({ event_type: 'security_event' })
        .sort({ timestamp: -1 })
        .limit(limit);

      return events;
    } catch (error) {
      console.error('[AuditLogger] Security events retrieval error:', error);
      throw error;
    }
  }
}
