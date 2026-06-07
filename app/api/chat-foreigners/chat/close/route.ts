import { NextRequest, NextResponse } from 'next/server';
import { closeChat } from '@/app/actions/chat-foreigners/payments';
import { rateLimit } from '@/app/lib/rate-limit';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 close-chat attempts per minute per user
    const session = await auth().catch(() => null);
    const sessionId = (session?.user as any)?.id ?? (request.headers.get('x-forwarded-for') ?? 'unknown');
    const { exceeded, resetTime } = rateLimit(`cf:close:${sessionId}`, 5, 60_000);
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please slow down.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
      });
    }

    const body = await request.json();
    const { botId } = body;

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Missing botId' },
        { status: 400 }
      );
    }

    const result = await closeChat(botId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Close chat error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
