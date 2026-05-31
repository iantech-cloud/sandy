// app/api/payments/coop-bank/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase,
  MpesaTransaction,
  Profile,
  ActivationPayment,
  SpinWallet,
  Transaction,
} from '@/app/lib/models';
import mongoose from 'mongoose';
import { completeActivationAfterPayment } from '@/app/actions/activation';

// ---------------------------------------------------------------------------
// Co-op Bank Callback payload shape
// ResponseCode '0' === success (mirrors the STK Push response format)
// ---------------------------------------------------------------------------
interface CoopBankCallback {
  MessageReference: string;
  OperatorTxnID?: string;
  ConversationID?: string;
  ResponseCode: string;
  ResponseDescription: string;
  ResultCode?: number;
  ResultDesc?: string;
  Amount?: number;
  PhoneNumber?: string;
  TransactionDate?: string;
  ReceiptNumber?: string;
  [key: string]: unknown;
}

/**
 * Map a Co-op Bank ResponseCode to our internal status enum.
 */
function mapResponseCode(
  responseCode: string
): 'completed' | 'failed' | 'cancelled' | 'timeout' {
  switch (responseCode) {
    case '0':
      return 'completed';
    case '2002':
      return 'cancelled';
    case '2001':
      return 'timeout';
    default:
      return 'failed';
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/coop-bank/callback
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let session: mongoose.ClientSession | null = null;
  const callbackReceivedAt = new Date();

  try {
    await connectToDatabase();

    const body = await request.json();
    console.log('[CoopCallback] Received at', callbackReceivedAt.toISOString(), JSON.stringify(body));

    const callbackData: CoopBankCallback = body;

    const messageReference = callbackData.MessageReference;
    if (!messageReference) {
      console.error('[CoopCallback] Missing MessageReference in callback body');
      return NextResponse.json({ success: false, error: 'Missing MessageReference' }, { status: 400 });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // Look up the transaction by the message reference we stored as checkout_request_id
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: messageReference,
    }).session(session);

    if (!mpesaTransaction) {
      console.error('[CoopCallback] Transaction not found for reference:', messageReference);
      await session.abortTransaction();
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    // ── Idempotency guard ──────────────────────────────────────────────────
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (
      terminalStatuses.includes(mpesaTransaction.status) &&
      mpesaTransaction.metadata?.callback_processed
    ) {
      console.log('[CoopCallback] Already processed — skipping duplicate callback');
      await session.abortTransaction();
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const paymentStatus = mapResponseCode(callbackData.ResponseCode);
    const receiptNumber =
      callbackData.ReceiptNumber ||
      callbackData.OperatorTxnID ||
      mpesaTransaction.merchant_request_id ||
      null;

    // ── Update MpesaTransaction ─────────────────────────────────────────────
    mpesaTransaction.status = paymentStatus;
    mpesaTransaction.result_code = parseInt(callbackData.ResponseCode || '1', 10);
    mpesaTransaction.result_desc =
      callbackData.ResponseDescription || callbackData.ResultDesc || '';
    mpesaTransaction.callback_payload = body;
    mpesaTransaction.callback_received_at = callbackReceivedAt;
    mpesaTransaction.metadata = {
      ...(mpesaTransaction.metadata || {}),
      callback_processed: true,
      callback_processed_at: callbackReceivedAt.toISOString(),
      callback_received_from_coop_bank: true,
    };

    if (paymentStatus === 'completed') {
      mpesaTransaction.completed_at = new Date();
      mpesaTransaction.mpesa_receipt_number = receiptNumber;
      if (callbackData.PhoneNumber) {
        mpesaTransaction.phone_number = callbackData.PhoneNumber;
      }
      mpesaTransaction.transaction_date = callbackData.TransactionDate;
    } else {
      mpesaTransaction.failed_at = new Date();
      mpesaTransaction.failure_reason =
        callbackData.ResponseDescription || callbackData.ResultDesc || '';
    }

    await mpesaTransaction.save({ session });

    const depositType: string = mpesaTransaction.metadata?.deposit_type || 'unknown';

    console.log('[CoopCallback] depositType:', depositType, '| status:', paymentStatus);

    // ========================================================================
    // SPIN WALLET PAYMENT
    // ========================================================================
    // Money goes to the COMPANY wallet as SPIN_COST revenue.
    // The user receives one spin credit per KES 30 paid.
    // The SpinWallet.balance_cents is NOT touched here.
    // ========================================================================
    if (depositType === 'spin_wallet') {
      // Update the embedded deposit record in SpinWallet
      const spinWallet = await (SpinWallet as any)
        .findOne({ user_id: mpesaTransaction.user_id })
        .session(session);

      if (spinWallet) {
        const existingDeposit = spinWallet.deposits.find(
          (d: any) => d.mpesa_checkout_request_id === messageReference
        );

        if (paymentStatus === 'completed') {
          const spinCreditsEarned = Math.floor(mpesaTransaction.amount_cents / 3000); // 3000 cents = KES 30

          if (existingDeposit && existingDeposit.status !== 'completed') {
            existingDeposit.status = 'completed';
            existingDeposit.overall_status = 'completed';
            existingDeposit.mpesa_status = 'completed';
            existingDeposit.mpesa_receipt_number = receiptNumber;
            existingDeposit.deposited_at = new Date();
          } else if (!existingDeposit) {
            spinWallet.deposits.push({
              amount_cents: mpesaTransaction.amount_cents,
              mpesa_checkout_request_id: messageReference,
              mpesa_transaction_id: mpesaTransaction._id,
              mpesa_receipt_number: receiptNumber,
              mpesa_status: 'completed',
              overall_status: 'completed',
              status: 'completed',
              phone_number: mpesaTransaction.phone_number,
              deposited_at: new Date(),
              created_at: new Date(),
            });
          }

          // Add spin credits to the wallet (not balance_cents)
          spinWallet.spin_credits = (spinWallet.spin_credits || 0) + spinCreditsEarned;
          // Track total deposited for reporting, but this is company revenue
          spinWallet.total_deposited_cents =
            (spinWallet.total_deposited_cents || 0) + mpesaTransaction.amount_cents;

          console.log(
            `[CoopCallback] SpinWallet: +${spinCreditsEarned} spin credits for user ${mpesaTransaction.user_id}. Money goes to company.`
          );
        } else {
          // Failed / cancelled / timeout
          if (existingDeposit) {
            existingDeposit.status = paymentStatus;
            existingDeposit.overall_status = paymentStatus;
            existingDeposit.mpesa_status = paymentStatus;
          }
        }

        await spinWallet.save({ session });
      }

      // Record as COMPANY revenue — SPIN_COST
      if (paymentStatus === 'completed') {
        await (Transaction as any).create(
          [
            {
              user_id: mpesaTransaction.user_id,
              target_type: 'company',
              type: 'SPIN_COST',
              amount_cents: mpesaTransaction.amount_cents,
              status: 'completed',
              source: 'coop_bank_stk_push',
              description: `Spin wallet deposit - KES ${mpesaTransaction.amount_cents / 100} (user: ${mpesaTransaction.user_id})`,
              metadata: {
                message_reference: messageReference,
                receipt_number: receiptNumber,
                phone_number: mpesaTransaction.phone_number,
                deposit_type: 'spin_wallet',
                revenue_target: 'company',
                payment_method: 'coop_bank_stk_push',
              },
            },
          ],
          { session }
        );
      }
    }

    // ========================================================================
    // WALLET DEPOSIT (user wallet top-up)
    // ========================================================================
    if (depositType === 'wallet' && paymentStatus === 'completed') {
      const user = await Profile.findById(mpesaTransaction.user_id).session(session);
      if (user) {
        user.balance_cents = (user.balance_cents || 0) + mpesaTransaction.amount_cents;
        await user.save({ session });

        // Update the pending Transaction record to completed
        await (Transaction as any).findOneAndUpdate(
          {
            mpesa_transaction_id: mpesaTransaction._id,
            type: 'DEPOSIT',
          },
          { status: 'completed' },
          { session }
        );

        console.log(
          `[CoopCallback] User wallet credited: +KES ${mpesaTransaction.amount_cents / 100} (user: ${mpesaTransaction.user_id})`
        );
      }
    }

    // ========================================================================
    // ACTIVATION PAYMENT
    // ========================================================================
    if (depositType === 'activation' || mpesaTransaction.is_activation_payment) {
      const activationPayment = await ActivationPayment.findOne({
        $or: [
          { checkout_request_id: messageReference },
          { mpesa_transaction_id: mpesaTransaction._id },
        ],
      }).session(session);

      if (activationPayment) {
        if (paymentStatus === 'completed') {
          activationPayment.status = 'completed';
          activationPayment.paid_at = new Date();
          activationPayment.mpesa_receipt_number = receiptNumber;
          activationPayment.mpesa_transaction_id = mpesaTransaction._id;
        } else {
          activationPayment.status = 'failed';
          activationPayment.error_message =
            callbackData.ResponseDescription || 'Payment failed';
        }
        await activationPayment.save({ session });

        if (paymentStatus === 'completed') {
          // Commit before running server action (which opens its own DB session)
          await session.commitTransaction();
          session = null;

          try {
            await completeActivationAfterPayment(
              mpesaTransaction.user_id.toString(),
              activationPayment._id.toString()
            );
          } catch (activationError) {
            console.error('[CoopCallback] Activation completion error:', activationError);
          }

          return NextResponse.json({
            success: true,
            data: { status: paymentStatus, messageReference },
            message: 'Activation payment processed',
          });
        }
      }
    }

    await session.commitTransaction();

    console.log('[CoopCallback] Processing complete:', { messageReference, paymentStatus });

    return NextResponse.json({
      success: true,
      data: { status: paymentStatus, messageReference },
      message: 'Callback processed successfully',
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_) {}
    }
    console.error('[CoopCallback] Error:', error);
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
