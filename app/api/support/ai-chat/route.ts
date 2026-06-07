/**
 * AI Support Chat API Route
 * Handles incoming user messages and returns AI-generated responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { processAIRequest } from '@/app/lib/services/ai-orchestrator';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 support requests per minute per user/IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const session = await auth().catch(() => null);
    const userId = (session?.user as any)?.id ?? ip;
    const limitKey = `support:ai:${userId}`;
    const { exceeded, resetTime } = rateLimit(limitKey, API_RATE_LIMITS.cfChat.limit, API_RATE_LIMITS.cfChat.windowMs);

    if (exceeded) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait before sending another message.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { message, conversationId, messageId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid message' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message is too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Process the AI request
    const aiResponse = await processAIRequest(
      message,
      {
        userId: (session?.user as any)?.id,
        messageId,
        conversationId,
        sessionToken: session?.user?.id,
      },
      !!session?.user
    );

    return NextResponse.json({
      success: true,
      message: aiResponse.message,
      metadata: {
        escalated: aiResponse.escalated,
        escalation_reason: aiResponse.escalation_reason,
        ticket_id: aiResponse.ticket_id,
        source: aiResponse.source,
        requires_auth: aiResponse.requires_auth,
      },
    });
  } catch (error) {
    console.error('[Support AI] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred processing your request. Our support team has been notified.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({ status: 'ok', service: 'support-ai' });
}
