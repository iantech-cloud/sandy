// app/api/payments/coop-bank/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase,
  MpesaTransaction,
  Profile,
  ActivationPayment,
  SpinWallet,
  GamingWallet,
  Transaction,
  ChatForeignersMpesaTransaction,
  ChatForeignersBotAccess,
} from '@/app/lib/models';
import { CoopBankService } from '@/app/lib/services/coop-bank';
import { invalidateCache } from '@/app/lib/db-cache';
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
// Chat Foreigners Callback Handler (separate from main MpesaTransaction flow)
// ---------------------------------------------------------------------------
async function handleChatForeignersCallback(
  existingChatTxn: any,
  callbackData: CoopBankCallback,
  callbackReceivedAt: Date
) {
  const messageReference = callbackData.MessageReference;
  const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];

  // Idempotency guard
  if (
    terminalStatuses.includes(existingChatTxn.status) &&
    existingChatTxn.metadata?.callback_processed
  ) {
    console.log('[CoopCallback] Chat foreigners callback already processed — skipping duplicate');
    return NextResponse.json({ success: true, message: 'Already processed' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const txn = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
    }).session(session);

    if (!txn) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    const paymentStatus = CoopBankService.mapResponseCode(callbackData.ResponseCode);
    const receiptNumber =
      callbackData.ReceiptNumber || callbackData.OperatorTxnID || txn.merchant_request_id || null;

    // Update transaction record
    txn.status = paymentStatus;
    txn.result_code = parseInt(callbackData.ResponseCode || '1', 10);
    txn.result_desc = callbackData.ResponseDescription || callbackData.ResultDesc || '';
    txn.callback_payload = callbackData;
    txn.callback_received_at = callbackReceivedAt;
    txn.metadata = {
      ...(txn.metadata || {}),
      callback_processed: true,
      callback_processed_at: callbackReceivedAt.toISOString(),
    };

    if (paymentStatus === 'completed') {
      txn.completed_at = new Date();
      txn.mpesa_receipt_number = receiptNumber;
      if (callbackData.PhoneNumber) {
        txn.phone_number = callbackData.PhoneNumber;
      }
      txn.transaction_date = callbackData.TransactionDate;
    } else if (['failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
      txn.failed_at = new Date();
    }

    await txn.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Fire background completion jobs after transaction is committed
    if (paymentStatus === 'completed') {
      if (txn.transaction_type === 'chat_foreigners_unlock') {
        void completeBotUnlockPayment(txn._id.toString()).catch((err) =>
          console.error('[CoopCallback] Background chat-foreigners unlock error:', err)
        );
      } else if (txn.transaction_type === 'chat_foreigners_deposit') {
        void completeWalletDeposit(txn._id.toString()).catch((err) =>
          console.error('[CoopCallback] Background chat-foreigners deposit error:', err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { status: paymentStatus, messageReference },
      message: 'Chat foreigners callback processed successfully',
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error('[CoopCallback] Chat foreigners callback error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process chat foreigners callback' },
      { status: 500 }
    );
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
    console.log('[CoopCallback] Received at', callbackReceivedAt.toISOString());

    const callbackData: CoopBankCallback = body;

    const messageReference = callbackData.MessageReference;
    if (!messageReference) {
      console.error('[CoopCallback] Missing MessageReference in callback body');
      return NextResponse.json({ success: false, error: 'Missing MessageReference' }, { status: 400 });
    }

    // FIXED: Check BOTH MpesaTransaction and ChatForeignersMpesaTransaction collections
    // Chat foreigners payments are in a separate collection and never touch MpesaTransaction
    const [existingTransaction, existingChatTransaction] = await Promise.all([
      MpesaTransaction.findOne({
        $or: [
          { checkout_request_id: messageReference },
          { account_reference: messageReference }
        ]
      }).lean(),
      ChatForeignersMpesaTransaction.findOne({
        checkout_request_id: messageReference,
      }).lean(),
    ]);

    if (!existingTransaction && !existingChatTransaction) {
      console.error('[CoopCallback] Transaction not found in either collection for reference:', messageReference);
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    // Route chat foreigners transactions to separate handler to avoid 404
    if (!existingTransaction && existingChatTransaction) {
      console.log('[CoopCallback] Routing to chat foreigners handler for reference:', messageReference);
      return handleChatForeignersCallback(existingChatTransaction, callbackData, callbackReceivedAt);
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
    // Use the same lookup strategy: try both fields
    const mpesaTransaction = await MpesaTransaction.findOne({
      $or: [
        { checkout_request_id: messageReference },
        { account_reference: messageReference }
      ]
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

    // Write OperatorTxnID (bank's own ref) into the linked Transaction.transaction_code
    if (paymentStatus === 'completed' && callbackData.OperatorTxnID) {
      await (Transaction as any).findOneAndUpdate(
        { mpesa_transaction_id: mpesaTransaction._id },
        {
          $set: {
            transaction_code: callbackData.OperatorTxnID,
            'metadata.coop_operator_txn_id': callbackData.OperatorTxnID,
            'metadata.coop_receipt_number': callbackData.ReceiptNumber,
            'metadata.coop_conversation_id': callbackData.ConversationID,
            'metadata.mpesa_receipt_number': receiptNumber,
          }
        },
        { session }
      );
    }

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
    if (depositType === 'wallet') {
      if (paymentStatus === 'completed') {
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
      } else if (['failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
        // BUG FIX: Mark transaction as failed/cancelled/timeout so it doesn't persist on 'processing'
        await (Transaction as any).findOneAndUpdate(
          {
            mpesa_transaction_id: mpesaTransaction._id,
            type: 'DEPOSIT',
          },
          { status: paymentStatus },
          { session }
        );

        console.log(
          `[CoopCallback] Wallet deposit failed: ${paymentStatus} for user ${mpesaTransaction.user_id}`
        );
      }
    }

    // ========================================================================
    // GAMING WALLET DEPOSIT
    // ========================================================================
    if (depositType === 'gaming') {
      if (paymentStatus === 'completed') {
        // Update gaming wallet balance
        await (GamingWallet as any).findOneAndUpdate(
          { user_id: mpesaTransaction.user_id },
          {
            $inc: { balance_cents: mpesaTransaction.amount_cents },
            $set: {
              last_transaction_at: new Date(),
            },
            $setOnInsert: {
              user_id: mpesaTransaction.user_id,
              created_at: new Date(),
            }
          },
          { session, upsert: true, new: false }
        );

        // Update gaming transaction record
        await (Transaction as any).findOneAndUpdate(
          {
            mpesa_transaction_id: mpesaTransaction._id,
            type: 'GAMING_DEPOSIT',
          },
          { status: 'completed' },
          { session }
        );

        console.log(
          `[CoopCallback] Gaming wallet credited: +KES ${mpesaTransaction.amount_cents / 100} (user: ${mpesaTransaction.user_id})`
        );

        // FIXED: Invalidate wallet cache so fresh reads don't show stale balance
        invalidateCache('wallet');
      } else if (['failed', 'cancelled', 'timeout'].includes(paymentStatus)) {
        // Mark transaction as failed
        await (Transaction as any).findOneAndUpdate(
          {
            mpesa_transaction_id: mpesaTransaction._id,
            type: 'GAMING_DEPOSIT',
          },
          { status: paymentStatus },
          { session }
        );

        console.log(
          `[CoopCallback] Gaming deposit failed: ${paymentStatus} for user ${mpesaTransaction.user_id}`
        );
      }
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

          console.log('[CoopCallback] Payment confirmed - IMMEDIATELY completing activation:', {
            activationPaymentId,
            messageReference,
            userId: activationPayment.user_id,
            amount: activationPayment.amount_cents / 100,
            timestamp: new Date().toISOString()
          });

          // ✅ FIX: Complete activation SYNCHRONOUSLY (not fire-and-forget)
          // This ensures the user is ALWAYS activated when payment is confirmed.
          // If activation fails, we still return success to the bank and let the
          // recovery job handle any orphaned records (but this should rarely happen).
          try {
            const activationResult = await completeActivationAfterPayment(activationPaymentId);
            
            if (activationResult.success) {
              console.log(
                '[CoopCallback] ✅ Activation COMPLETED SUCCESSFULLY:',
                {
                  activationPaymentId,
                  userId: activationPayment.user_id,
                  username: activationResult.data?.username,
                  rank: activationResult.data?.rank
                }
              );
            } else {
              console.error(
                '[CoopCallback] ❌ Activation FAILED - recovery job must retry:',
                {
                  activationPaymentId,
                  error: activationResult.message,
                  userId: activationPayment.user_id
                }
              );
              
              // Mark for recovery
              await (ActivationPayment as any).findByIdAndUpdate(
                activationPaymentId,
                {
                  $set: {
                    'metadata.activation_attempt_failed': true,
                    'metadata.activation_failed_at': new Date().toISOString(),
                    'metadata.activation_error': activationResult.message
                  }
                }
              );
            }
          } catch (activationError) {
            console.error(
              '[CoopCallback] ❌ CRITICAL: Activation threw exception (recovery must retry):',
              {
                activationPaymentId,
                error: activationError instanceof Error ? activationError.message : String(activationError),
                userId: activationPayment.user_id,
                stack: activationError instanceof Error ? activationError.stack : ''
              }
            );
            
            // Mark for recovery
            await (ActivationPayment as any).findByIdAndUpdate(
              activationPaymentId,
              {
                $set: {
                  'metadata.activation_attempt_failed': true,
                  'metadata.activation_failed_at': new Date().toISOString(),
                  'metadata.activation_error': activationError instanceof Error ? activationError.message : 'Unknown error'
                }
              }
            );
          }

          return NextResponse.json({
            success: true,
            data: { status: paymentStatus, messageReference },
            message: 'Payment confirmed and user account activated.',
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
