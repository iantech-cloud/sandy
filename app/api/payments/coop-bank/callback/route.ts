// app/api/payments/coop-bank/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase,
  MpesaTransaction,
  Profile,
  ActivationPayment,
  SpinWallet,
  Transaction,
  ChatForeignersMpesaTransaction,
} from '@/app/lib/models';
import { CoopBankService } from '@/app/lib/services/coop-bank';
import mongoose from 'mongoose';
import { completeActivationAfterPayment } from '@/app/actions/activation';
import { completeBotUnlockPayment, completeWalletDeposit } from '@/app/actions/chat-foreigners/payments';

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

// NOTE: Use CoopBankService.mapResponseCode() for status mapping
// This is the single source of truth for response code mappings

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

    // Use service mapping for consistency across all payment flows
    const paymentStatus = CoopBankService.mapResponseCode(callbackData.ResponseCode);
    
    console.log('[CoopCallback] Status mapped:', {
      responseCode: callbackData.ResponseCode,
      mappedStatus: paymentStatus,
    });
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
    // SPIN WALLET DEPOSIT
    // ========================================================================
    // Money is deposited to the USER's spin wallet balance, NOT company.
    // Company revenue is only recorded when the user actually spins.
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

          // Credit the deposited amount to user's spin wallet balance
          spinWallet.balance_cents = (spinWallet.balance_cents || 0) + mpesaTransaction.amount_cents;
          spinWallet.total_deposited_cents =
            (spinWallet.total_deposited_cents || 0) + mpesaTransaction.amount_cents;

          console.log(
            `[CoopCallback] SpinWallet: +KES ${mpesaTransaction.amount_cents / 100} credited to user ${mpesaTransaction.user_id}. Balance now: KES ${spinWallet.balance_cents / 100}`
          );

          // Mark the deposit Transaction record as completed
          await (Transaction as any).findOneAndUpdate(
            {
              mpesa_transaction_id: mpesaTransaction._id,
              type: 'SPIN_WALLET_DEPOSIT',
            },
            { status: 'completed' },
            { session }
          );
        } else {
          // Failed / cancelled / timeout
          if (existingDeposit) {
            existingDeposit.status = paymentStatus;
            existingDeposit.overall_status = paymentStatus;
            existingDeposit.mpesa_status = paymentStatus;
          }

          // Mark the deposit Transaction record as failed
          await (Transaction as any).findOneAndUpdate(
            {
              mpesa_transaction_id: mpesaTransaction._id,
              type: 'SPIN_WALLET_DEPOSIT',
            },
            { status: paymentStatus },
            { session }
          );
        }

        await spinWallet.save({ session });
      }

      // DO NOT record company revenue on deposit - revenue is only recorded when user spins
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
          // ── DECOUPLE PAYMENT FROM ACTIVATION ─────────────────────────────
          // Payment success != account activation. We commit the payment as
          // SUCCESS immediately (ActivationPayment.status = 'completed',
          // processed_by_system stays false) and return to the bank in well
          // under a second. The heavy activation work (referral bonuses,
          // company revenue, emails, audit logs) runs in the background.
          // If the background run is interrupted (process restart, crash,
          // traffic spike), the recovery job at
          // /api/payments/coop-bank/recover finds this paid-but-not-activated
          // record and completes it. The user NEVER loses access.
          await session.commitTransaction();
          session = null;

          const activationPaymentId = activationPayment._id.toString();

          // Fire-and-forget: do NOT block the callback response on activation.
          // completeActivationAfterPayment is idempotent (it no-ops if the
          // account is already active), so the recovery job is safe to re-run.
          void completeActivationAfterPayment(activationPaymentId).catch(
            (activationError) => {
              console.error(
                '[CoopCallback] Background activation error (recovery job will retry):',
                activationPaymentId,
                activationError
              );
            }
          );

          return NextResponse.json({
            success: true,
            data: { status: paymentStatus, messageReference, activation: 'pending' },
            message: 'Payment confirmed. Activation is being processed.',
          });
        }
      }
    }

    // ========================================================================
    // CHAT FOREIGNERS BOT UNLOCK
    // ========================================================================
    const chatForeignersUnlock = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
      transaction_type: 'chat_foreigners_unlock',
    }).session(session);

    if (chatForeignersUnlock && paymentStatus === 'completed') {
      try {
        // Commit session before calling server action
        await session.commitTransaction();
        session = null;

        await completeBotUnlockPayment(chatForeignersUnlock._id.toString());

        return NextResponse.json({
          success: true,
          data: { status: paymentStatus, messageReference },
          message: 'Chat foreigners unlock payment processed',
        });
      } catch (chatError) {
        console.error('[CoopCallback] Chat foreigners unlock error:', chatError);
        return NextResponse.json(
          {
            success: false,
            error: chatError instanceof Error ? chatError.message : 'Failed to process chat unlock',
          },
          { status: 500 }
        );
      }
    }

    // ========================================================================
    // CHAT FOREIGNERS WALLET DEPOSIT
    // ========================================================================
    const chatForeignersDeposit = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
      transaction_type: 'chat_foreigners_deposit',
    }).session(session);

    if (chatForeignersDeposit && paymentStatus === 'completed') {
      try {
        await completeWalletDeposit(chatForeignersDeposit._id.toString(), session);
      } catch (chatDepositError) {
        console.error('[CoopCallback] Chat foreigners deposit error:', chatDepositError);
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
