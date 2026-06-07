/**
 * AI Orchestrator
 * Coordinates the RAG pipeline: retrieval, context building, LLM generation, and escalation
 */

import {
  createSafePrompt,
  getLLMResponse,
  containsPromptInjection,
  SUPPORT_SYSTEM_PROMPT,
} from '@/app/lib/services/nvidia-ai';
import { searchKnowledgeBase } from '@/app/lib/services/knowledge-base';
import {
  getUserProfile,
  getUserWithdrawals,
  getUserReferrals,
  getUserVerificationStatus,
  createEscalationTicket,
} from '@/app/lib/services/support-api';
import { AuditLogger } from '@/app/lib/services/audit-logger';

interface AIRequestContext {
  userId?: string;
  messageId?: string;
  conversationId?: string;
  sessionToken?: string;
}

interface AIResponse {
  message: string;
  escalated: boolean;
  escalation_reason?: string;
  ticket_id?: string;
  source: 'kb' | 'ai' | 'escalation';
  requires_auth: boolean;
}

/**
 * Main AI orchestrator function
 */
export async function processAIRequest(
  userMessage: string,
  context: AIRequestContext,
  isAuthenticated: boolean
): Promise<AIResponse> {
  const auditLogger = new AuditLogger();

  try {
    // Check for prompt injection attempts
    if (containsPromptInjection(userMessage)) {
      await auditLogger.logSecurityEvent({
        type: 'prompt_injection_attempt',
        user_id: context.userId,
        message: userMessage.substring(0, 100),
        timestamp: new Date(),
      });

      return {
        message:
          'I cannot access or reveal confidential system information. Please ask about platform features or account-related questions I can help with.',
        escalated: false,
        source: 'ai',
        requires_auth: false,
      };
    }

    // Determine if question requires authentication
    const requiresAuth = shouldRequireAuth(userMessage);
    if (requiresAuth && !isAuthenticated) {
      return {
        message:
          'Please log in to access account-specific information like your balance, withdrawals, or referral earnings.',
        escalated: false,
        requires_auth: true,
        source: 'ai',
      };
    }

    // Check if this should be escalated to human support
    if (shouldEscalate(userMessage)) {
      const escalationResult = await createEscalationTicket(
        context.userId || 'guest',
        extractIssueType(userMessage),
        userMessage
      );

      if (escalationResult.success) {
        await auditLogger.logSupportEvent({
          type: 'escalation_created',
          user_id: context.userId,
          ticket_id: escalationResult.ticket_id,
          reason: userMessage.substring(0, 100),
          timestamp: new Date(),
        });

        return {
          message: escalationResult.message,
          escalated: true,
          escalation_reason: extractIssueType(userMessage),
          ticket_id: escalationResult.ticket_id,
          source: 'escalation',
          requires_auth: false,
        };
      }
    }

    // Step 1: Retrieve relevant knowledge base documents
    const kbResults = await searchKnowledgeBase(userMessage);
    const kbContext = kbResults.map((doc: any) => `${doc.title}: ${doc.content}`).join('\n');

    // Step 2: Build additional context from user data if authenticated
    let userContext = '';
    if (isAuthenticated && context.userId) {
      const [profileData, withdrawalData, referralData] = await Promise.all([
        getUserProfile(context.userId),
        getUserWithdrawals(context.userId),
        getUserReferrals(context.userId),
      ]);

      userContext = buildUserContext(profileData, withdrawalData, referralData);

      await auditLogger.logAccessEvent({
        type: 'user_data_accessed',
        user_id: context.userId,
        accessed_data: ['profile', 'withdrawals', 'referrals'],
        timestamp: new Date(),
      });
    }

    // Step 3: Create safe prompt with context
    const fullContext = `${kbContext}\n${userContext}`.trim();
    const messages = createSafePrompt(userMessage, fullContext, context.userId);

    // Step 4: Get LLM response
    const aiResponse = await getLLMResponse(messages);

    // Step 5: Log the interaction
    await auditLogger.logAIInteraction({
      user_id: context.userId,
      conversation_id: context.conversationId,
      message_id: context.messageId,
      user_message: userMessage,
      ai_response: aiResponse,
      kb_used: kbResults.length > 0,
      user_context_provided: isAuthenticated && context.userId,
      timestamp: new Date(),
    });

    return {
      message: aiResponse,
      escalated: false,
      source: kbResults.length > 0 ? 'kb' : 'ai',
      requires_auth: false,
    };
  } catch (error) {
    console.error('[AI Orchestrator] Error:', error);

    // Log error
    await auditLogger.logErrorEvent({
      type: 'ai_processing_error',
      user_id: context.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    });

    // Escalate on error
    const escalation = await createEscalationTicket(
      context.userId || 'guest',
      'technical_issue',
      'An error occurred processing your request'
    );

    return {
      message:
        'We encountered an issue processing your request. A support specialist has been notified and will help you shortly.',
      escalated: true,
      escalation_reason: 'Technical error',
      ticket_id: escalation.ticket_id,
      source: 'escalation',
      requires_auth: false,
    };
  }
}

