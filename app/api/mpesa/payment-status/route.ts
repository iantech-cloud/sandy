// app/api/mpesa/payment-status/route.ts
/**
 * DEPRECATED: This route is kept for backward compatibility only.
 * New code should use checkMpesaPaymentStatus from @/app/actions/deposit
 * or checkSpinDepositMpesaStatus from @/app/actions/spin
 * 
 * Both actions use the Co-op Bank service internally, NOT the old Safaricom M-Pesa API.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, MpesaTransaction, Transaction, Profile } from '@/app/lib/models';
import { createMpesaDarajaService } from '@/app/lib/services/mpesa-daraja';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `mpesa:status:${(session?.user as any)?.id ?? ip}`;
    const { exceeded, resetTime } = rateLimit(key, API_RATE_LIMITS.mpesa.limit, API_RATE_LIMITS.mpesa.windowMs);
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many status checks. Please wait.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
      });
    }

    const { checkoutRequestId, messageReference } = await request.json();

    // Support both old checkoutRequestId and new messageReference parameter names
    const transactionRef = messageReference || checkoutRequestId;

    if (!transactionRef) {
      return NextResponse.json(
        {
          success: false,
          message: 'messageReference or checkoutRequestId is required',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    console.log('[api/mpesa/payment-status] Checking payment status for:', { transactionRef });

    // Find the MpesaTransaction record
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: transactionRef,
    });

    if (!mpesaTransaction) {
      console.log('[api/mpesa/payment-status] M-Pesa transaction not found:', transactionRef);
      return NextResponse.json(
        { success: false, message: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('[api/mpesa/payment-status] Found M-Pesa transaction:', {
      status: mpesaTransaction.status,
      source: mpesaTransaction.source,
    });

    // Terminal statuses - return immediately from database
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status)) {
      return NextResponse.json({
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code,
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          source: 'database',
        },
      });
    }

    // For non-terminal statuses, query Co-op Bank Enquiry API
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(transactionRef);

      const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

      // Update database with the latest status from Co-op Bank
      if (terminalStatuses.includes(mappedStatus)) {
        await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
          status: mappedStatus,
          result_desc: statusResponse.ResponseDescription || '',
          ...(mappedStatus === 'completed'
            ? { completed_at: new Date() }
            : { failed_at: new Date() }),
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          status: mappedStatus,
          resultCode: statusResponse.ResponseCode,
          resultDesc: statusResponse.ResponseDescription,
          source: 'coop_bank_api',
        },
      });
    } catch (error) {
      console.error('[api/mpesa/payment-status] Co-op Bank query error:', error);

      // Fall back to database status if API fails
      return NextResponse.json({
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code,
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          source: 'database_fallback',
        },
      });
    }
  } catch (error) {
    console.error('[api/mpesa/payment-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to check payment status',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for debugging (development only)
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, message: 'Method not allowed in production' },
      { status: 405 }
    );
  }

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const checkoutRequestId = searchParams.get('checkoutRequestId') || searchParams.get('messageReference');
    const userId = searchParams.get('userId');

    if (checkoutRequestId) {
      // Get detailed status for a specific transaction
      const mpesaTransaction = await MpesaTransaction.findOne({
        checkout_request_id: checkoutRequestId,
      });

      if (!mpesaTransaction) {
        return NextResponse.json(
          { success: false, message: 'M-Pesa transaction not found' },
          { status: 404 }
        );
      }

      const transaction = await Transaction.findOne({
        mpesa_transaction_id: mpesaTransaction._id,
      });

      const user = await Profile.findById(mpesaTransaction.user_id);

      return NextResponse.json({
        success: true,
        data: {
          mpesaTransaction: {
            _id: mpesaTransaction._id,
            status: mpesaTransaction.status,
            result_code: mpesaTransaction.result_code,
            result_desc: mpesaTransaction.result_desc,
            source: mpesaTransaction.source,
            created_at: mpesaTransaction.created_at,
          },
          transaction: transaction
            ? {
                _id: transaction._id,
                type: transaction.type,
                status: transaction.status,
                metadata: transaction.metadata,
              }
            : null,
          user: user
            ? {
                _id: user._id,
                email: user.email,
                status: user.status,
              }
            : null,
        },
      });
    } else if (userId) {
      // Get user's recent payment attempts
      const mpesaTransactions = await MpesaTransaction.find({
        user_id: userId,
      })
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      const transactions = await Transaction.find({
        user_id: userId,
        type: { $in: ['DEPOSIT', 'SPIN_WALLET_DEPOSIT'] },
      })
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      return NextResponse.json({
        success: true,
        data: {
          mpesaTransactions,
          transactions,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'checkoutRequestId or userId parameter required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[api/mpesa/payment-status] Debug error:', error);
    return NextResponse.json({ success: false, message: 'Debug failed' }, { status: 500 });
  }
}
