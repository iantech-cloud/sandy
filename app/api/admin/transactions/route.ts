import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, ChatForeignersTransaction } from '@/app/lib/models';

const TYPE_LABELS: Record<string, string> = {
  REFERRAL:            'Referral Bonus',
  ACTIVATION_FEE:      'Account Activation Fee',
  ACCOUNT_ACTIVATION:  'Account Activated',
  DEPOSIT:             'Wallet Deposit',
  WITHDRAWAL:          'Withdrawal',
  BONUS:               'Bonus',
  TASK_PAYMENT:        'Task Payment',
  SPIN_WIN:            'Spin Win',
  SPIN_PRIZE:          'Spin Prize',
  SPIN_COST:           'Spin Entry Cost',
  SPIN_WALLET_DEPOSIT: 'Spin Wallet Deposit',
  SURVEY:              'Survey Reward',
  SURVEY_REVOKE:       'Survey Reward Revoked',
  ADMIN_CREDIT:        'Admin Credit',
  ADMIN_DEBIT:         'Admin Debit',
  COMPANY_REVENUE:     'Platform Fee',
  UNCLAIMED_REFERRAL:  'Unclaimed Referral',
};

const CF_TYPE_LABELS: Record<string, string> = {
  CHAT_DEPOSIT:          'Chat Wallet Deposit',
  CHAT_MESSAGE_EARNING:  'Chat Message Earning',
  CHAT_WITHDRAWAL:       'Chat Wallet Withdrawal',
  CHAT_REFERRAL_EARNING: 'Chat Foreigners Referral Earnings',
  CHAT_EARNINGS:         'Chat Foreigners Platform Fee',
};

const DEBIT_TYPES = new Set([
  'WITHDRAWAL', 'ACTIVATION_FEE', 'SPIN_COST', 'ADMIN_DEBIT',
  'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY_REVOKE',
]);

