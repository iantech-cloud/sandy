import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, MpesaTransaction } from '@/app/lib/models';
import { createCoopBankService, CoopBankService } from '@/app/lib/services/coop-bank';

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

    // Normalize phone number — delegate to the service helper for consistency
    const formattedPhone = CoopBankService.normalisePhone(phoneNumber);

    // Validate: must be 254 followed by exactly 9 digits (any KE network)
    if (!/^254\d{9}$/.test(formattedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number. Use a Kenyan number: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX',
        },
        { status: 400 }
      );
    }

    // Generate prefix based on deposit type
    // ✅ ACT for activation, CHAT for chat foreigners, SPINDY for spin wallet, CAS for gaming
    let prefix: string;
    if (depositType === 'activation') {
      prefix = 'ACT';
    } else if (depositType === 'wallet') {
      prefix = 'CHAT';
    } else if (depositType === 'spin_wallet') {
      prefix = 'SPINDY';
    } else if (depositType === 'gaming') {
      prefix = 'CAS'; // Gaming wallet deposits use CAS_ prefix
    } else {
      prefix = 'CHAT'; // Default to CHAT for 'deposit' and other wallet types
    }

    // Generate message reference — used as idempotency key and callback lookup key
    const messageReference = `${prefix}_${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create CoopBank service
    const coopBank = createCoopBankService();

    // Callback URL for payment confirmation
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    // Map depositType to valid source enum values
    const sourceMap: { [key: string]: string } = {
      'activation': 'activation',
      'wallet': 'wallet',
      'spin_wallet': 'spin_wallet',
      'gaming': 'gaming',
      'deposit': 'wallet',
    };
    const source = sourceMap[depositType] || 'wallet';

    // ── CRITICAL: persist the transaction BEFORE calling the bank ────────────
    // Under high traffic the bank's callback can arrive before our code finishes
    // running. If the MpesaTransaction does not exist yet, the callback returns
    // 404 "Transaction not found" and the payment/activation is silently lost.
    // Creating the record first guarantees the callback always finds a match.
    const mpesaTransaction = await MpesaTransaction.create({
      user_id: userId,
      amount_cents: Math.round(amount * 100),
      phone_number: formattedPhone,
      account_reference: messageReference,
      transaction_desc: narration,
      status: 'initiated',
      source: source,
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

    // Initiate STK push (PascalCase payload constructed inside the service)
    console.log('[API] Calling coopBank.initiateSTKPush with:', {
      phone: formattedPhone,
      amount,
      narration,
      callbackUrl,
      messageReference,
      transactionId: mpesaTransaction._id.toString(),
    });

    let stkResponse;
    try {
      stkResponse = await coopBank.initiateSTKPush(
        formattedPhone,
        amount,
        narration,
        callbackUrl,
        messageReference
      );
      console.log('[API] STK Push response received:', stkResponse);
    } catch (error) {
      // Bank call threw — mark the pre-created record as failed so it is not
      // left dangling as "initiated" forever (the recovery job ignores failed).
      console.error('[API] STK Push initiation failed with exception:', error);
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: error instanceof Error ? error.message : 'STK Push request failed',
        failed_at: new Date(),
      });
      throw error;
    }

    // Non-'0' ResponseCode means the bank rejected the initiation
    if (stkResponse.ResponseCode !== '0') {
      console.warn('[API] STK Push rejected by bank:', {
        responseCode: stkResponse.ResponseCode,
        description: stkResponse.ResponseDescription,
      });

      // Map specific error codes to helpful messages
      let userFriendlyError = stkResponse.ResponseDescription || 'STK Push rejected by bank';
      let diagnosticInfo: { [key: string]: string } = {};

      if (stkResponse.ResponseCode === '-8') {
        userFriendlyError = 'Account authorization failed. Please contact support - this is a merchant account configuration issue.';
        diagnosticInfo = {
          issue: 'DEBIT_ACCOUNT_AUTHORIZATION_FAILURE',
          code: '-8',
          cause: 'The Co-op Bank merchant account (OperatorCode or BasicAuth credentials) does not have STK Push or debit authorization enabled.',
          action: 'Contact Co-op Bank merchant support to enable STK Push functionality on the account.',
          bankMessage: stkResponse.ResponseDescription || 'No description',
        };
      } else if (stkResponse.ResponseCode === '-1') {
        userFriendlyError = 'Payment system is temporarily unavailable. Please try again in a moment.';
        diagnosticInfo = {
          issue: 'SYSTEM_ERROR',
          code: '-1',
          cause: 'Co-op Bank system error',
          action: 'Retry the payment',
          bankMessage: stkResponse.ResponseDescription || 'No description',
        };
      } else if (stkResponse.ResponseCode === '-2') {
        userFriendlyError = 'Invalid request parameters. Please try again or contact support.';
        diagnosticInfo = {
          issue: 'INVALID_PARAMETERS',
          code: '-2',
          cause: 'Request parameters do not match Co-op Bank API requirements',
          action: 'Verify phone number, amount, and account configuration',
          bankMessage: stkResponse.ResponseDescription || 'No description',
        };
      } else if (stkResponse.ResponseCode === '-3') {
        userFriendlyError = 'Invalid amount. Ensure the amount is between KES 1 and KES 999,999.';
        diagnosticInfo = {
          issue: 'INVALID_AMOUNT',
          code: '-3',
          cause: 'Amount is out of acceptable range',
          action: 'Check that amount is between 1 and 999,999 KES',
          bankMessage: stkResponse.ResponseDescription || 'No description',
        };
      }

      // Log diagnostic info server-side for troubleshooting
      console.error('[API] STK Push Bank Error Diagnostics:', {
        ...diagnosticInfo,
        merchantOperatorCode: process.env.COOP_BANK_OPERATOR_CODE,
        basicAuthConfigured: !!process.env.COOP_BANK_BASIC_AUTH,
        phoneNumber: formattedPhone,
        amount,
        narration,
      });

      // Mark the pre-created record as failed (non-blocking background update)
      (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_code: parseInt(stkResponse.ResponseCode || '1', 10) || 1,
        result_desc: stkResponse.ResponseDescription || 'STK Push rejected by bank',
        failed_at: new Date(),
        metadata: {
          bankErrorCode: stkResponse.ResponseCode,
          bankErrorDescription: stkResponse.ResponseDescription,
          diagnosticInfo,
        },
      }).catch((err: any) => console.error('[API] Failed to update transaction status:', err));

      return NextResponse.json(
        {
          success: false,
          error: userFriendlyError,
          responseCode: stkResponse.ResponseCode,
          diagnostic: process.env.NODE_ENV === 'development' ? diagnosticInfo : undefined,
        },
        { status: 400 }
      );
    }

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
