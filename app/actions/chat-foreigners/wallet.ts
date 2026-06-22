'use server';

import { connectToDatabase, ChatForeignersWallet, ChatForeignersTransaction, ChatForeignersProfile } from '@/app/lib/models';
import { getCurrentUserFromSession } from '@/app/lib/auth';
import { successResponse, errorResponse, ApiError, paginatedResponse } from '@/app/lib/responses';
import { validatePagination } from '@/app/lib/validation';
import { z } from 'zod';

// ========================================================================
// Get Chat Foreigners Wallet - Optimized with lean() and select()
// ========================================================================
export async function getChatForeignersWallet() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to view wallet');
    }

    let wallet = await ChatForeignersWallet.findOne({
      user_id: currentUser._id.toString(),
    })
      .select('balance_cents total_earned_cents total_deposited_cents downline_earnings_cents chat_earnings_cents')
      .lean()
      .exec();

    if (!wallet) {
      wallet = await ChatForeignersWallet.create({
        user_id: currentUser._id.toString(),
      });
    }

    return successResponse({
      balance_cents: (wallet as any).balance_cents || 0,
      balance: ((wallet as any).balance_cents || 0) / 100,
      total_earned_cents: (wallet as any).total_earned_cents || 0,
      total_earned: ((wallet as any).total_earned_cents || 0) / 100,
      total_deposited_cents: (wallet as any).total_deposited_cents || 0,
      total_deposited: ((wallet as any).total_deposited_cents || 0) / 100,
      downline_earnings_cents: (wallet as any).downline_earnings_cents || 0,
      downline_earnings: ((wallet as any).downline_earnings_cents || 0) / 100,
      chat_earnings_cents: (wallet as any).chat_earnings_cents || 0,
      chat_earnings: ((wallet as any).chat_earnings_cents || 0) / 100,
    });
  } catch (error) {
    console.error('[ChatForeigners] Wallet fetch error:', error);
    return ApiError.internal('Failed to retrieve wallet', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Get Wallet Transactions - Optimized with lean() and select()
// ========================================================================
export async function getChatForeignersWalletTransactions(limit = 20, skip = 0) {
  try {
    // Validate pagination parameters
    const paginationValidation = validatePagination({ limit, offset: skip });
    if (!paginationValidation.success) {
      return ApiError.validationError('Invalid pagination parameters');
    }

    const { limit: validLimit, offset: validSkip } = paginationValidation.data;

    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to view transactions');
    }

    const transactions = await ChatForeignersTransaction.find({
      user_id: currentUser._id.toString(),
    })
      .select('_id amount_cents type description status created_at')
      .sort({ created_at: -1 })
      .limit(validLimit)
      .skip(validSkip)
      .lean()
      .exec();

    const total = await ChatForeignersTransaction.countDocuments({
      user_id: currentUser._id.toString(),
    });

    return paginatedResponse(
      transactions.map((t: any) => ({
        id: t._id.toString(),
        amount_cents: t.amount_cents,
        amount: t.amount_cents / 100,
        type: t.type,
        description: t.description,
        status: t.status,
        createdAt: t.created_at,
      })),
      validLimit,
      validSkip,
      total,
      'Transactions retrieved successfully'
    );
  } catch (error) {
    console.error('[ChatForeigners] Transactions fetch error:', error);
    return ApiError.internal('Failed to retrieve transactions', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Get or Create Chat Foreigners Profile - Optimized with lean()
// ========================================================================
export async function getChatForeignersProfile() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to view profile');
    }

    let profile = await ChatForeignersProfile.findOne({
      user_id: currentUser._id.toString(),
    })
      .select('displayName bio referralCode referralLink totalBotUnlocks totalEarnings_cents')
      .lean()
      .exec();

    if (!profile) {
      // Generate referral code
      const referralCode = generateReferralCode();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const referralLink = `${appUrl}/dashboard/chat-foreigners?ref=${referralCode}`;

      profile = await ChatForeignersProfile.create({
        user_id: currentUser._id.toString(),
        displayName: (currentUser as any).username,
        referralCode,
        referralLink,
      });
    }

    return successResponse({
      displayName: (profile as any).displayName,
      bio: (profile as any).bio,
      referralCode: (profile as any).referralCode,
      referralLink: (profile as any).referralLink,
      totalBotUnlocks: (profile as any).totalBotUnlocks || 0,
      totalEarnings_cents: (profile as any).totalEarnings_cents || 0,
      totalEarnings: ((profile as any).totalEarnings_cents || 0) / 100,
    });
  } catch (error) {
    console.error('[ChatForeigners] Profile fetch error:', error);
    return ApiError.internal('Failed to retrieve profile', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Generate Referral Code (Helper)
// ========================================================================
function generateReferralCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
