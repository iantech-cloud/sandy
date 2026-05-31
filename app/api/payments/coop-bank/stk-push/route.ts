import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, MpesaTransaction } from '@/app/lib/models';
import { createCoopBankService } from '@/app/lib/services/coop-bank';

/**
 * POST /api/payments/coop-bank/stk-push
 * Initiates an STK push payment via Co-operative Bank
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get authenticated user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { amount, phoneNumber, narration = 'Payment to HustleHub Africa', depositType = 'wallet' } = body;

    // Validation
    if (!amount || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: amount, phoneNumber' },
        { status: 400 }
      );
    }

    if (amount < 1 || amount > 999999) {
      return NextResponse.json(
        { success: false, error: 'Amount must be between KES 1 and KES 999,999' },
        { status: 400 }
      );
    }

    // Normalize phone number
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('254')) {
      formattedPhone = phoneNumber;
    } else if (phoneNumber.startsWith('0')) {
      formattedPhone = `254${phoneNumber.substring(1)}`;
    } else if (phoneNumber.startsWith('+254')) {
      formattedPhone = phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('01')) {
      formattedPhone = `254${phoneNumber.substring(1)}`;
    } else {
      formattedPhone = `254${phoneNumber}`;
    }

    // Validate phone format
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format. Use Kenyan format (07... or 2547...)' },
        { status: 400 }
      );
    }

    // Generate message reference — used as idempotency key and callback lookup key
    const messageReference = `SANDY${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create CoopBank service
    const coopBank = createCoopBankService();

    // Callback URL for payment confirmation
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    // Initiate STK push (PascalCase payload constructed inside the service)
    const stkResponse = await coopBank.initiateSTKPush(
      formattedPhone,
      amount,
      narration,
      callbackUrl,
      messageReference
    );

    // Non-'0' ResponseCode means the bank rejected the initiation
    if (stkResponse.ResponseCode !== '0') {
      return NextResponse.json(
        {
          success: false,
          error: stkResponse.ResponseDescription || 'STK Push rejected by bank',
        },
        { status: 400 }
      );
    }

    // Store transaction record (checkout_request_id == messageReference for callback lookup)
    const mpesaTransaction = await MpesaTransaction.create({
      user_id: userId,
      amount_cents: Math.round(amount * 100),
      phone_number: formattedPhone,
      status: 'initiated',
      source: 'coop_bank',
      checkout_request_id: messageReference,
      is_activation_payment: depositType === 'activation',
      metadata: {
        deposit_type: depositType,
        message_reference: messageReference,
        payment_method: 'coop_bank_stk_push',
        // For spin wallet: money goes to company, not user balance
        revenue_target: depositType === 'spin_wallet' ? 'company' : 'user',
        initiated_at: new Date().toISOString(),
      },
    });

    console.log('[API] Co-op Bank STK Push initiated:', {
      userId,
      amount,
      messageReference,
      transactionId: mpesaTransaction._id,
    });

    return NextResponse.json({
      success: true,
      data: {
        messageReference,
        transactionId: mpesaTransaction._id.toString(),
        amount,
        phoneNumber: formattedPhone,
      },
      message: stkResponse.ResponseDescription || 'STK Push initiated. Please check your phone to complete the payment.',
    });
  } catch (error) {
    console.error('[API] STK Push error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate payment',
      },
      { status: 500 }
    );
  }
}
