import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, MpesaTransaction } from '@/app/lib/models';
import { createMpesaDarajaService, MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/mpesa/stk-push
 * Initiates an STK push payment via Safaricom M-Pesa Daraja API
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
    const formattedPhone = MpesaDarajaService.normalisePhone(phoneNumber);

    // Validate: must be 254 followed by exactly 9 digits
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
    let prefix: string;
    if (depositType === 'activation') {
      prefix = 'ACT';
    } else if (depositType === 'wallet') {
      prefix = 'CHAT';
    } else if (depositType === 'spin_wallet') {
      prefix = 'SPINDY';
    } else if (depositType === 'gaming') {
      prefix = 'CAS';
    } else {
      prefix = 'CHAT';
    }

    // Generate account reference (used for callback lookup)
    const accountReference = `${prefix}_${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create M-Pesa Daraja service
    const mpesaDaraja = createMpesaDarajaService();

    // Callback URL for payment confirmation
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/mpesa/callback`;

    // Map depositType to valid source enum values
    const sourceMap: { [key: string]: string } = {
      'activation': 'activation',
      'wallet': 'wallet',
      'spin_wallet': 'spin_wallet',
      'gaming': 'gaming',
      'deposit': 'wallet',
    };
    const source = sourceMap[depositType] || 'wallet';

    // Persist transaction BEFORE calling M-Pesa API (same as Co-op Bank pattern)
    const mpesaTransaction = await MpesaTransaction.create({
      user_id: userId,
      amount_cents: Math.round(amount * 100),
      phone_number: formattedPhone,
      account_reference: accountReference,
      transaction_desc: narration,
      status: 'initiated',
      source: source,
      checkout_request_id: accountReference,
      is_activation_payment: depositType === 'activation',
      metadata: {
        deposit_type: depositType,
        payment_method: 'mpesa_daraja_stk_push',
        provider: 'safaricom',
        revenue_target: depositType === 'spin_wallet' ? 'company' : 'user',
        initiated_at: new Date().toISOString(),
      },
    });

    console.log('[API] Calling M-Pesa STK Push with:', {
      phone: formattedPhone,
      amount,
      narration,
      accountReference,
      transactionId: mpesaTransaction._id.toString(),
    });

    let stkResponse;
    try {
      stkResponse = await mpesaDaraja.initiateSTKPush(
        formattedPhone,
        amount,
        narration,
        callbackUrl,
        accountReference
      );
      console.log('[API] M-Pesa STK Push response:', stkResponse);
    } catch (error) {
      console.error('[API] M-Pesa STK Push failed:', error);
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: error instanceof Error ? error.message : 'STK Push request failed',
        failed_at: new Date(),
      });
      throw error;
    }

    // M-Pesa returns ResponseCode "0" for success
    if (stkResponse.ResponseCode !== '0') {
      console.warn('[API] M-Pesa STK Push rejected:', {
        responseCode: stkResponse.ResponseCode,
        description: stkResponse.ResponseDescription,
      });

      let userFriendlyError = stkResponse.ResponseDescription || 'STK Push rejected by M-Pesa';
      let diagnosticInfo: { [key: string]: any } = {};

      if (stkResponse.ResponseCode === '400') {
        userFriendlyError = 'Invalid request. Please check your details and try again.';
        diagnosticInfo = {
          issue: 'INVALID_REQUEST',
          code: '400',
          cause: 'Invalid request parameters',
          action: 'Verify phone number and amount',
        };
      } else if (stkResponse.ResponseCode === '401') {
        userFriendlyError = 'Authentication failed. Please contact support.';
        diagnosticInfo = {
          issue: 'AUTHENTICATION_ERROR',
          code: '401',
          cause: 'M-Pesa API authentication failed',
          action: 'Check API credentials',
        };
      } else if (stkResponse.ResponseCode === '500') {
        userFriendlyError = 'M-Pesa system error. Please try again.';
        diagnosticInfo = {
          issue: 'SERVER_ERROR',
          code: '500',
          cause: 'M-Pesa server error',
          action: 'Retry the payment',
        };
      }

      console.error('[API] M-Pesa STK Push Error:', {
        ...diagnosticInfo,
        phoneNumber: formattedPhone,
        amount,
      });

      // Mark transaction as failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_code: parseInt(stkResponse.ResponseCode || '1', 10) || 1,
        result_desc: stkResponse.ResponseDescription || 'STK Push rejected',
        failed_at: new Date(),
        metadata: {
          mpesaErrorCode: stkResponse.ResponseCode,
          mpesaErrorDescription: stkResponse.ResponseDescription,
        },
      }).catch((err: any) => console.error('[API] Failed to update transaction:', err));

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

    console.log('[API] M-Pesa STK Push initiated:', {
      userId,
      amount,
      accountReference,
      checkoutRequestID: stkResponse.CheckoutRequestID,
      transactionId: mpesaTransaction._id,
    });

    // Update transaction with CheckoutRequestID from M-Pesa
    await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
      'metadata.checkout_request_id': stkResponse.CheckoutRequestID,
      'metadata.merchant_request_id': stkResponse.MerchantRequestID,
    });

    return NextResponse.json({
      success: true,
      data: {
        accountReference,
        checkoutRequestID: stkResponse.CheckoutRequestID,
        transactionId: mpesaTransaction._id.toString(),
        amount,
        phoneNumber: formattedPhone,
      },
      message: stkResponse.ResponseDescription || 'STK Push initiated. Please check your phone to complete the payment.',
    });
  } catch (error) {
    console.error('[API] M-Pesa STK Push error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate payment',
      },
      { status: 500 }
    );
  }
}
