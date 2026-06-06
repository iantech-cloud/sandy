'use server';

import { connectToDatabase, ChatForeignersPayment, ChatForeignersMpesaTransaction, ChatForeignersWallet, ChatForeignersTransaction, ChatForeignersReferralEarning, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersProfile, Profile, Referral } from '@/app/lib/models';
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
  referralCode?: string
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

    // Check if user already has ACTIVE (non-closed) access to this bot
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id,
      bot_id: botId,
      isClosed: { $ne: true }, // only block if not closed
    });

    if (existingAccess) {
      return { success: false, error: 'You already have active access to this personality' };
    }

    const UNLOCK_COST_CENTS = 10000; // KSH 100 fixed

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
    const messageRef = `CHATF${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const narration = 'Chat Foreigners - Personality Unlock';
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    console.log('[ChatForeigners] Initiating STK push:', {
      messageRef,
      amount: bot.unlockCost_cents / 100,
      phone: phoneNumber,
      botId,
    });

    const coopBank = createCoopBankService();
    let stkResponse;
    try {
      stkResponse = await coopBank.initiateSTKPush(
        phoneNumber,
        Math.round(bot.unlockCost_cents / 100),
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
// Check Bot Unlock Payment Status
// ========================================================================
export async function checkBotUnlockMpesaStatus(paymentId: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const payment = await ChatForeignersPayment.findById(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.user_id !== currentUser._id) {
      return { success: false, error: 'Unauthorized' };
    }

    const mpesaTransaction = await ChatForeignersMpesaTransaction.findById(
      payment.mpesa_transaction_id
    );
    if (!mpesaTransaction) {
      return { success: false, error: 'Transaction not found' };
    }

    return {
      success: true,
      data: {
        status: payment.status,
        transactionStatus: mpesaTransaction.status,
        amount: payment.amount_cents / 100,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Status check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
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

    // Create or re-open bot access record (re-unlock after chat close)
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: mpesaTransaction.user_id,
      bot_id: payment.bot_id,
    }).session(session);

    if (existingAccess) {
      // Re-unlock: reset the access so chat can start fresh
      existingAccess.unlockedAt = new Date();
      existingAccess.messageCount = 0;
      existingAccess.firstMilestoneComplete = false;
      existingAccess.milestoneCompletedAt = undefined;
      existingAccess.isClosed = false;
      existingAccess.closedAt = undefined;
      await existingAccess.save({ session });
    } else {
      await ChatForeignersBotAccess.create(
        [
          {
            user_id: mpesaTransaction.user_id,
            bot_id: payment.bot_id,
            unlockedAt: new Date(),
            isClosed: false,
          },
        ],
        { session }
      );
    }

    // KSH 100 split:
    //   Referrer  = KSH 60 (6000 cents) — credited to chat foreigners wallet
    //   User      = KSH 20 (2000 cents) — credited to chat foreigners wallet (non-withdrawable)
    //   Company   = KSH 10 (1000 cents) — kept by platform
    const REFERRER_SHARE_CENTS = 6000;
    const USER_SHARE_CENTS = 2000;
    const COMPANY_SHARE_CENTS = 1000;

    // ----------------------------------------------------------------
    // Credit user's own Chat Foreigners wallet (non-withdrawable KSH 20)
    // ----------------------------------------------------------------
    let userWallet = await ChatForeignersWallet.findOne({
      user_id: mpesaTransaction.user_id,
    }).session(session);
    if (!userWallet) {
      userWallet = new ChatForeignersWallet({ user_id: mpesaTransaction.user_id, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
    }
    userWallet.balance_cents += USER_SHARE_CENTS;
    userWallet.total_earned_cents += USER_SHARE_CENTS;
    await userWallet.save({ session });

    await ChatForeignersTransaction.create(
      [
        {
          user_id: mpesaTransaction.user_id,
          amount_cents: USER_SHARE_CENTS,
          type: 'CHAT_EARNINGS',
          description: 'Chat Foreigners personality unlock bonus (non-withdrawable)',
          status: 'completed',
          target_type: 'user',
          target_id: mpesaTransaction.user_id.toString(),
        },
      ],
      { session }
    );

    // ----------------------------------------------------------------
    // Universal referral system — credit referrer KSH 60
    // ----------------------------------------------------------------
    const referralRecord = await Referral.findOne({
      referred_id: mpesaTransaction.user_id,
    }).session(session);

    if (referralRecord) {
      const referrerId = referralRecord.referrer_id;

      // Check that referral earning doesn't already exist for this specific payment
      const existingEarning = await ChatForeignersReferralEarning.findOne({
        referrer_id: referrerId,
        referee_id: mpesaTransaction.user_id,
        bot_id: payment.bot_id,
        payment_id: payment._id,
        earningType: 'initial_unlock',
      }).session(session);

      if (!existingEarning) {
        const referralEarning = await ChatForeignersReferralEarning.create(
          [
            {
              referrer_id: referrerId,
              referee_id: mpesaTransaction.user_id,
              bot_id: payment.bot_id,
              earningType: 'initial_unlock',
              amount_cents: REFERRER_SHARE_CENTS,
              status: 'pending',
              payment_id: payment._id,
            },
          ],
          { session }
        );

        let referrerWallet = await ChatForeignersWallet.findOne({
          user_id: referrerId,
        }).session(session);
        if (!referrerWallet) {
          referrerWallet = new ChatForeignersWallet({ user_id: referrerId, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
        }
        referrerWallet.balance_cents += REFERRER_SHARE_CENTS;
        referrerWallet.total_earned_cents += REFERRER_SHARE_CENTS;
        await referrerWallet.save({ session });

        await ChatForeignersTransaction.create(
          [
            {
              user_id: referrerId,
              amount_cents: REFERRER_SHARE_CENTS,
              type: 'CHAT_EARNINGS',
              description: 'Chat Foreigners referral commission: referred user unlocked a personality',
              status: 'completed',
              target_type: 'user',
              target_id: referrerId.toString(),
            },
          ],
          { session }
        );

        if (referralEarning[0]) {
          referralEarning[0].status = 'completed';
          await referralEarning[0].save({ session });
        }

        console.log('[ChatForeigners] Referral commission paid:', {
          referrerId,
          botId: payment.bot_id,
          amount: REFERRER_SHARE_CENTS / 100,
        });
      }
    }

    // ----------------------------------------------------------------
    // Company keeps KSH 10 — recorded as company revenue
    // ----------------------------------------------------------------
    await ChatForeignersTransaction.create(
      [
        {
          user_id: mpesaTransaction.user_id,
          amount_cents: COMPANY_SHARE_CENTS,
          type: 'CHAT_EARNINGS',
          description: 'Chat Foreigners platform fee (company share)',
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
    const messageRef = `CHATDEP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
