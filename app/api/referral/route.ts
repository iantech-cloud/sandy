import { connectToDatabase } from '@/app/lib/models';
import { Profile, TransactionLedger } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

interface ReferralEntry {
  referrer_id: string;
  referred_user_id: string;
  referral_code: string;
  bonus_earned_cents: number;
  triggered_by: string; // 'premium_purchase' | 'task_completion' | 'activation'
  status: 'pending' | 'approved' | 'paid';
  created_at: Date;
  approved_at?: Date;
}

// Simple in-memory store for referrals (should use MongoDB in production)
const referrals: ReferralEntry[] = [];

/**
 * POST /api/referral/track
 * Track when a referred user completes an action
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { referred_user_id, referrer_id, action_type } = body;

    if (!referred_user_id || !referrer_id || !action_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    let bonusAmountCents = 0;

    // Different bonus amounts based on action
    switch (action_type) {
      case 'premium_purchase':
        bonusAmountCents = 50000; // KES 500
        break;
      case 'task_completion':
        bonusAmountCents = 20000; // KES 200
        break;
      case 'activation':
        bonusAmountCents = 5000; // KES 50
        break;
      default:
        bonusAmountCents = 0;
    }

    if (bonusAmountCents === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid action type' 
      }, { status: 400 });
    }

    // Check if referral already tracked
    const existingReferral = referrals.find(r => 
      r.referred_user_id === referred_user_id && 
      r.referrer_id === referrer_id &&
      r.triggered_by === action_type
    );

    if (existingReferral && existingReferral.status === 'paid') {
      return NextResponse.json({ 
        success: false, 
        message: 'Referral bonus already paid for this action' 
      }, { status: 400 });
    }

    // Create referral entry
    const referralEntry: ReferralEntry = {
      referrer_id,
      referred_user_id,
      referral_code: `REF-${Date.now()}`,
      bonus_earned_cents: bonusAmountCents,
      triggered_by: action_type,
      status: 'pending',
      created_at: new Date()
    };

    referrals.push(referralEntry);

    return NextResponse.json({
      success: true,
      message: 'Referral tracked successfully',
      data: referralEntry
    });
  } catch (error: any) {
    console.error('[Referral API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/referral/stats
 * Get referral statistics for a user
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getSession({ req });
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's referrals
    const userReferrals = referrals.filter(r => r.referrer_id === userId);

    // Calculate stats
    const stats = {
      total_referrals: userReferrals.length,
      pending_bonuses_cents: userReferrals
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + r.bonus_earned_cents, 0),
      paid_bonuses_cents: userReferrals
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + r.bonus_earned_cents, 0),
      referral_link: `${process.env.BASE_URL}?ref=${session.user?.referral_id || 'UNKNOWN'}`
    };

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        referrals: userReferrals
      }
    });
  } catch (error: any) {
    console.error('[Referral Stats API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