// Transaction types that represent real platform payouts to users
// (excludes DEPOSIT — that is user-funded money deposited INTO the platform, not a payout)
const PAYOUT_TYPES = [
  'WITHDRAWAL', 'REFERRAL', 'TASK_PAYMENT', 'BONUS',
  'SPIN_WIN', 'SPIN_PRIZE', 'SPIN_WALLET_DEPOSIT',
  'SURVEY', 'ADMIN_CREDIT',
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await Profile.findOne({ email: session.user.email }).select('role').lean();
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page       = Math.max(parseInt(searchParams.get('page')  || '1'),  1);
    const limit      = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status     = searchParams.get('status')     || 'all';
    const sourceType = searchParams.get('sourceType') || 'all';
    const coopRef    = searchParams.get('coopRef')    || '';
    const mpesaRef   = searchParams.get('mpesaRef')   || '';
    const dateFrom   = searchParams.get('dateFrom')   || '';
    const dateTo     = searchParams.get('dateTo')     || '';
    const collection = searchParams.get('collection') || 'all';
    const skip       = (page - 1) * limit;

    const mongoose = (await import('mongoose')).default;
    const LegacyTransaction = mongoose.models['Transaction'] || null;

    // ─── Date range ──────────────────────────────────────────────
    const dateRange: any = {};
    if (dateFrom || dateTo) {
      dateRange.created_at = {};
      if (dateFrom) dateRange.created_at.$gte = new Date(dateFrom);
      if (dateTo)   dateRange.created_at.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    // ─── Legacy filter ───────────────────────────────────────────
    let legacyMatch: any = { ...dateRange };
    if (status !== 'all')  legacyMatch.status = status;
    if (coopRef)           legacyMatch.transaction_code = new RegExp(coopRef, 'i');
    if (sourceType === 'downline') legacyMatch.type = 'REFERRAL';
    else if (sourceType === 'direct') legacyMatch.type = { $ne: 'REFERRAL' };

    // ─── CF filter ───────────────────────────────────────────────
    let cfMatch: any = { ...dateRange };
    if (status !== 'all')  cfMatch.status = status;
    if (sourceType === 'downline') cfMatch.type = 'CHAT_REFERRAL_EARNING';
    else if (sourceType === 'direct') cfMatch.type = { $ne: 'CHAT_REFERRAL_EARNING' };

    const fetchLegacy = collection !== 'cf'     && !!LegacyTransaction;
    const fetchCF     = collection !== 'legacy';

    // If mpesaRef filter is set, join MpesaTransaction first to find eligible IDs
    // This avoids a $toObjectId conversion error and works with both ObjectId and UUID user_id values
    let legacyMpesaIds: any[] | null = null;
    if (mpesaRef && fetchLegacy && LegacyTransaction) {
      const MpesaTxn = mongoose.models['MpesaTransaction'] || null;
      if (MpesaTxn) {
        const matched = await MpesaTxn.find(
          { mpesa_receipt_number: new RegExp(mpesaRef, 'i') },
          { _id: 1 }
        ).lean();
        legacyMpesaIds = matched.map((m: any) => m._id);
      }
    }
    if (legacyMpesaIds !== null) {
      legacyMatch.mpesa_transaction_id = { $in: legacyMpesaIds };
    }

    // ─── $facet: paginated data + all-time totals in one query ───
    const [legacyResult, cfResult] = await Promise.all([
      fetchLegacy
        ? LegacyTransaction.aggregate([
            { $match: legacyMatch },
            {
              $facet: {
                data: [
                  { $sort: { created_at: -1 } },
                  { $skip: skip },
                  { $limit: limit },
                  // Safe lookup — no $toObjectId needed; user_id stored as ObjectId in legacy
                  {
                    $lookup: {
                      from: 'profiles',
                      localField: 'user_id',
                      foreignField: '_id',
                      as: '_profile',
                    },
                  },
                  {
                    $addFields: {
                      _profile: {
                        $cond: [
                          { $eq: [{ $size: '$_profile' }, 0] },
                          [{ username: 'Unknown', email: 'N/A' }],
                          '$_profile',
                        ],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: 'mpesatransactions',
                      localField: 'mpesa_transaction_id',
                      foreignField: '_id',
                      as: '_mpesa',
                    },
                  },
                ],
                totalCount:    [{ $count: 'n' }],
                // Revenue = money into the company
                totalRevenue:  [
                  { $match: { target_type: 'company' } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                // Payouts = money the PLATFORM pays OUT to users
                // Excludes DEPOSIT (user-funded) — those inflate the figure incorrectly
                totalPayouts:  [
                  { $match: { type: { $in: PAYOUT_TYPES } } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                completedCount: [{ $match: { status: 'completed' } }, { $count: 'n' }],
                pendingCount:   [{ $match: { status: 'pending'   } }, { $count: 'n' }],
                failedCount:    [{ $match: { status: 'failed'    } }, { $count: 'n' }],
              },
            },
          ])
        : Promise.resolve([{
            data: [], totalCount: [], totalRevenue: [], totalPayouts: [],
            completedCount: [], pendingCount: [], failedCount: [],
          }]),

      fetchCF
        ? (ChatForeignersTransaction as any).aggregate([
            { $match: cfMatch },
            {
              $facet: {
                data: [
                  { $sort: { created_at: -1 } },
                  { $skip: skip },
                  { $limit: limit },
                  {
                    $lookup: {
                      from: 'profiles',
                      localField: 'user_id',
                      foreignField: '_id',
                      as: '_profile',
                    },
                  },
                  {
                    $addFields: {
                      _profile: {
                        $cond: [
                          { $eq: [{ $size: '$_profile' }, 0] },
                          [{ username: 'Unknown', email: 'N/A' }],
                          '$_profile',
                        ],
                      },
                    },
                  },
                ],
                totalCount:    [{ $count: 'n' }],
                totalRevenue:  [
                  { $match: { target_type: 'company' } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                // CF payouts = money going to users (CHAT_MESSAGE_EARNING, CHAT_REFERRAL_EARNING)
                // Excludes CHAT_DEPOSIT (user-funded)
                totalPayouts:  [
                  { $match: { type: { $in: ['CHAT_MESSAGE_EARNING', 'CHAT_REFERRAL_EARNING'] } } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                completedCount: [{ $match: { status: 'completed' } }, { $count: 'n' }],
                pendingCount:   [{ $match: { status: 'pending'   } }, { $count: 'n' }],
                failedCount:    [{ $match: { status: 'failed'    } }, { $count: 'n' }],
              },
            },
          ])
        : Promise.resolve([{
            data: [], totalCount: [], totalRevenue: [], totalPayouts: [],
            completedCount: [], pendingCount: [], failedCount: [],
          }]),
    ]);

    const lr = legacyResult[0];
    const cr = cfResult[0];

    // ─── Normalise rows ──────────────────────────────────────────
    const normLegacy = (txn: any) => {
      const isDebit  = DEBIT_TYPES.has(txn.type);
      const meta     = txn.metadata || {};
      const mpesa    = txn._mpesa?.[0];
      const profile  = txn._profile?.[0];

      let description = txn.description || TYPE_LABELS[txn.type] || txn.type;
      if (txn.type === 'REFERRAL') {
        const level = meta.level === 2 ? 'Level 2 (KES 10)' : 'Level 1 (KES 65)';
        description = `Referral commission – ${meta.source === 'chat_foreigners_unlock' ? `CF bot unlock, ${level}` : description}`;
      } else if (txn.type === 'ACTIVATION_FEE') {
        description = 'Account activation fee paid';
      }

      return {
        id:               txn._id?.toString(),
        user_id:          txn.user_id?.toString() || 'N/A',
        user_email:       profile?.email    || 'N/A',
        user_username:    profile?.username || 'N/A',
        amount:           (txn.amount_cents || 0) / 100,
        amount_cents:     txn.amount_cents  || 0,
        transaction_type: isDebit ? 'debit' : 'credit',
        type:             txn.type     || 'N/A',
        type_label:       TYPE_LABELS[txn.type] || txn.type || 'N/A',
        source:           txn.source   || txn.type || 'N/A',
        target_type:      txn.target_type || 'user',
        target:           txn.target_type === 'company' ? 'Company' : 'User Wallet',
        earning_source_type: txn.type === 'REFERRAL' ? 'downline' : 'direct',
        status:           txn.status   || 'N/A',
        description,
        date:             txn.created_at,
        // Coop bank reference stored in transaction_code (e.g. SPINDY17821278547008CYHDH)
        coop_reference_id:  txn.transaction_code || null,
        // M-Pesa receipt number from the linked MpesaTransaction document (e.g. UFM248OFZF)
        mpesa_reference_id: mpesa?.mpesa_receipt_number || null,
        balance_after:    txn.balance_after_cents != null ? txn.balance_after_cents / 100 : null,
        collection:       'legacy',
      };
    };

    const normCF = (txn: any) => {
      const profile = txn._profile?.[0];
      return {
        id:               txn._id?.toString(),
        user_id:          txn.user_id?.toString() || 'N/A',
        user_email:       profile?.email    || 'N/A',
        user_username:    profile?.username || 'N/A',
        amount:           (txn.amount_cents || 0) / 100,
        amount_cents:     txn.amount_cents  || 0,
        transaction_type: txn.target_type === 'company' ? 'debit' : 'credit',
        type:             txn.type     || 'N/A',
        type_label:       CF_TYPE_LABELS[txn.type] || txn.type || 'N/A',
        source:           txn.type     || 'chat_foreigners',
        target_type:      txn.target_type || 'user',
        target:           txn.target_type === 'company' ? 'Company' : 'User Wallet',
        earning_source_type: txn.type === 'CHAT_REFERRAL_EARNING' ? 'downline' : 'direct',
        status:           txn.status   || 'N/A',
        description:      txn.description || CF_TYPE_LABELS[txn.type] || 'Chat Foreigners Transaction',
        date:             txn.created_at,
        coop_reference_id:  null,
        mpesa_reference_id: null,
        balance_after:    null,
        collection:       'chat_foreigners',
      };
    };

    const rows = [
      ...(lr.data || []).map(normLegacy),
      ...(cr.data || []).map(normCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
     .slice(0, limit);

    // ─── All-time totals from $facet (not current-page only) ─────
    const totalCount = (lr.totalCount[0]?.n || 0) + (cr.totalCount[0]?.n || 0);
    const pages      = Math.max(Math.ceil(totalCount / limit), 1);

    const summary = {
      totalCount,
      totalRevenue:   ((lr.totalRevenue[0]?.total  || 0) + (cr.totalRevenue[0]?.total  || 0)) / 100,
      totalPayouts:   ((lr.totalPayouts[0]?.total  || 0) + (cr.totalPayouts[0]?.total  || 0)) / 100,
      completedCount: (lr.completedCount[0]?.n || 0) + (cr.completedCount[0]?.n || 0),
      pendingCount:   (lr.pendingCount[0]?.n   || 0) + (cr.pendingCount[0]?.n   || 0),
      failedCount:    (lr.failedCount[0]?.n    || 0) + (cr.failedCount[0]?.n    || 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        transactions: rows,
        summary,
        count: rows.length,
        pagination: { page, limit, total: totalCount, pages },
      },
    });

  } catch (error) {
    console.error('Admin transactions API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