// Close Chat & Credit User KSH 100 (non-withdrawable)
// Called when user finishes a chat session.
// Requirements:
//   - At least 20 messages must have been exchanged in the session
//   - Credits KSH 100 (10000 cents) to the user's Chat Foreigners wallet
//   - Marks the bot access as closed — requires fresh KSH 100 payment to re-unlock
// ========================================================================
export async function closeChat(botId: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = (currentUser as any)._id;

    // Find active (non-closed) access
    const access = await ChatForeignersBotAccess.findOne({
      user_id: userId,
      bot_id: botId,
      isClosed: { $ne: true },
    });

    if (!access) {
      return { success: false, error: 'No active chat session found' };
    }

    // Require at least 20 messages exchanged
    const MIN_MESSAGES = 20;
    if ((access.messageCount || 0) < MIN_MESSAGES) {
      return {
        success: false,
        error: `You need at least ${MIN_MESSAGES} messages to close this chat and receive your reward. You have sent ${access.messageCount || 0} so far.`,
        messageCount: access.messageCount || 0,
        required: MIN_MESSAGES,
      };
    }

    // Guard: only credit once per session
    if (access.chatCreditPaid) {
      // Still close the session even if credit was somehow already paid
      access.isClosed = true;
      access.closedAt = new Date();
      await access.save();
      return { success: true, alreadyCredited: true };
    }

    const CHAT_CREDIT_CENTS = 10000; // KSH 100

    // Credit user's Chat Foreigners wallet (non-withdrawable)
    let wallet = await ChatForeignersWallet.findOne({ user_id: userId });
    if (!wallet) {
      wallet = new ChatForeignersWallet({ user_id: userId, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
    }
    wallet.balance_cents += CHAT_CREDIT_CENTS;
    wallet.total_earned_cents += CHAT_CREDIT_CENTS;
    await wallet.save();

    // Record the transaction
    await ChatForeignersTransaction.create({
      user_id: userId,
      amount_cents: CHAT_CREDIT_CENTS,
      type: 'CHAT_EARNINGS',
      description: 'Chat session completed reward (non-withdrawable)',
      status: 'completed',
      target_type: 'user',
      target_id: userId.toString(),
    });

    // Mark access as closed and credit paid
    access.isClosed = true;
    access.closedAt = new Date();
    access.chatCreditPaid = true;
    await access.save();

    console.log('[ChatForeigners] Chat closed and credited:', {
      userId,
      botId,
      credit: CHAT_CREDIT_CENTS / 100,
      messageCount: access.messageCount,
    });

    return {
      success: true,
      data: {
        creditAmount: CHAT_CREDIT_CENTS / 100,
        walletBalance: wallet.balance_cents / 100,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Close chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}
