import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Referral, Transaction } from '@/app/lib/models';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20')));
    const skip  = (page - 1) * limit;

    // Always scope to the requesting user — this is the user dashboard route.
    const currentUser = await Profile.findOne(
      { email: session.user.email },
      { _id: 1 }
    ).lean();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // referrer_id in the Referral schema is stored as String (not ObjectId)
    const userIdStr = (currentUser as any)._id.toString();

    // The match filter — always scoped to this user. Uses the referrer_id index.
    const userMatch = { referrer_id: userIdStr };

    // ── Run 4 fast queries in parallel ─────────────────────────────────────────
    // 1. countDocuments  — hits referrer_id index directly, returns in <5 ms
    // 2. summaryAgg      — $group on already-filtered docs then $lookup profiles
    // 3. pageFacet       — paginated rows with profile join
    // 4. earningsAgg     — per-referred-user earnings from Transaction collection
    //
    // The $lookup uses $addFields + $toObjectId so the profiles._id index is used
    // instead of a full collection scan with $toString on every document.

    const [totalCount, summaryResult, pageResult, earningsResult] = await Promise.all([

      // 1. Fast count via index
      Referral.countDocuments(userMatch),

      // 2. Summary stats — group after lookup
      Referral.aggregate([
        { $match: userMatch },
        {
          // Direct String-to-String lookup: referred_id and Profile._id are both UUID strings
          $lookup: {
            from: 'profiles',
            localField: 'referred_id',
            foreignField: '_id',
            as: '_p',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: [{ $arrayElemAt: ['$_p.status', 0] }, 'active'] }, 1, 0] },
            },
            activated: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq:  [{ $arrayElemAt: ['$_p.is_verified', 0] }, true] },
                      { $ifNull: [{ $arrayElemAt: ['$_p.activation_paid_at', 0] }, false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]).exec(),

      // 3. Paginated rows — sort then lookup
      Referral.aggregate([
        { $match: userMatch },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          // Direct String-to-String lookup: referred_id and Profile._id are both UUID strings
          $lookup: {
            from: 'profiles',
            localField: 'referred_id',
            foreignField: '_id',
            as: '_p',
          },
        },
        // Extract the first (and only) matched profile as a sub-document.
        // $addFields is required here — $let inside $project cannot reference
        // fields produced by a prior $lookup stage on some MongoDB versions.
        {
          $addFields: {
            profile: { $arrayElemAt: ['$_p', 0] },
          },
        },
        {
          $project: {
            _id: 1,
            referred_id: 1,
            referral_bonus_amount_cents: 1,
            created_at: 1,
            profile: {
              username:           1,
              email:              1,
              status:             1,
              created_at:         1,
              is_verified:        1,
              activation_paid_at: 1,
            },
          },
        },
      ]).exec(),

      // 4. Earnings per referred user from the Transaction collection
      Transaction.aggregate([
        {
          $match: {
            user_id: userIdStr,
            type: 'REFERRAL',
            status: 'completed',
          },
        },
        {
          $group: {
            _id: {
              $ifNull: ['$metadata.referred_user_id', '$metadata.referredUser'],
            },
            total: { $sum: '$amount_cents' },
          },
        },
      ]).exec(),
    ]);

    // Build earnings map  { referred_user_id_string => total_cents }
    const earningsMap = new Map<string, number>();
    for (const e of (earningsResult as { _id: any; total: number }[])) {
      if (e._id) earningsMap.set(e._id.toString(), e.total);
    }

    const totalEarningsCents = Array.from(earningsMap.values()).reduce((a, b) => a + b, 0);

    // Shape rows
    const referrals = pageResult.map((ref: any) => {
      const p             = ref.profile || {};
      const referredIdStr = ref.referred_id?.toString() || '';
      const txEarnings    = earningsMap.get(referredIdStr) || 0;
      // Prefer real transaction earnings; fall back to the bonus recorded on the referral doc
      const earningsCents = txEarnings > 0 ? txEarnings : (ref.referral_bonus_amount_cents || 0);

      return {
        id:               ref._id.toString(),
        name:             p.username  || null,
        email:            p.email     || '',
        joinDate:         p.created_at || null,
        status:           p.status    || 'active',
        activationStatus: (p.is_verified || p.activation_paid_at) ? 'activated' : 'not_activated',
        earnings:         earningsCents / 100,
      };
    });

    const s = (summaryResult as any[])[0] || { total: 0, active: 0, activated: 0 };

    return NextResponse.json({
      success: true,
      data: referrals,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.max(1, Math.ceil(totalCount / limit)),
      },
      summary: {
        total:         s.total,
        active:        s.active,
        activated:     s.activated,
        totalEarnings: totalEarningsCents / 100,
      },
    });

  } catch (error) {
    console.error('Referrals API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
