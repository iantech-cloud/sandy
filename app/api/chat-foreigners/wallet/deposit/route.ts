import { NextRequest, NextResponse } from 'next/server';
import { initiateWalletDepositViaMpesa } from '@/app/actions/chat-foreigners/payments';
import { z } from 'zod';

const depositSchema = z.object({
  amountCents: z.number().int().min(1000).max(1500000),
  phoneNumber: z.string().regex(/^254\d{9}$/, 'Use a valid 254XXXXXXXXX phone number'),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = depositSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid deposit amount or phone number' }, { status: 400 });
    }

    const result = await initiateWalletDepositViaMpesa(parsed.data.amountCents, parsed.data.phoneNumber);
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
