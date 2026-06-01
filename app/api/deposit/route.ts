/**
 * POST /api/deposit
 *
 * Legacy endpoint kept for backward compatibility.
 * Delegates to the canonical `processMpesaDeposit` server action
 * which uses Co-op Bank STK Push internally.
 */
import { NextRequest, NextResponse } from 'next/server';
import { processMpesaDeposit } from '@/app/actions/deposit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, phoneNumber } = body;

    if (!amount || !phoneNumber) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: amount, phoneNumber' },
        { status: 400 }
      );
    }

    const result = await processMpesaDeposit({ amount: Number(amount), phoneNumber });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('[api/deposit] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error while processing deposit' },
      { status: 500 }
    );
  }
}
