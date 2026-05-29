'use server';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, MpesaTransaction, Profile, ActivationPayment, SpinWallet } from '@/app/lib/models';
import mongoose from 'mongoose';

interface CoopBankCallback {
  messageReference: string;
  operatorTxnID: string;
  conversationID: string;
  responseCode: string;
  responseDescription: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  phoneNumber?: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  status?: string;
  [key: string]: any;
}

/**
 * POST /api/payments/coop-bank/callback
 * Handles payment confirmation callbacks from Co-operative Bank
 */
export async function POST(request: NextRequest) {
  let session: mongoose.ClientSession | null = null;
  const callbackReceivedAt = new Date();

  try {
    await connectToDatabase();

    const body = await request.json();
    console.log('[Callback] Co-op Bank Payment Callback Received:', {
      timestamp: callbackReceivedAt.toISOString(),
      messageReference: body.messageReference,
      responseCode: body.responseCode,
    });

    const callbackData: CoopBankCallback = body;

    // Start transaction for data consistency
    session = await mongoose.startSession();
    session.startTransaction();

    // Find M-Pesa transaction by message reference (checkout_request_id)
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: callbackData.messageReference,
    }).session(session);

    if (!mpesaTransaction) {
      console.error('[Callback] Transaction not found:', callbackData.messageReference);
      await session.abortTransaction();

      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('[Callback] Found transaction:', {
      transactionId: mpesaTransaction._id,
      userId: mpesaTransaction.user_id,
      currentStatus: mpesaTransaction.status,
    });

    // Idempotency guard - prevent duplicate processing
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status) && mpesaTransaction.metadata?.callback_processed) {
      console.log('[Callback] Transaction already processed, skipping');
      await session.abortTransaction();

      return NextResponse.json({
        success: true,
        message: 'Callback already processed',
      });
    }

    // Determine payment status based on response code
    let paymentStatus: 'completed' | 'failed' | 'cancelled' | 'timeout' = 'failed';
    let mpesaReceiptNumber: string | null = null;

    // Success codes from Co-op Bank
    if (callbackData.responseCode === '0' || callbackData.resultCode === 0) {
      paymentStatus = 'completed';
      mpesaReceiptNumber = callbackData.mpesaReceiptNumber || callbackData.operatorTxnID;
    } else if (callbackData.responseCode === '2002' || callbackData.resultCode === 1032) {
      // User cancelled
      paymentStatus = 'cancelled';
    } else if (callbackData.responseCode === '2001' || callbackData.resultCode === 1037) {
      // Timeout
      paymentStatus = 'timeout';
    }

    // Update M-Pesa transaction
    mpesaTransaction.status = paymentStatus;
    mpesaTransaction.result_code = parseInt(callbackData.responseCode || '1');
    mpesaTransaction.result_desc = callbackData.responseDescription || callbackData.resultDesc || 'Payment processed';
    mpesaTransaction.callback_payload = body;
    mpesaTransaction.callback_received_at = callbackReceivedAt;

    if (paymentStatus === 'completed') {
      mpesaTransaction.completed_at = new Date();
      mpesaTransaction.mpesa_receipt_number = mpesaReceiptNumber;
      mpesaTransaction.phone_number = callbackData.phoneNumber || mpesaTransaction.phone_number;
      mpesaTransaction.transaction_date = callbackData.transactionDate;
    } else if (['failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
      mpesaTransaction.failed_at = new Date();
      mpesaTransaction.failure_reason = callbackData.responseDescription || callbackData.resultDesc;
    }

    // Mark callback as processed
    mpesaTransaction.metadata = {
      ...(mpesaTransaction.metadata || {}),
      callback_processed: true,
      callback_processed_at: callbackReceivedAt.toISOString(),
      callback_received_from_coop_bank: true,
    };

    await mpesaTransaction.save({ session });

    console.log('[Callback] Transaction updated:', {
      transactionId: mpesaTransaction._id,
      newStatus: paymentStatus,
    });

    // ========================================================================
    // 🎰 PAYMENT ROUTER — SPIN WALLET
    // ========================================================================
    if (mpesaTransaction.metadata?.deposit_type === 'spin_wallet') {
      let spinWallet = await SpinWallet.findOne({
        user_id: mpesaTransaction.user_id,
      }).session(session);

      if (!spinWallet) {
        const created = await SpinWallet.create(
          [
            {
              user_id: mpesaTransaction.user_id,
              balance_cents: 0,
              total_deposited_cents: 0,
              total_used_cents: 0,
              total_spins: 0,
              deposits: [],
            },
          ],
          { session }
        );
        spinWallet = created[0];
      }

      const existingDeposit = spinWallet.deposits.find(
        (d: any) => d.mpesa_checkout_request_id === callbackData.messageReference
      );

      if (paymentStatus === 'completed') {
        const alreadyCompleted = existingDeposit?.status === 'completed';
        if (!alreadyCompleted) {
          spinWallet.balance_cents += mpesaTransaction.amount_cents;
          spinWallet.total_deposited_cents += mpesaTransaction.amount_cents;

          if (existingDeposit) {
            existingDeposit.status = 'completed';
            existingDeposit.overall_status = 'completed';
            existingDeposit.mpesa_status = 'completed';
            existingDeposit.mpesa_receipt_number = mpesaReceiptNumber;
            existingDeposit.deposited_at = new Date();
          } else {
            spinWallet.deposits.push({
              amount_cents: mpesaTransaction.amount_cents,
              mpesa_checkout_request_id: callbackData.messageReference,
              mpesa_transaction_id: mpesaTransaction._id,
              mpesa_receipt_number: mpesaReceiptNumber,
              mpesa_status: 'completed',
              overall_status: 'completed',
              status: 'completed',
              phone_number: mpesaTransaction.phone_number,
              deposited_at: new Date(),
              created_at: new Date(),
            });
          }

          console.log('[Callback] SpinWallet credited:', {
            amount: mpesaTransaction.amount_cents / 100,
            userId: mpesaTransaction.user_id,
          });
        }
      }

      await spinWallet.save({ session });
    }

    // ========================================================================
    // 💼 WALLET DEPOSIT (Regular wallet top-up)
    // ========================================================================
    if (mpesaTransaction.metadata?.deposit_type === 'wallet' && paymentStatus === 'completed') {
      const user = await Profile.findById(mpesaTransaction.user_id).session(session);
      if (user) {
        user.balance_cents = (user.balance_cents || 0) + mpesaTransaction.amount_cents;
        await user.save({ session });

        console.log('[Callback] User wallet credited:', {
          amount: mpesaTransaction.amount_cents / 100,
          userId: mpesaTransaction.user_id,
          newBalance: user.balance_cents / 100,
        });
      }
    }

    // ========================================================================
    // 🎯 ACTIVATION PAYMENT
    // ========================================================================
    if (mpesaTransaction.metadata?.deposit_type === 'activation') {
      const activationPayment = await ActivationPayment.findOne({
        $or: [
          { checkout_request_id: callbackData.messageReference },
          { mpesa_transaction_id: mpesaTransaction._id },
        ],
      }).session(session);

      if (activationPayment) {
        if (paymentStatus === 'completed') {
          activationPayment.status = 'completed';
          activationPayment.paid_at = new Date();
          activationPayment.mpesa_receipt_number = mpesaReceiptNumber;
          activationPayment.mpesa_transaction_id = mpesaTransaction._id;

          console.log('[Callback] Activation payment completed');
        } else {
          activationPayment.status = 'failed';
          activationPayment.error_message = callbackData.responseDescription || 'Payment failed';

          console.log('[Callback] Activation payment failed');
        }

        await activationPayment.save({ session });

        // If activation payment is completed, mark user as activated
        if (paymentStatus === 'completed') {
          const user = await Profile.findById(mpesaTransaction.user_id).session(session);
          if (user && !user.is_account_activated) {
            user.is_account_activated = true;
            user.account_activated_at = new Date();
            await user.save({ session });

            console.log('[Callback] User account activated');
          }
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();

    console.log('[Callback] Payment processing completed successfully');

    return NextResponse.json({
      success: true,
      data: {
        transactionId: mpesaTransaction._id.toString(),
        status: paymentStatus,
        messageReference: callbackData.messageReference,
      },
      message: 'Payment callback processed successfully',
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error('[Callback] Error processing callback:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process callback',
      },
      { status: 500 }
    );
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
