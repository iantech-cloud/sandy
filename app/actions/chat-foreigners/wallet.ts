'use server';

import { connectToDatabase, ChatForeignersWallet, ChatForeignersTransaction, ChatForeignersProfile, Profile } from '@/app/lib/models';
import { auth } from '@/auth';

// ========================================================================
// Helper: Get Current User from Session
// ========================================================================
async function getCurrentUserFromSession() {
  let session: any;
  try {
    session = await auth();
  } catch {
    return null;
  }
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
// Get Chat Foreigners Wallet
// ========================================================================
export async function getChatForeignersWallet() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    let wallet = await ChatForeignersWallet.findOne({
      user_id: currentUser._id,
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await ChatForeignersWallet.create({
        user_id: currentUser._id,
      });
    }

    return {
      success: true,
      data: {
        balance_cents: wallet.balance_cents,
        total_earned_cents: wallet.total_earned_cents,
        total_deposited_cents: wallet.total_deposited_cents,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Wallet fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Get Wallet Transactions
// ========================================================================
export async function getChatForeignersWalletTransactions(limit = 20, skip = 0) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const transactions = await ChatForeignersTransaction.find({
      user_id: currentUser._id,
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip);

    const total = await ChatForeignersTransaction.countDocuments({
      user_id: currentUser._id,
    });

    return {
      success: true,
      data: {
        transactions: transactions.map((t) => ({
          id: t._id.toString(),
          amount_cents: t.amount_cents,
          type: t.type,
          description: t.description,
          status: t.status,
          createdAt: t.created_at,
        })),
        total,
        limit,
        skip,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Transactions fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Get or Create Chat Foreigners Profile
// ========================================================================
export async function getChatForeignersProfile() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    let profile = await ChatForeignersProfile.findOne({
      user_id: currentUser._id,
    });

    if (!profile) {
      // Generate referral code
      const referralCode = generateReferralCode();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const referralLink = `${appUrl}/dashboard/chat-foreigners?ref=${referralCode}`;

      profile = await ChatForeignersProfile.create({
        user_id: currentUser._id,
        displayName: currentUser.username,
        referralCode,
        referralLink,
      });
    }

    return {
      success: true,
      data: {
        displayName: profile.displayName,
        bio: profile.bio,
        referralCode: profile.referralCode,
        referralLink: profile.referralLink,
        totalBotUnlocks: profile.totalBotUnlocks,
        totalEarnings_cents: profile.totalEarnings_cents,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Profile fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
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
