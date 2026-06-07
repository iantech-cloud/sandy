/**
 * POST /api/support/tickets
 * Creates a support escalation ticket
 * GET  /api/support/tickets
 * Lists tickets for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, SupportTicket } from '@/app/lib/models';
import { AuditLogger } from '@/app/lib/services/audit-logger';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';

const ISSUE_TYPE_TO_CATEGORY: Record<string, string> = {
  fraud:              'security',
  account_suspension: 'general',
  payment_dispute:    'withdrawal',
  legal_issue:        'general',
  technical_issue:    'technical',
  general_support:    'general',
};

const ISSUE_TYPE_TO_PRIORITY: Record<string, string> = {
  fraud:              'urgent',
  account_suspension: 'high',
  payment_dispute:    'high',
  legal_issue:        'high',
  technical_issue:    'medium',
  general_support:    'medium',
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const session = await auth().catch(() => null);
    const userId = (session?.user as any)?.id ?? ip;

    // Rate limit: max 5 tickets per 10 minutes
    const { exceeded } = rateLimit(`tickets:${userId}`, 5, 10 * 60 * 1000);
    if (exceeded) {
      return NextResponse.json(
        { success: false, error: 'Too many ticket submissions. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { issue_type = 'general_support', description, subject } = body;

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please provide a detailed description (at least 10 characters)' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const ticket = await SupportTicket.create({
      user_id: userId,
      subject: subject || `Support Request: ${issue_type.replace(/_/g, ' ')}`,
      description: description.trim().substring(0, 2000),
      status: 'open',
      priority: ISSUE_TYPE_TO_PRIORITY[issue_type] || 'medium',
      category: ISSUE_TYPE_TO_CATEGORY[issue_type] || 'general',
      metadata: { issue_type, source: 'ai_assistant' },
    });

    const auditLogger = new AuditLogger();
    await auditLogger.logSupportEvent({
      type: 'ticket_created',
      user_id: userId,
      ticket_id: ticket._id.toString(),
      reason: description.substring(0, 100),
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      ticket_id: ticket._id.toString(),
      message: 'Your issue has been escalated. A support specialist will contact you within 24 hours.',
    });
  } catch (error) {
    console.error('[Support/Tickets POST]', error);
    return NextResponse.json({ success: false, error: 'Unable to create support ticket' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    await connectToDatabase();

    const tickets = await SupportTicket.find({ user_id: userId })
      .select('subject status priority category created_at')
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    console.error('[Support/Tickets GET]', error);
    return NextResponse.json({ success: false, error: 'Unable to fetch tickets' }, { status: 500 });
  }
}
