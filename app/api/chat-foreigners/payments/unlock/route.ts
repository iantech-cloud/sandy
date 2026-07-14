import { NextRequest, NextResponse } from 'next/server';
import { initiateBotUnlockViaMpesa } from '@/app/actions/chat-foreigners/payments';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 10 unlock payment initiations per minute per user
    const session = await auth().catch(() => null);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `cf:unlock:${(session?.user as any)?.id ?? ip}`;
    const { exceeded, resetTime } = rateLimit(key, API_RATE_LIMITS.payments.limit, API_RATE_LIMITS.payments.windowMs);
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many payment attempts. Please wait and try again.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
      });
    }

    const body = await request.json();
    const { botId, phoneNumber, referralCode, customAmountCents } = body;

    if (!botId || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await initiateBotUnlockViaMpesa(botId, phoneNumber, referralCode, customAmountCents);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Payment unlock error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