/**
 * Determine if a question requires authentication
 */
function shouldRequireAuth(message: string): boolean {
  const authKeywords = [
    'my balance',
    'my earnings',
    'my account',
    'my withdrawals',
    'my referrals',
    'my profile',
    'my commissions',
    'how much did i earn',
    'when can i withdraw',
    'my verification',
  ];

  return authKeywords.some((keyword) => message.toLowerCase().includes(keyword));
}

/**
 * Determine if issue should be escalated
 */
function shouldEscalate(message: string): boolean {
  const escalationKeywords = [
    'fraud',
    'hacked',
    'stolen',
    'suspended',
    'banned',
    'dispute',
    'legal',
    'complaint',
    'threat',
    'harassment',
    'payment failed',
    'money missing',
    'unauthorized',
  ];

  return escalationKeywords.some((keyword) => message.toLowerCase().includes(keyword));
}

/**
 * Extract issue type for escalation
 */
function extractIssueType(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('fraud') || lower.includes('hacked') || lower.includes('stolen')) {
    return 'fraud';
  }
  if (lower.includes('suspended') || lower.includes('banned')) {
    return 'account_suspension';
  }
  if (lower.includes('payment') || lower.includes('money missing')) {
    return 'payment_dispute';
  }
  if (lower.includes('legal') || lower.includes('complaint')) {
    return 'legal_issue';
  }

  return 'general_support';
}

/**
 * Build user context for authenticated requests
 */
function buildUserContext(profileData: any, withdrawalData: any, referralData: any): string {
  if (!profileData.success) return '';

  const lines = ['User Context:'];

  if (profileData.data) {
    lines.push(`- Status: ${profileData.data.status}`);
    lines.push(
      `- Verified: ${profileData.data.verified ? 'Yes' : 'No (may limit features)'}`
    );
  }

  if (withdrawalData?.success) {
    lines.push(
      `- Balance: KES ${withdrawalData.data.balance_cents ? (withdrawalData.data.balance_cents / 100).toFixed(2) : '0'}`
    );
    lines.push(
      `- Total Withdrawn: KES ${withdrawalData.data.total_withdrawn ? (withdrawalData.data.total_withdrawn / 100).toFixed(2) : '0'}`
    );
  }

  if (referralData?.success) {
    lines.push(`- Referral Code: ${referralData.data.referral_code || 'Not set'}`);
    lines.push(`- Total Referrals: ${referralData.data.total_referrals || 0}`);
    lines.push(
      `- Referral Earnings: KES ${referralData.data.total_earnings ? (referralData.data.total_earnings / 100).toFixed(2) : '0'}`
    );
  }

  return lines.join('\n');
}
