'use server';

import { connectToDatabase, ChatForeignersPayment, ChatForeignersMpesaTransaction, ChatForeignersWallet, ChatForeignersTransaction, ChatForeignersReferralEarning, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersProfile, Profile, Referral } from '@/app/lib/models';
import { CoopBankService } from '@/app/lib/services/coop-bank';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import crypto from 'crypto';

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

    // Get bot to get unlock cost
    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    // Check if user already has access to this bot
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id,
      bot_id: botId,
    });

    if (existingAccess) {
      return { success: false, error: 'You already have access to this bot' };
    }

    // Create M-Pesa transaction record
    const mpesaTransaction = await ChatForeignersMpesaTransaction.create({
      user_id: currentUser._id,
      amount_cents: bot.unlockCost_cents,
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
      amount_cents: bot.unlockCost_cents,
      phone_number: phoneNumber,
      mpesa_transaction_id: mpesaTransaction._id,
      status: 'pending',
    });

    // Call Co-op Bank STK Push
    const accountRef = `CHAT_${botId}_${currentUser._id}`.substring(0, 14);
    const messageRef = crypto.randomBytes(16).toString("hex");

    console.log('[ChatForeigners] Initiating STK push:', {
      checkoutRequestId: messageRef,
      amount: bot.unlockCost_cents / 100,
      phone: phoneNumber,
      botId,
    });

    const coopResponse = await CoopBankService.stkPush({
      amount: Math.round(bot.unlockCost_cents / 100),
      phone: phoneNumber,
      accountRef,
      messageRef,
    });

    if (!coopResponse.CheckoutRequestID) {
      await ChatForeignersPayment.updateOne(
        { _id: payment._id },
        { status: 'failed' }
      );
      return {
        success: false,
        error: 'Failed to initiate payment. Please try again.',
        code: coopResponse.ResponseCode,
      };
    }

    // Update M-Pesa transaction with STK response
    mpesaTransaction.checkout_request_id = coopResponse.CheckoutRequestID;
    mpesaTransaction.merchant_request_id = coopResponse.MerchantRequestID;
    mpesaTransaction.stk_push_response = coopResponse;
    await mpesaTransaction.save();

    console.log('[ChatForeigners] STK push initiated:', {
      checkoutRequestId: coopResponse.CheckoutRequestID,
      paymentId: payment._id,
    });

    return {
      success: true,
      data: {
        paymentId: payment._id.toString(),
        checkoutRequestId: coopResponse.CheckoutRequestID,
        merchantRequestId: coopResponse.MerchantRequestID,
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

    // Create bot access record
    await ChatForeignersBotAccess.create(
      [
        {
          user_id: mpesaTransaction.user_id,
          bot_id: payment.bot_id,
          unlockedAt: new Date(),
        },
      ],
      { session }
    );

    // Get bot for costs
    const bot = await ChatForeignersBot.findById(payment.bot_id).session(session);
    if (!bot) {
      throw new Error('Bot not found');
    }

    // ----------------------------------------------------------------
    // Universal referral system: look up who referred this user via the
    // main Referral collection. This ensures the main site referrer
    // (whoever the user signed up under, defaulting to SANDY001 / the
    // main account) earns the Chat Foreigners commission automatically.
    // ----------------------------------------------------------------
    const referralRecord = await Referral.findOne({
      referred_id: mpesaTransaction.user_id,
    }).session(session);

    if (referralRecord) {
      const referrerId = referralRecord.referrer_id;

      // Check that referral earning doesn't already exist for this unlock
      const existingEarning = await ChatForeignersReferralEarning.findOne({
        referrer_id: referrerId,
        referee_id: mpesaTransaction.user_id,
        bot_id: payment.bot_id,
        earningType: 'initial_unlock',
      }).session(session);

      if (!existingEarning) {
        // Record referral earning (KES 60 = 6000 cents)
        const referralEarning = await ChatForeignersReferralEarning.create(
          [
            {
              referrer_id: referrerId,
              referee_id: mpesaTransaction.user_id,
              bot_id: payment.bot_id,
              earningType: 'initial_unlock',
              amount_cents: 6000,
              status: 'pending',
              payment_id: payment._id,
            },
          ],
          { session }
        );

        // Credit referrer's Chat Foreigners wallet
        let referrerWallet = await ChatForeignersWallet.findOne({
          user_id: referrerId,
        }).session(session);

        if (!referrerWallet) {
          referrerWallet = new ChatForeignersWallet({ user_id: referrerId, balance_cents: 0, total_earned_cents: 0, total_deposited_cents: 0 });
        }

        referrerWallet.balance_cents += 6000;
        referrerWallet.total_earned_cents += 6000;
        await referrerWallet.save({ session });

        // Record wallet transaction for referrer
        await ChatForeignersTransaction.create(
          [
            {
              user_id: referrerId,
              amount_cents: 6000,
              type: 'CHAT_EARNINGS',
              description: `Chat Foreigners commission: person unlocked by referred user`,
              status: 'completed',
              target_type: 'user',
              target_id: referrerId.toString(),
            },
          ],
          { session }
        );

        // Mark earning as completed
        if (referralEarning[0]) {
          referralEarning[0].status = 'completed';
          await referralEarning[0].save({ session });
        }

        console.log('[ChatForeigners] Universal referral commission paid:', {
          referrerId,
          botId: payment.bot_id,
          amount: 60,
        });
      }
    }

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

    // Call Co-op Bank STK Push
    const accountRef = `CHATDEP_${currentUser._id}`.substring(0, 14);
    const messageRef = crypto.randomBytes(16).toString("hex");

    console.log('[ChatForeigners] Initiating deposit STK push:', {
      checkoutRequestId: messageRef,
      amount: amountCents / 100,
      phone: phoneNumber,
    });

    const coopResponse = await CoopBankService.stkPush({
      amount: Math.round(amountCents / 100),
      phone: phoneNumber,
      accountRef,
      messageRef,
    });

    if (!coopResponse.CheckoutRequestID) {
      await ChatForeignersTransaction.updateOne(
        { _id: transaction._id },
        { status: 'failed' }
      );
      return {
        success: false,
        error: 'Failed to initiate deposit. Please try again.',
      };
    }

    // Update M-Pesa transaction with STK response
    mpesaTransaction.checkout_request_id = coopResponse.CheckoutRequestID;
    mpesaTransaction.merchant_request_id = coopResponse.MerchantRequestID;
    mpesaTransaction.stk_push_response = coopResponse;
    await mpesaTransaction.save();

    return {
      success: true,
      data: {
        transactionId: transaction._id.toString(),
        checkoutRequestId: coopResponse.CheckoutRequestID,
        merchantRequestId: coopResponse.MerchantRequestID,
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
