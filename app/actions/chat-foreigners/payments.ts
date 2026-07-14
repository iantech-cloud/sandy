'use server';

import { connectToDatabase, ChatForeignersPayment, ChatForeignersMpesaTransaction, ChatForeignersWallet, ChatForeignersTransaction, ChatForeignersReferralEarning, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersProfile, Profile, Referral, Transaction } from '@/app/lib/models';
import { createCoopBankService } from '@/app/lib/services/coop-bank';
import mongoose from 'mongoose';
import { auth } from '@/auth';

// ========================================================================
// Helper: Get Current User from Session
// ========================================================================
async function getCurrentUserFromSession() {
  const session = await auth();
  const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;
  
  if (!session?.user || (!sessionId && !session.user.email)) {
    return null;
  }

  let currentUser = null;
  if (sessionId) {
    currentUser = await Profile.findOne({ _id: sessionId }).lean();
  }
  if (!currentUser && session.user.email) {
    const emailPattern = new RegExp(
      `^${session.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    );
    currentUser = await Profile.findOne({ email: { $regex: emailPattern } }).lean();
  }

  return currentUser;
}

// ========================================================================
// Initiate Bot Unlock Payment via M-Pesa (Co-op Bank STK Push)
// ========================================================================
export async function initiateBotUnlockViaMpesa(
  botId: string,
  phoneNumber: string,
  referralCode?: string,
  customAmountCents?: number
) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get bot — unlock is always KSH 100 regardless of bot's stored cost
    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    // LIFETIME UNLOCK: block payment if ANY access record exists for this bot (paid once = forever)
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id,
      bot_id: botId,
    });

    if (existingAccess) {
      return { success: false, error: 'You have already unlocked this personality. Access is lifetime — no re-subscription needed.' };
    }

    // Use dynamic amount if provided, otherwise default to KES 100 (10000 cents)
    const UNLOCK_COST_CENTS = customAmountCents ?? 10000; // KSH 95-100 dynamic or fixed

    // Create M-Pesa transaction record
    const mpesaTransaction = await ChatForeignersMpesaTransaction.create({
      user_id: currentUser._id,
      amount_cents: UNLOCK_COST_CENTS,
      phone_number: phoneNumber,
      transaction_type: 'chat_foreigners_unlock',
      bot_id: botId,
      status: 'initiated',
      metadata: {
        referralCode: referralCode || null,
      },
    });

    // Create pending payment record
    const payment = await ChatForeignersPayment.create({
      user_id: currentUser._id,
      bot_id: botId,
      paymentType: 'bot_unlock',
      amount_cents: UNLOCK_COST_CENTS,
      phone_number: phoneNumber,
      mpesa_transaction_id: mpesaTransaction._id,
      status: 'pending',
    });

    // Call Co-op Bank STK Push — same pattern as main site activation
    // ✅ Use CHAT_ prefix for chat foreigners payments
    const messageRef = `CHAT_${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const narration = 'Chat Foreigners - Personality Unlock';
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    console.log('[ChatForeigners] Initiating STK push:', {
      messageRef,
      amount: UNLOCK_COST_CENTS / 100,
      phone: phoneNumber,
      botId,
    });

    const coopBank = createCoopBankService();
    let stkResponse;
    try {
      stkResponse = await coopBank.initiateSTKPush(
        phoneNumber,
        UNLOCK_COST_CENTS / 100, // Always KSH 100 — never read from bot record
        narration,
        callbackUrl,
        messageRef
      );
    } catch (stkError) {
      console.error('[ChatForeigners] STK push exception:', stkError);
      await ChatForeignersPayment.updateOne({ _id: payment._id }, { status: 'failed' });
      return {
        success: false,
        error: stkError instanceof Error ? stkError.message : 'Failed to initiate payment. Please try again.',
      };
    }

    if (stkResponse.ResponseCode !== '0') {
      console.warn('[ChatForeigners] STK push rejected:', stkResponse);
      await ChatForeignersPayment.updateOne({ _id: payment._id }, { status: 'failed' });
      return {
        success: false,
        error: stkResponse.ResponseDescription || 'Failed to initiate payment. Please try again.',
        code: stkResponse.ResponseCode,
      };
    }

    // Store checkout_request_id = messageRef so callback can find this transaction
    const checkoutRequestId = messageRef;

    // Update M-Pesa transaction with STK response
    mpesaTransaction.checkout_request_id = checkoutRequestId;
    mpesaTransaction.merchant_request_id = stkResponse.MessageReference || messageRef;
    mpesaTransaction.stk_push_response = stkResponse;
    await mpesaTransaction.save();

    console.log('[ChatForeigners] STK push initiated:', {
      checkoutRequestId,
      paymentId: payment._id,
    });

    return {
      success: true,
      data: {
        paymentId: payment._id.toString(),
        checkoutRequestId,
        merchantRequestId: stkResponse.MessageReference || messageRef,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Payment initiation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Check Bot Unlock Payment Status — mirrors checkActivationPaymentStatus
// Accepts the messageReference (checkout_request_id) used at STK push time,
// queries the Co-op Bank Enquiry API (same as activation), persists the
// result, and auto-triggers completeBotUnlockPayment when confirmed.
// ========================================================================
export async function checkBotUnlockPaymentStatus(messageReference: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, message: 'User not authenticated' };
    }

    // Look up by checkout_request_id (= messageRef set at STK push time)
    const mpesaTransaction = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
    });

    if (!mpesaTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // Already in a terminal state — return cached result immediately
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status)) {
      console.log('[ChatForeigners] Returning cached terminal status:', mpesaTransaction.status);
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          amount: mpesaTransaction.amount_cents / 100,
          source: mpesaTransaction.metadata?.callback_processed ? 'coop_callback' : 'database',
        },
      };
    }

    // Callback already flagged it as processed — return current status
    if (mpesaTransaction.metadata?.callback_processed) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          source: 'callback_processed',
        },
      };
    }

    // Query Co-op Bank Enquiry API — same as activation flow
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(messageReference);
      const { CoopBankService } = await import('@/app/lib/services/coop-bank');
      const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

      console.log('[ChatForeigners] Status poll:', {
        messageReference,
        responseCode: statusResponse.ResponseCode,
        mappedStatus,
        description: statusResponse.ResponseDescription,
      });

      // Persist the updated status
      const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
      const safeResultCode = isNaN(resultCode) ? 1 : resultCode;

      await ChatForeignersMpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
        status: mappedStatus,
        result_code: safeResultCode,
        result_desc: statusResponse.ResponseDescription || '',
        ...(mappedStatus === 'completed' ? { completed_at: new Date() } : {}),
        ...(['failed', 'cancelled', 'timeout'].includes(mappedStatus) ? { failed_at: new Date() } : {}),
      });

      // If completed via poll (callback missed), run unlock completion logic
      if (mappedStatus === 'completed') {
        console.log('[ChatForeigners] Unlock confirmed via status poll, completing...');
        const payment = await ChatForeignersPayment.findOne({
          mpesa_transaction_id: mpesaTransaction._id,
        });
        if (payment && payment.status !== 'completed') {
          await completeBotUnlockPayment(mpesaTransaction._id.toString());
        }
      }

      let userMessage = `Payment status: ${mappedStatus}`;
      if (mappedStatus === 'completed') userMessage = 'Payment confirmed! Unlocking chat...';
      else if (mappedStatus === 'failed') userMessage = `Payment failed: ${statusResponse.ResponseDescription || 'Transaction could not be processed'}`;
      else if (mappedStatus === 'timeout') userMessage = 'Payment timed out. Please check your M-Pesa history and try again.';
      else if (mappedStatus === 'cancelled') userMessage = 'Payment cancelled. You can try again.';
      else if (mappedStatus === 'pending') userMessage = 'Payment still processing. Please wait...';

      return {
        success: true,
        data: {
          status: mappedStatus,
          resultCode: statusResponse.ResponseCode,
          resultDesc: statusResponse.ResponseDescription || '',
          amount: mpesaTransaction.amount_cents / 100,
          source: 'coop_api',
        },
        message: userMessage,
      };
    } catch (apiError) {
      console.error('[ChatForeigners] Co-op Bank API error, returning DB status:', apiError);
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultDesc: 'Checking payment status...',
          source: 'database_fallback',
        },
        message: 'Using last known status. Please wait for payment confirmation.',
      };
    }
  } catch (error) {
    console.error('[ChatForeigners] checkBotUnlockPaymentStatus error:', error);
    return {
      success: false,
      message: 'Failed to check payment status. Please try again.',
      data: { status: 'error', resultDesc: 'Unable to verify payment status' },
    };
  }
}

