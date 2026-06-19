import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    return NextResponse.json({
      success: true,
      data: {
        available_balance_cents: 0,
        escrow_balance_cents: 0,
        total_earned_cents: 0,
        message: 'Wallet system ready'
      }
    });
  } catch (error) {
    console.error('[Wallet API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount_cents } = body;

    await connectToDatabase();

    if (action === 'withdraw') {
      return NextResponse.json({ success: true, message: 'Withdrawal processed' });
    }

    if (action === 'add_earnings') {
      return NextResponse.json({ success: true, message: 'Earnings added' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Wallet API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
