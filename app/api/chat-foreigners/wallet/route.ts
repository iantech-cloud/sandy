import { NextRequest, NextResponse } from 'next/server';
import { getChatForeignersWallet, getChatForeignersWalletTransactions } from '@/app/actions/chat-foreigners/wallet';

export async function GET(request: NextRequest) {
  try {
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