// ========================================================================
// Complete Bot Unlock Payment (Called by callback handler)
// ========================================================================
export async function completeBotUnlockPayment(
  mpesaTransactionId: string,
  session?: mongoose.ClientSession
) {
  try {
    await connectToDatabase();

    const mpesaTransaction = await ChatForeignersMpesaTransaction.findById(
      mpesaTransactionId
    ).session(session);

    if (!mpesaTransaction) {
      throw new Error('M-Pesa transaction not found');
    }

    const payment = await ChatForeignersPayment.findOne({
      mpesa_transaction_id: mpesaTransactionId,
    }).session(session);

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Update payment status
    payment.status = 'completed';
    payment.completed_at = new Date();
    await payment.save({ session });

    // LIFETIME UNLOCK: create access record once; never reset or close it again
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: mpesaTransaction.user_id,
      bot_id: payment.bot_id,
    }).session(session);

    if (existingAccess) {
      // Already unlocked (should not happen due to payment guard, but be safe)
      // Just ensure it's not closed and mark lifetime access
      existingAccess.isClosed = false;
      existingAccess.closedAt = undefined;
      existingAccess.lifetimeAccessUnlocked = true;
      existingAccess.lifetimeAccessUnlockedAt = new Date();
      await existingAccess.save({ session });
    } else {
      await ChatForeignersBotAccess.create(
        [
          {
            user_id: mpesaTransaction.user_id,
            bot_id: payment.bot_id,
            unlockedAt: new Date(),
            isClosed: false,
            lifetimeAccessUnlocked: true,
            lifetimeAccessUnlockedAt: new Date(),
          },
        ],
        { session }
      );
    }

    // KSH 100 split (chat unlock) — 2-tier:
    //   Level 1 referrer = KSH 70 (7000 cents) — credited to L1 MAIN wallet
    //   Level 2 referrer = KSH 10 (1000 cents) — credited to L2 MAIN wallet
    //   Company          = KSH 20 (2000 cents) — kept by platform
    const L1_SHARE_CENTS = 7000;
    const L2_SHARE_CENTS = 1000;
    const COMPANY_SHARE_CENTS = 2000;

    // ----------------------------------------------------------------
    // Look up referral chain
    // ----------------------------------------------------------------
    const referralRecord = await Referral.findOne({
      referred_id: mpesaTransaction.user_id,
    }).session(session);

    if (referralRecord) {
      const l1ReferrerId = referralRecord.referrer_id;

      // Guard: only pay once per payment
      const existingEarning = await ChatForeignersReferralEarning.findOne({
        referrer_id: l1ReferrerId,
        referee_id: mpesaTransaction.user_id,
        bot_id: payment.bot_id,
        payment_id: payment._id,
        earningType: 'initial_unlock',
      }).session(session);

      if (!existingEarning) {
        // ---- Level 1 ----
        const l1Earning = await ChatForeignersReferralEarning.create(
          [
            {
              referrer_id: l1ReferrerId,
              referee_id: mpesaTransaction.user_id,
              bot_id: payment.bot_id,
              earningType: 'initial_unlock',
              amount_cents: L1_SHARE_CENTS,
              status: 'pending',
              payment_id: payment._id,
            },
          ],
          { session }
        );

        // Credit KSH 70 to L1 referrer's MAIN wallet
        await Profile.findByIdAndUpdate(
          l1ReferrerId,
          { $inc: { balance_cents: L1_SHARE_CENTS, total_earnings_cents: L1_SHARE_CENTS } },
          { session }
        );

        // Track in CF wallet downline_earnings for reporting
        let l1CFWallet = await ChatForeignersWallet.findOne({ user_id: l1ReferrerId }).session(session);
        if (!l1CFWallet) {
          l1CFWallet = new ChatForeignersWallet({ user_id: l1ReferrerId, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0, downline_earnings_cents: 0 });
        }
        (l1CFWallet as any).downline_earnings_cents = ((l1CFWallet as any).downline_earnings_cents || 0) + L1_SHARE_CENTS;
        await l1CFWallet.save({ session });

        // Main ledger record for L1
        await (Transaction as any).create(
          [
            {
              user_id: l1ReferrerId,
              amount_cents: L1_SHARE_CENTS,
              type: 'REFERRAL',
              description: 'Chat Foreigners L1 downline: referred user unlocked a personality (KES 70)',
              status: 'completed',
              target_type: 'user',
              target_id: l1ReferrerId.toString(),
              metadata: {
                referredUser: mpesaTransaction.user_id.toString(),
                source: 'chat_foreigners_unlock',
                bot_id: payment.bot_id?.toString(),
                level: 1,
              },
            },
          ],
          { session }
        );

        if (l1Earning[0]) {
          l1Earning[0].status = 'completed';
          await l1Earning[0].save({ session });
        }

        console.log('[ChatForeigners] L1 downline commission paid:', { l1ReferrerId, amount: L1_SHARE_CENTS / 100 });

        // ---- Level 2: grandparent ----
        const l1Profile = await Profile.findById(l1ReferrerId).session(session);
        if (l1Profile && (l1Profile as any).referred_by) {
          const l2ReferrerId = (l1Profile as any).referred_by;

          await Profile.findByIdAndUpdate(
            l2ReferrerId,
            { $inc: { balance_cents: L2_SHARE_CENTS, total_earnings_cents: L2_SHARE_CENTS } },
            { session }
          );

          // Track in CF wallet downline_earnings
          let l2CFWallet = await ChatForeignersWallet.findOne({ user_id: l2ReferrerId }).session(session);
          if (!l2CFWallet) {
            l2CFWallet = new ChatForeignersWallet({ user_id: l2ReferrerId, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0, downline_earnings_cents: 0 });
          }
          (l2CFWallet as any).downline_earnings_cents = ((l2CFWallet as any).downline_earnings_cents || 0) + L2_SHARE_CENTS;
          await l2CFWallet.save({ session });

          // Main ledger record for L2
          await (Transaction as any).create(
            [
              {
                user_id: l2ReferrerId,
                amount_cents: L2_SHARE_CENTS,
                type: 'REFERRAL',
                description: 'Chat Foreigners L2 downline: referred user unlocked a personality (KES 10)',
                status: 'completed',
                target_type: 'user',
                target_id: l2ReferrerId.toString(),
                metadata: {
                  referredUser: mpesaTransaction.user_id.toString(),
                  source: 'chat_foreigners_unlock',
                  bot_id: payment.bot_id?.toString(),
                  level: 2,
                  level1_referrer_id: l1ReferrerId.toString(),
                },
              },
            ],
            { session }
          );

          console.log('[ChatForeigners] L2 downline commission paid:', { l2ReferrerId, amount: L2_SHARE_CENTS / 100 });
        }
      }
    }

    // ----------------------------------------------------------------
    // Company keeps KSH 25 — recorded as company revenue
    // ----------------------------------------------------------------
    await ChatForeignersTransaction.create(
      [
        {
          user_id: mpesaTransaction.user_id,
          amount_cents: COMPANY_SHARE_CENTS,
          type: 'CHAT_EARNINGS',
          description: 'Chat Foreigners platform fee (KSH 20)',
          status: 'completed',
          target_type: 'company',
          target_id: 'company',
        },
      ],
      { session }
    );

    console.log('[ChatForeigners] Bot unlock completed:', {
      paymentId: payment._id,
      botId: payment.bot_id,
      userId: mpesaTransaction.user_id,
    });

    return { success: true, data: { paymentId: payment._id } };
  } catch (error) {
    console.error('[ChatForeigners] Completion error:', error);
    throw error;
  }
}

