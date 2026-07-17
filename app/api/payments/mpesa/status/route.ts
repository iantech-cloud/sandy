import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, MpesaTransaction } from '@/app/lib/models';
import { createMpesaDarajaService, MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/mpesa/status
 * Query the current status of an M-Pesa STK Push transaction
 * 
 * Body:
 * {
 *   "checkoutRequestID": "..."  // CheckoutRequestID from STK Push response
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { checkoutRequestID } = body;

    if (!checkoutRequestID) {
      return NextResponse.json(
        { success: false, error: 'Missing checkoutRequestID' },
        { status: 400 }
      );
    }

    console.log('[MpesaStatus] Checking status for:', checkoutRequestID);

    // Find transaction
    const transaction = await MpesaTransaction.findOne({
      $or: [
        { checkout_request_id: checkoutRequestID },
        { account_reference: checkoutRequestID }
      ]
    });

    if (!transaction) {
      console.error('[MpesaStatus] Transaction not found:', checkoutRequestID);
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Terminal state — return immediately without API call
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(transaction.status)) {
      console.log('[MpesaStatus] Terminal status found:', transaction.status);
      return NextResponse.json({
        success: true,
        data: {
          status: transaction.status,
          resultCode: transaction.result_code,
          resultDesc: transaction.result_desc,
          mpesaReceiptNumber: transaction.mpesa_receipt_number,
          amount: transaction.amount_cents,
          completedAt: transaction.completed_at,
          failedAt: transaction.failed_at,
          source: 'database',
        },
        message: `Payment status: ${transaction.status}`,
      });
    }

    // Already credited (callback or poll completed) — return cached status
    if (transaction.metadata?.wallet_credited === true) {
      return NextResponse.json({
        success: true,
        data: {
          status: transaction.status,
          source: 'callback_processed',
        },
        message: `Payment ${transaction.status}`,
      });
    }

    // Optimization: Skip API call if checked recently (< 10 seconds)
    const lastCheck = transaction.metadata?.last_api_check
      ? new Date(transaction.metadata.last_api_check)
      : null;
    const timeSinceLastCheck = lastCheck ? (Date.now() - lastCheck.getTime()) / 1000 : Infinity;
    const shouldSkipApiCall = timeSinceLastCheck < 10;

    if (shouldSkipApiCall && transaction.status === 'pending') {
      console.log('[MpesaStatus] Skipping API call (checked', timeSinceLastCheck, 's ago)');
      return NextResponse.json({
        success: true,
        data: {
          status: 'pending',
          source: 'database_cached',
        },
        message: 'Payment is still being processed. Please wait...',
      });
    }

    // Query M-Pesa API
    console.log('[MpesaStatus] Querying M-Pesa API...');

    const mpesaDaraja = createMpesaDarajaService();
    const statusResponse = await mpesaDaraja.queryTransactionStatus(checkoutRequestID);

    console.log('[MpesaStatus] API response:', statusResponse);

    // Map result code to local status
    const mappedStatus = MpesaDarajaService.mapResultCode(
      statusResponse.ResultCode,
      statusResponse.ResponseCode
    );

    console.log('[MpesaStatus] Mapped status:', mappedStatus);

    // Persist status update
    const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
    const safeResultCode = isNaN(resultCode) ? 1 : resultCode;

    await (MpesaTransaction as any).findByIdAndUpdate(transaction._id, {
      status: mappedStatus,
      result_code: safeResultCode,
      result_desc: statusResponse.ResponseDescription || '',
      ...(mappedStatus === 'completed' ? { completed_at: new Date() } : {}),
      ...((['failed', 'cancelled', 'timeout'].includes(mappedStatus)) ? { failed_at: new Date() } : {}),
      'metadata.last_api_check': new Date(),
    });

    // If completed via poll (callback missed), credit wallet directly
    if (mappedStatus === 'completed') {
      console.log('[MpesaStatus] Deposit completed from poll — checking wallet credit');

      // Use atomic guard to prevent double-credit
      const updated = await (MpesaTransaction as any).findOneAndUpdate(
        { _id: transaction._id, 'metadata.wallet_credited': { $ne: true } },
        { $set: { 'metadata.wallet_credited': true } },
        { new: false }
      );

      if (updated) {
        // Only credit if this update won the race
        const { GamingWallet } = await import('@/app/lib/models');
        const { invalidateCache } = await import('@/app/lib/db-cache');

        console.log('[MpesaStatus] Crediting wallet from poll');

        const depositType = transaction.metadata?.deposit_type || 'unknown';

        // Credit the appropriate wallet based on deposit type
        if (depositType === 'gaming') {
          await (GamingWallet as any).findOneAndUpdate(
            { user_id: transaction.user_id },
            {
              $inc: { balance_cents: transaction.amount_cents },
              $set: { last_transaction_at: new Date() },
              $setOnInsert: {
                user_id: transaction.user_id,
                created_at: new Date(),
              }
            },
            { upsert: true, new: false }
          );
        } else if (depositType === 'wallet') {
          const { Profile } = await import('@/app/lib/models');
          await (Profile as any).findByIdAndUpdate(
            transaction.user_id,
            {
              $inc: { 'wallet.balance_cents': transaction.amount_cents },
              $set: { 'wallet.last_updated': new Date() },
            }
          );
        }

        invalidateCache('wallet');

        console.log(
          `[MpesaStatus] Wallet credited from poll: +KES ${transaction.amount_cents / 100} (user: ${transaction.user_id})`
        );
      } else {
        console.log('[MpesaStatus] Wallet already credited (race lost)');
      }
    }

    // Build user-friendly message
    let userMessage = `Payment status: ${mappedStatus}`;
    if (mappedStatus === 'completed') {
      userMessage = 'Payment successful! Your balance has been updated.';
    } else if (mappedStatus === 'failed') {
      userMessage = `Payment failed: ${statusResponse.ResponseDescription || 'Transaction could not be processed'}`;
    } else if (mappedStatus === 'timeout') {
      userMessage = 'Payment timeout: No response from M-Pesa. Please check your M-Pesa history.';
    } else if (mappedStatus === 'cancelled') {
      userMessage = 'Payment cancelled: You cancelled the M-Pesa prompt.';
    } else if (mappedStatus === 'pending') {
      userMessage = 'Payment is still being processed. Please wait...';
    }

    return NextResponse.json({
      success: true,
      data: {
        status: mappedStatus,
        resultCode: statusResponse.ResponseCode,
        resultDesc: statusResponse.ResponseDescription || '',
        source: 'mpesa_api',
      },
      message: userMessage,
    });

  } catch (error) {
    console.error('[MpesaStatus] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check payment status',
      },
      { status: 500 }
    );
  }
}
