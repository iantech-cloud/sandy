import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Referral } from '@/app/lib/models';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20')));
    const skip  = (page - 1) * limit;

    // Get current user — only need _id and role
    const currentUser = await Profile.findOne(
      { email: session.user.email },
      { _id: 1, role: 1 }
    ).lean();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId   = currentUser._id;
    const userRole = (currentUser as any).role || 'user';

    // For non-admin/support: always scope to the current user's own referrals
    const matchStage = userRole === 'admin'
      ? {}
      : { referrer_id: userId.toString() };

    // ── 1. Count (fast — uses the referrer_id index) ─────────────────────────
    const LegacyTransaction = mongoose.models['Transaction'] || null;

    const [totalCount, summaryAgg, referralDocs, earningsAgg] = await Promise.all([
      // Total count for pagination
      Referral.countDocuments(matchStage),

      // Summary: total/active/activated counts via aggregation (no populate)
      Referral.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'profiles',
            let: { rid: '$referred_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: [{ $toString: '$_id' }, '$$rid'] },
                },
              },
              { $project: { status: 1, is_verified: 1, activation_paid_at: 1 } },
            ],
            as: '_p',
          },
        },
        {
          $group: {
            _id: null,
            total:     { $sum: 1 },
            active:    { $sum: { $cond: [{ $eq: [{ $arrayElemAt: ['$_p.status', 0] }, 'active']  }, 1, 0] } },
            pending:   { $sum: { $cond: [{ $eq: [{ $arrayElemAt: ['$_p.status', 0] }, 'pending'] }, 1, 0] } },
            activated: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq:  [{ $arrayElemAt: ['$_p.is_verified', 0] }, true] },
                      { $gt:  [{ $arrayElemAt: ['$_p.activation_paid_at', 0] }, null] },
                    ],
                  },
                  1, 0,
                ],
              },
            },
          },
        },
      ]),

      // Paginated referral rows with profile join — project only needed fields
      Referral.aggregate([
        { $match: matchStage },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'profiles',
            let: { rid: '$referred_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: [{ $toString: '$_id' }, '$$rid'] },
                },
              },
              {
                $project: {
                  username: 1,
                  email: 1,
                  status: 1,
                  created_at: 1,
                  is_verified: 1,
                  activation_paid_at: 1,
                  referral_bonus_amount_cents: 1,
                },
              },
            ],
            as: '_p',
          },
        },
        {
          $project: {
            _id: 1,
            referrer_id: 1,
            referred_id: 1,
            referral_bonus_amount_cents: 1,
            created_at: 1,
            _p: { $arrayElemAt: ['$_p', 0] },
          },
        },
      ]),

      // Per-referred-user earnings: aggregate from Transaction collection
      LegacyTransaction
        ? LegacyTransaction.aggregate([
            {
              $match: {
                user_id: userId.toString(),
                type: 'REFERRAL',
                status: 'completed',
              },
            },
            {
              $group: {
                _id: {
                  $ifNull: [
                    '$metadata.referred_user_id',
                    '$metadata.referredUser',
                  ],
                },
                total: { $sum: '$amount_cents' },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    // Build earnings lookup map { referred_user_id_str => amount_cents }
    const earningsMap = new Map<string, number>();
    for (const e of (earningsAgg as any[])) {
      if (e._id) earningsMap.set(e._id.toString(), e.total);
    }

    // Total earnings for summary card
    const totalEarningsCents = Array.from(earningsMap.values()).reduce((a, b) => a + b, 0);

    // Shape referral rows
    const referrals = referralDocs.map((ref: any) => {
      const p            = ref._p || {};
      const referredIdStr = ref.referred_id?.toString() || '';
      const txEarnings    = earningsMap.get(referredIdStr) || 0;
      const earnings      = txEarnings > 0 ? txEarnings : (ref.referral_bonus_amount_cents || 0);

      return {
        id:               ref._id.toString(),
        name:             p.username || 'Unknown User',
        email:            p.email    || '',
        joinDate:         p.created_at || null,
        status:           p.status   || 'active',
        activationStatus: (p.is_verified || p.activation_paid_at) ? 'activated' : 'not_activated',
        earnings:         earnings / 100,
      };
    });

    const s = summaryAgg[0] || { total: 0, active: 0, pending: 0, activated: 0 };

    return NextResponse.json({
      success: true,
      data: referrals,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      summary: {
        total:         s.total,
        active:        s.active,
        pending:       s.pending,
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
