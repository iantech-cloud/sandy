import { NextRequest, NextResponse } from 'next/server';
import { initiateWalletDepositViaMpesa } from '@/app/actions/chat-foreigners/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amountCents, phoneNumber } = body;

    if (!amountCents || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await initiateWalletDepositViaMpesa(amountCents, phoneNumber);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Wallet deposit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
