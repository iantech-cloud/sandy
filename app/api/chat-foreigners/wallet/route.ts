import { NextRequest, NextResponse } from 'next/server';
import { getChatForeignersWallet, getChatForeignersWalletTransactions } from '@/app/actions/chat-foreigners/wallet';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { exceeded, resetTime } = rateLimit(
      `cf:wallet:${(session?.user as any)?.id ?? ip}`,
      API_RATE_LIMITS.cfWallet.limit,
      API_RATE_LIMITS.cfWallet.windowMs
    );
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please slow down.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'balance';
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = parseInt(searchParams.get('skip') || '0');

    if (type === 'transactions') {
      const result = await getChatForeignersWalletTransactions(limit, skip);
      return NextResponse.json(result);
    }

    const result = await getChatForeignersWallet();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Wallet fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