// ========================================================================
// Initiate Wallet Deposit via M-Pesa (Co-op Bank STK Push)
// ========================================================================
export async function initiateWalletDepositViaMpesa(
  amountCents: number,
  phoneNumber: string
) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    if (amountCents < 1000) {
      return { success: false, error: 'Minimum deposit is KES 10' };
    }

    // Create M-Pesa transaction record
    const mpesaTransaction = await ChatForeignersMpesaTransaction.create({
      user_id: currentUser._id,
      amount_cents: amountCents,
      phone_number: phoneNumber,
      transaction_type: 'chat_foreigners_deposit',
      status: 'initiated',
    });

    // Create pending transaction record
    const transaction = await ChatForeignersTransaction.create({
      user_id: currentUser._id,
      amount_cents: amountCents,
      type: 'CHAT_DEPOSIT',
      description: 'Chat wallet deposit',
      status: 'pending',
      mpesa_transaction_id: mpesaTransaction._id,
      target_type: 'user',
      target_id: currentUser._id,
    });

    // Call Co-op Bank STK Push — same pattern as main site
    // ✅ Use CHAT_ prefix for chat foreigners wallet deposits
    const messageRef = `CHAT_${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const narration = 'Chat Foreigners Wallet Deposit';
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    console.log('[ChatForeigners] Initiating deposit STK push:', {
      messageRef,
      amount: amountCents / 100,
      phone: phoneNumber,
    });

    const coopBank = createCoopBankService();
    let stkResponse;
    try {
      stkResponse = await coopBank.initiateSTKPush(
        phoneNumber,
        Math.round(amountCents / 100),
        narration,
        callbackUrl,
        messageRef
      );
    } catch (stkError) {
      console.error('[ChatForeigners] Deposit STK push exception:', stkError);
      await ChatForeignersTransaction.updateOne({ _id: transaction._id }, { status: 'failed' });
      return {
        success: false,
        error: stkError instanceof Error ? stkError.message : 'Failed to initiate deposit. Please try again.',
      };
    }

    if (stkResponse.ResponseCode !== '0') {
      console.warn('[ChatForeigners] Deposit STK push rejected:', stkResponse);
      await ChatForeignersTransaction.updateOne({ _id: transaction._id }, { status: 'failed' });
      return {
        success: false,
        error: stkResponse.ResponseDescription || 'Failed to initiate deposit. Please try again.',
      };
    }

    // Update M-Pesa transaction with STK response
    mpesaTransaction.checkout_request_id = messageRef;
    mpesaTransaction.merchant_request_id = stkResponse.MessageReference || messageRef;
    mpesaTransaction.stk_push_response = stkResponse;
    await mpesaTransaction.save();

    return {
      success: true,
      data: {
        transactionId: transaction._id.toString(),
        checkoutRequestId: messageRef,
        merchantRequestId: stkResponse.MessageReference || messageRef,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Deposit initiation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Check Wallet Deposit Payment Status — mirrors checkBotUnlockPaymentStatus
// The chat wallet deposit lives in ChatForeignersMpesaTransaction (NOT the
// main MpesaTransaction collection), so the deposit waiting page MUST poll
// through this action — querying the main deposit checker would always return
// "Transaction not found" and leave the UI stuck on "processing" forever.
// Queries the Co-op Bank Enquiry API (same as activation), persists the result,
// and auto-completes the deposit via completeWalletDeposit when confirmed.
// ========================================================================
export async function checkWalletDepositPaymentStatus(messageReference: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, message: 'User not authenticated' };
    }

    // Look up by checkout_request_id (= messageRef set at STK push time)
    const mpesaTransaction = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: messageReference,
      transaction_type: 'chat_foreigners_deposit',
    });

    if (!mpesaTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // Already in a terminal state — return cached result immediately
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status)) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          amount: mpesaTransaction.amount_cents / 100,
          source: mpesaTransaction.metadata?.callback_processed ? 'coop_callback' : 'database',
        },
      };
    }

    // Query Co-op Bank Enquiry API — same as activation/unlock flow
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(messageReference);
      const { CoopBankService } = await import('@/app/lib/services/coop-bank');
      const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

      console.log('[ChatForeigners] Deposit status poll:', {
        messageReference,
        responseCode: statusResponse.ResponseCode,
        mappedStatus,
        description: statusResponse.ResponseDescription,
      });

      // Persist the updated status
      const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
      const safeResultCode = isNaN(resultCode) ? 1 : resultCode;

      await ChatForeignersMpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
        status: mappedStatus,
        result_code: safeResultCode,
        result_desc: statusResponse.ResponseDescription || '',
        ...(mappedStatus === 'completed' ? { completed_at: new Date() } : {}),
        ...(['failed', 'cancelled', 'timeout'].includes(mappedStatus) ? { failed_at: new Date() } : {}),
      });

      // If completed via poll (callback missed), credit the wallet — guard so we
      // only credit once even if the callback also fires.
      if (mappedStatus === 'completed') {
        const depositTxn = await ChatForeignersTransaction.findOne({
          mpesa_transaction_id: mpesaTransaction._id,
          type: 'CHAT_DEPOSIT',
        });
        if (depositTxn && depositTxn.status !== 'completed') {
          console.log('[ChatForeigners] Deposit confirmed via status poll, completing...');
          await completeWalletDeposit(mpesaTransaction._id.toString());
        }
      }

      return {
        success: true,
        data: {
          status: mappedStatus,
          resultCode: statusResponse.ResponseCode,
          resultDesc: statusResponse.ResponseDescription || '',
          amount: mpesaTransaction.amount_cents / 100,
          source: 'coop_api',
        },
      };
    } catch (apiError) {
      console.error('[ChatForeigners] Deposit status API error, returning DB status:', apiError);
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultDesc: 'Checking payment status...',
          source: 'database_fallback',
        },
      };
    }
  } catch (error) {
    console.error('[ChatForeigners] checkWalletDepositPaymentStatus error:', error);
    return {
      success: false,
      message: 'Failed to check payment status. Please try again.',
      data: { status: 'error', resultDesc: 'Unable to verify payment status' },
    };
  }
}

// ========================================================================
// Complete Wallet Deposit (Called by callback handler)
// ========================================================================
export async function completeWalletDeposit(
  mpesaTransactionId: string,
  session?: mongoose.ClientSession
) {
  try {
    await connectToDatabase();

    const mpesaTransaction = await ChatForeignersMpesaTransaction.findById(
      mpesaTransactionId
    ).session(session);

    if (!mpesaTransaction) {
      throw new Error('M-Pesa transaction not found');
    }

    // Idempotency guard: if the deposit transaction is already completed, do
    // not credit the wallet again (callback + poll could both fire).
    const existingTxn = await ChatForeignersTransaction.findOne({
      mpesa_transaction_id: mpesaTransactionId,
      type: 'CHAT_DEPOSIT',
    }).session(session);

    if (existingTxn && existingTxn.status === 'completed') {
      console.log('[ChatForeigners] Deposit already completed — skipping duplicate credit');
      return { success: true, alreadyCompleted: true };
    }

    // Update wallet balance
    let wallet = await ChatForeignersWallet.findOne({
      user_id: mpesaTransaction.user_id,
    }).session(session);

    if (!wallet) {
      wallet = new ChatForeignersWallet({
        user_id: mpesaTransaction.user_id,
      });
    }

    wallet.balance_cents += mpesaTransaction.amount_cents;
    wallet.total_deposited_cents += mpesaTransaction.amount_cents;
    await wallet.save({ session });

    // Update transaction record
    await ChatForeignersTransaction.findOneAndUpdate(
      {
        mpesa_transaction_id: mpesaTransactionId,
        type: 'CHAT_DEPOSIT',
      },
      { status: 'completed' },
      { session }
    );

    console.log('[ChatForeigners] Deposit completed:', {
      userId: mpesaTransaction.user_id,
      amount: mpesaTransaction.amount_cents / 100,
      walletBalance: wallet.balance_cents / 100,
    });

    return { success: true };
  } catch (error) {
    console.error('[ChatForeigners] Deposit completion error:', error);
    throw error;
  }
}

// ========================================================================
// Lifetime Chat Access - REMOVED milestone-based reward system
// Users now earn KSH 10 per message after bot reply (unlimited)
// After paying KSH 100 once, they have permanent lifetime access
// ========================================================================

// ========================================================================
// Close Chat Session
// Marks the bot access session as isClosed=true and clears the message
// history so the next session starts fresh.
// ========================================================================
export async function closeChat(botId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUserFromSession();
    if (!currentUser) {
      return { success: false, message: 'Not authenticated' };
    }

    const userId = (currentUser as any)._id.toString();

    const result = await ChatForeignersBotAccess.findOneAndUpdate(
      { user_id: userId, bot_id: botId },
      {
        $set: {
          isClosed: true,
          messages: [],          // clear session history so next chat starts fresh
          messagesEarnedToday: 0,
        },
      },
      { new: true }
    );

    if (!result) {
      return { success: false, message: 'Chat session not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('[ChatForeigners] closeChat error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to close chat' };
  }
}
