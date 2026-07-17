import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase,
  MpesaTransaction,
  Profile,
  ActivationPayment,
  SpinWallet,
  GamingWallet,
  Transaction,
} from '@/app/lib/models';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';
import { invalidateCache } from '@/app/lib/db-cache';
import mongoose from 'mongoose';
import { completeActivationAfterPayment } from '@/app/actions/activation';

/**
 * M-Pesa Daraja callback payload structure.
 * Nested under Body.stkPopupResponse in production.
 */
interface MpesaCallback {
  Body: {
    stkPopupResponse: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResponseCode: string;
      ResponseDescription: string;
      ResultCode?: string;
      ResultDesc?: string;
      Amount?: number;
      MpesaReceiptNumber?: string;
      Balance?: number;
      TransactionDate?: string;
      [key: string]: any;
    };
  };
}

// ---------------------------------------------------------------------------
// POST /api/payments/mpesa/callback
// Receives STK Push result from M-Pesa Daraja API
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let session: mongoose.ClientSession | null = null;
  const callbackReceivedAt = new Date();

  try {
    await connectToDatabase();

    const body = await request.json();
    console.log('[MpesaCallback] Received at', callbackReceivedAt.toISOString());
    console.log('[MpesaCallback] Raw payload:', JSON.stringify(body, null, 2));

    // Extract nested response
    let callbackData = body;
    if (body.Body?.stkPopupResponse) {
      callbackData = body.Body.stkPopupResponse;
    }

    const checkoutRequestID = callbackData.CheckoutRequestID;
    if (!checkoutRequestID) {
      console.error('[MpesaCallback] Missing CheckoutRequestID');
      return NextResponse.json(
        { success: false, error: 'Missing CheckoutRequestID' },
        { status: 400 }
      );
    }

    // Find transaction by checkout_request_id (account reference from STK Push)
    const existingTransaction = await MpesaTransaction.findOne({
      $or: [
        { checkout_request_id: checkoutRequestID },
        { account_reference: checkoutRequestID }
      ]
    }).lean();

    if (!existingTransaction) {
      console.error('[MpesaCallback] Transaction not found:', checkoutRequestID);
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Idempotency guard: skip if already processed
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (
      terminalStatuses.includes(existingTransaction.status) &&
      existingTransaction.metadata?.callback_processed
    ) {
      console.log('[MpesaCallback] Already processed — skipping duplicate');
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Start transaction session
    session = await mongoose.startSession();
    session.startTransaction();

    // Re-fetch within transaction
    const mpesaTransaction = await MpesaTransaction.findOne({
      $or: [
        { checkout_request_id: checkoutRequestID },
        { account_reference: checkoutRequestID }
      ]
    }).session(session);

    if (!mpesaTransaction) {
      await session.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Map M-Pesa result code to local status
    const paymentStatus = MpesaDarajaService.mapResultCode(
      callbackData.ResultCode,
      callbackData.ResponseCode
    );

    // Get human-readable error message
    const userMessage = MpesaDarajaService.getErrorMessage(
      callbackData.ResponseCode,
      callbackData.ResultCode,
      callbackData.ResponseDescription || callbackData.ResultDesc
    );

    console.log('[MpesaCallback] Status mapped:', {
      responseCode: callbackData.ResponseCode,
      resultCode: callbackData.ResultCode,
      mappedStatus: paymentStatus,
      userMessage,
    });

    const receiptNumber = callbackData.MpesaReceiptNumber || null;

    // Update MpesaTransaction
    mpesaTransaction.status = paymentStatus;
    mpesaTransaction.result_code = parseInt(callbackData.ResultCode || callbackData.ResponseCode || '1', 10);
    mpesaTransaction.result_desc = userMessage;
    mpesaTransaction.callback_payload = body;
    mpesaTransaction.callback_received_at = callbackReceivedAt;
    mpesaTransaction.metadata = {
      ...(mpesaTransaction.metadata || {}),
      callback_processed: true,
      callback_processed_at: callbackReceivedAt.toISOString(),
      callback_received_from_mpesa: true,
      response_code: callbackData.ResponseCode,
      result_code: callbackData.ResultCode,
      user_message: userMessage,
    };

    if (paymentStatus === 'completed') {
      mpesaTransaction.completed_at = new Date();
      mpesaTransaction.mpesa_receipt_number = receiptNumber;
      mpesaTransaction.transaction_date = callbackData.TransactionDate;
      mpesaTransaction.metadata.transaction_completed_at = callbackData.TransactionDate;
    } else {
      mpesaTransaction.failed_at = new Date();
      mpesaTransaction.failure_reason = userMessage;
    }

    await mpesaTransaction.save({ session });

    // Link to Transaction record if payment completed
    if (paymentStatus === 'completed' && callbackData.MpesaReceiptNumber) {
      await (Transaction as any).findOneAndUpdate(
        { mpesa_transaction_id: mpesaTransaction._id },
        {
          $set: {
            transaction_code: callbackData.MpesaReceiptNumber,
            'metadata.mpesa_receipt_number': receiptNumber,
          }
        },
        { session }
      );
    }

    const depositType: string = mpesaTransaction.metadata?.deposit_type || 'unknown';

    console.log('[MpesaCallback] depositType:', depositType, '| status:', paymentStatus);

    // ========================================================================
    // SPIN WALLET DEPOSIT
    // ========================================================================
    if (depositType === 'spin_wallet') {
      if (paymentStatus === 'completed') {
        const spinWallet = await (SpinWallet as any)
          .findOne({ user_id: mpesaTransaction.user_id })
          .session(session);

        if (spinWallet) {
          const existingDeposit = spinWallet.deposits.find(
            (d: any) => d.mpesa_checkout_request_id === checkoutRequestID
          );

          if (existingDeposit && existingDeposit.status !== 'completed') {
            existingDeposit.status = 'completed';
            existingDeposit.overall_status = 'completed';
            existingDeposit.mpesa_status = 'completed';
            existingDeposit.mpesa_receipt_number = receiptNumber;
            existingDeposit.deposited_at = new Date();
          } else if (!existingDeposit) {
            spinWallet.deposits.push({
              mpesa_checkout_request_id: checkoutRequestID,
              amount_cents: mpesaTransaction.amount_cents,
              status: 'completed',
              overall_status: 'completed',
              mpesa_status: 'completed',
              mpesa_receipt_number: receiptNumber,
              initiated_at: mpesaTransaction.created_at,
              deposited_at: new Date(),
            });
          }

          await spinWallet.save({ session });
        }
      }
    }

    // ========================================================================
    // ACTIVATION PAYMENT
    // ========================================================================
    if (depositType === 'activation') {
      if (paymentStatus === 'completed') {
        const updated = await (MpesaTransaction as any).findOneAndUpdate(
          { _id: mpesaTransaction._id, 'metadata.wallet_credited': { $ne: true } },
          { $set: { 'metadata.wallet_credited': true, 'metadata.callback_processed': true } },
          { new: false, session }
        );

        if (updated) {
          console.log('[MpesaCallback] Activation payment completed — crediting');

          await (ActivationPayment as any).findOneAndUpdate(
            { mpesa_transaction_id: mpesaTransaction._id },
            { status: 'completed', completed_at: new Date() },
            { session }
          );

          invalidateCache('activation');
        }
      }
    }

    // ========================================================================
    // CHAT FOREIGNERS WALLET DEPOSIT
    // ========================================================================
    if (depositType === 'wallet') {
      if (paymentStatus === 'completed') {
        const updated = await (MpesaTransaction as any).findOneAndUpdate(
          { _id: mpesaTransaction._id, 'metadata.wallet_credited': { $ne: true } },
          { $set: { 'metadata.wallet_credited': true, 'metadata.callback_processed': true } },
          { new: false, session }
        );

        if (updated) {
          console.log('[MpesaCallback] Chat foreigners wallet credited: +KES', mpesaTransaction.amount_cents / 100);

          await (Profile as any).findByIdAndUpdate(
            mpesaTransaction.user_id,
            {
              $inc: { 'wallet.balance_cents': mpesaTransaction.amount_cents },
              $set: { 'wallet.last_updated': new Date() },
            },
            { session }
          );

          invalidateCache('wallet');
        }
      }
    }

    // ========================================================================
    // GAMING WALLET DEPOSIT
    // ========================================================================
    if (depositType === 'gaming') {
      if (paymentStatus === 'completed') {
        const updated = await (MpesaTransaction as any).findOneAndUpdate(
          { _id: mpesaTransaction._id, 'metadata.wallet_credited': { $ne: true } },
          { $set: { 'metadata.wallet_credited': true, 'metadata.callback_processed': true } },
          { new: false, session }
        );

        if (updated) {
          console.log('[MpesaCallback] Gaming wallet credited: +KES', mpesaTransaction.amount_cents / 100);

          await (GamingWallet as any).findOneAndUpdate(
            { user_id: mpesaTransaction.user_id },
            {
              $inc: { balance_cents: mpesaTransaction.amount_cents },
              $set: { last_transaction_at: new Date() },
              $setOnInsert: {
                user_id: mpesaTransaction.user_id,
                created_at: new Date(),
              }
            },
            { upsert: true, session, new: false }
          );

          invalidateCache('wallet');
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log('[MpesaCallback] Successfully processed:', {
      checkoutRequestID,
      status: paymentStatus,
      userId: mpesaTransaction.user_id,
    });

    return NextResponse.json({
      success: true,
      data: { status: paymentStatus, checkoutRequestID },
      message: 'M-Pesa callback processed successfully',
    });

  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (e) {
        console.error('[MpesaCallback] Error aborting transaction:', e);
      }
      session.endSession();
    }

    console.error('[MpesaCallback] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process callback',
      },
      { status: 500 }
    );
  }
}
