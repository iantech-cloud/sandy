import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile, Referral, ChatForeignersReferralEarning, ChatForeignersBotAccess } from '@/app/lib/models';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session?.user || role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    // Get all users
    const users = await Profile.find({}, '_id username email referred_by referral_id created_at is_active').lean();
    // Get all referral records
    const referrals = await Referral.find({}).lean();
    // Get all CF referral earnings
    const cfEarnings = await ChatForeignersReferralEarning.find({ status: 'completed' }).lean();
    // Get all bot accesses
    const botAccesses = await ChatForeignersBotAccess.find({}).lean();

    // Build lookup maps
    const userMap: Record<string, any> = {};
    for (const u of users) {
      userMap[(u as any)._id.toString()] = u;
    }

    // Map referred_id => referrer_id from Referral collection
    const referralMap: Record<string, string> = {};
    for (const r of referrals) {
      referralMap[(r as any).referred_id.toString()] = (r as any).referrer_id.toString();
    }

    // Count CF earnings per referrer
    const cfEarningsByReferrer: Record<string, number> = {};
    const cfUnlocksByReferrer: Record<string, number> = {};
    for (const e of cfEarnings) {
      const rid = (e as any).referrer_id.toString();
      cfEarningsByReferrer[rid] = (cfEarningsByReferrer[rid] || 0) + (e as any).amount_cents;
      if ((e as any).earningType === 'initial_unlock') {
        cfUnlocksByReferrer[rid] = (cfUnlocksByReferrer[rid] || 0) + 1;
      }
    }

    // Count direct downlines per referrer
    const downlineCount: Record<string, number> = {};
    for (const r of referrals) {
      const rid = (r as any).referrer_id.toString();
      downlineCount[rid] = (downlineCount[rid] || 0) + 1;
    }

    // Bot access stats per user
    const botAccessByUser: Record<string, number> = {};
    const messagesByUser: Record<string, number> = {};
    const milestoneByUser: Record<string, number> = {};
    for (const a of botAccesses) {
      const uid = (a as any).user_id.toString();
      botAccessByUser[uid] = (botAccessByUser[uid] || 0) + 1;
      messagesByUser[uid] = (messagesByUser[uid] || 0) + ((a as any).messageCount || 0);
      if ((a as any).firstMilestoneComplete) {
        milestoneByUser[uid] = (milestoneByUser[uid] || 0) + 1;
      }
    }

    // Build user list with referral chain
    const userList = users.map((u: any) => {
      const uid = u._id.toString();
      const referrerId = referralMap[uid];
      const referrer = referrerId ? userMap[referrerId] : null;

      return {
        id: uid,
        username: u.username,
        email: u.email,
        isActive: u.is_active,
        createdAt: u.created_at,
        referrerId: referrerId || null,
        referrerUsername: referrer?.username || null,
        directDownlines: downlineCount[uid] || 0,
        cfBotsUnlocked: botAccessByUser[uid] || 0,
        cfMessages: messagesByUser[uid] || 0,
        cfMilestonesReached: milestoneByUser[uid] || 0,
        cfEarnings: cfEarningsByReferrer[uid] || 0,
        cfUnlocksBrought: cfUnlocksByReferrer[uid] || 0,
      };
    });

    // Top referrers by CF earnings
    const topReferrers = [...userList]
      .filter((u) => u.cfEarnings > 0)
      .sort((a, b) => b.cfEarnings - a.cfEarnings)
      .slice(0, 20);

    // Recently referred (newest users with a referrer)
    const recentlyReferred = [...userList]
      .filter((u) => u.referrerId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 30);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: users.length,
        totalReferredUsers: referrals.length,
        totalCFEarnings: Object.values(cfEarningsByReferrer).reduce((a, b) => a + b, 0),
        topReferrers,
        recentlyReferred,
        allUsers: userList,
      },
    });
  } catch (error) {
    console.error('[CF Admin Downline] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
