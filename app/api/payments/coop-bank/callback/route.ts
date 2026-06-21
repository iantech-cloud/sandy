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
    console.log('[CoopCallback] Received at', callbackReceivedAt.toISOString());

    const callbackData: CoopBankCallback = body;

    const messageReference = callbackData.MessageReference;
    if (!messageReference) {
      console.error('[CoopCallback] Missing MessageReference in callback body');
      return NextResponse.json({ success: false, error: 'Missing MessageReference' }, { status: 400 });
    }

    // FIXED: Check idempotency BEFORE creating session (faster rejection of duplicates)
    // Look up the transaction WITHOUT session first for quick duplicate detection
    const existingTransaction = await MpesaTransaction.findOne({
      checkout_request_id: messageReference,
    }).lean();

    if (!existingTransaction) {
      console.error('[CoopCallback] Transaction not found for reference:', messageReference);
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    // ── Idempotency guard ──────────────────────────────────────────────────
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (
      terminalStatuses.includes(existingTransaction.status) &&
      existingTransaction.metadata?.callback_processed
    ) {
      console.log('[CoopCallback] Already processed — skipping duplicate callback');
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Now create session for actual updates
    session = await mongoose.startSession();
    session.startTransaction();

    // Re-fetch with session for transactional consistency
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: messageReference,
    }).session(session);

    if (!mpesaTransaction) {
      console.error('[CoopCallback] Transaction disappeared during transaction start');
      await session.abortTransaction();
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
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
      // FIXED: Use updateOne directly instead of find + save (atomic operation)
      // This reduces latency by avoiding fetch + serialize roundtrip
      await Profile.findByIdAndUpdate(
        mpesaTransaction.user_id,
        {
          $inc: { balance_cents: mpesaTransaction.amount_cents },
        },
        { session, new: false } // Don't fetch updated doc - we already know the amount
      );

      // Parallelize: Update transaction record independently
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

    // ========================================================================
    // ACTIVATION PAYMENT
    // ========================================================================
    if (depositType === 'activation' || mpesaTransaction.is_activation_payment) {
      // FIXED: Prefer checkout_request_id lookup (indexed) over mpesa_transaction_id
      // This is our primary idempotency key from the bank
      const activationPayment = await ActivationPayment.findOne({
        checkout_request_id: messageReference,
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
          session.endSession();
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
      // FIXED: Grant lifetime access immediately for chat-foreigners
      // Set lifetimeAccessUnlocked = true for permanent chat access after KSH 100 payment
      try {
        await ChatForeignersBotAccess.findOneAndUpdate(
          {
            user_id: chatForeignersUnlock.user_id,
            bot_id: chatForeignersUnlock.metadata?.bot_id,
          },
          {
            lifetimeAccessUnlocked: true,
            lifetimeAccessUnlockedAt: new Date(),
          },
          { session }
        );

        console.log('[CoopCallback] Lifetime access granted for chat-foreigners:', {
          userId: chatForeignersUnlock.user_id,
          botId: chatForeignersUnlock.metadata?.bot_id,
          amount: chatForeignersUnlock.amount_cents / 100,
        });
      } catch (err) {
        console.error('[CoopCallback] Error granting lifetime access:', err);
      }

      // Commit the main transaction first, then process the unlock in the background
      // so the callback response is never delayed by the unlock work.
      await session.commitTransaction();
      session.endSession();
      session = null;

      void completeBotUnlockPayment(chatForeignersUnlock._id.toString()).catch(
        (chatError) => {
          console.error('[CoopCallback] Background chat-foreigners unlock error (can retry manually):', chatError);
        }
      );

      return NextResponse.json({
        success: true,
        data: { status: paymentStatus, messageReference },
        message: 'Lifetime chat access unlocked! Enjoy unlimited chatting.',
      });
    }

    // ========================================================================
    // CHAT FOREIGNERS WALLET DEPOSIT
    // ========================================================================
    const chatForeignersDeposit = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
      transaction_type: 'chat_foreigners_deposit',
    }).session(session);

    if (chatForeignersDeposit && paymentStatus === 'completed') {
      // Commit the main transaction and run the wallet credit in the background
      // to keep callback response times fast under high traffic.
      await session.commitTransaction();
      session.endSession();
      session = null;

      void completeWalletDeposit(chatForeignersDeposit._id.toString(), null).catch(
        (chatDepositError) => {
          console.error('[CoopCallback] Background chat-foreigners deposit error:', chatDepositError);
        }
      );

      return NextResponse.json({
        success: true,
        data: { status: paymentStatus, messageReference },
        message: 'Chat foreigners deposit confirmed. Processing in background.',
      });
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
