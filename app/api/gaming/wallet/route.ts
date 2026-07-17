// app/api/gaming/wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, GamingWallet } from '@/app/lib/models';
import { findGamingWalletOptimized } from '@/app/lib/db-queries';

/**
 * GET /api/gaming/wallet
 * Fetch the authenticated user's gaming wallet balance and stats
 * Returns: { balance_cents, total_deposited_cents, total_wagered_cents, total_lost_cents, updated_at }
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth();
    if (!session?.user?.email) {
      console.log('[v0] Gaming Wallet: No session/email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by email
    const profile = await Profile.findOne({ email: session.user.email }).lean();
    if (!profile) {
      console.log('[v0] Gaming Wallet: Profile not found for email:', session.user.email);
      return NextResponse.json(
        { error: 'User profile not found', success: false },
        { status: 404 }
      );
    }

    const userId = profile._id.toString();
    console.log('[v0] Gaming Wallet: Fetching wallet for userId:', userId);

    // Get gaming wallet using optimized query (with cache)
    let wallet = await findGamingWalletOptimized(userId);

    // If no wallet exists yet, create one with zero balance
    if (!wallet) {
      console.log('[v0] Gaming Wallet: Creating new wallet for user:', userId);
      const newWallet = new GamingWallet({
        user_id: userId,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_wagered_cents: 0,
        total_lost_cents: 0,
      });
      await newWallet.save();
      wallet = newWallet.toObject();
    }

    return NextResponse.json({
      success: true,
      balance_cents: wallet.balance_cents || 0,
      total_deposited_cents: wallet.total_deposited_cents || 0,
      total_wagered_cents: wallet.total_wagered_cents || 0,
      total_lost_cents: wallet.total_lost_cents || 0,
      updated_at: wallet.updated_at,
    });
  } catch (error) {
    console.error('[v0] Gaming Wallet API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gaming wallet', success: false },
      { status: 500 }
    );
  }
}
