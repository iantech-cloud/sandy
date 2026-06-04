import { NextRequest, NextResponse } from 'next/server';
import { initiateBotUnlockViaMpesa } from '@/app/actions/chat-foreigners/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botId, phoneNumber, referralCode } = body;

    if (!botId || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await initiateBotUnlockViaMpesa(botId, phoneNumber, referralCode);
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
