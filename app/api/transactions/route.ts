import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase, ChatForeignersTransaction, ChatForeignersWallet } from '@/app/lib/models';
import { auth } from '@/auth';

const TYPE_LABELS: Record<string, string> = {
  REFERRAL:              'Referral Bonus',
  ACTIVATION_FEE:        'Account Activation Fee',
  ACCOUNT_ACTIVATION:    'Account Activation',
  DEPOSIT:               'Wallet Deposit',
  WITHDRAWAL:            'Withdrawal',
  BONUS:                 'Bonus',
  TASK_PAYMENT:          'Task Payment',
  SPIN_WIN:              'Spin Win',
  SPIN_PRIZE:            'Spin Prize',
  SPIN_COST:             'Spin Entry Cost',
  SPIN_WALLET_DEPOSIT:   'Spin Wallet Deposit',
  SURVEY:                'Survey Reward',
  SURVEY_REVOKE:         'Survey Reward Revoked',
  ADMIN_CREDIT:          'Admin Credit',
  ADMIN_DEBIT:           'Admin Debit',
  COMPANY_REVENUE:       'Platform Fee',
  UNCLAIMED_REFERRAL:    'Unclaimed Referral',
  CHAT_DEPOSIT:          'Chat Wallet Deposit',
  CHAT_MESSAGE_EARNING:  'Chat Message Earning',
  CHAT_WITHDRAWAL:       'Chat Wallet Withdrawal',
  CHAT_REFERRAL_EARNING: 'Chat Foreigners Referral',
  CHAT_EARNINGS:         'Chat Foreigners Earnings',
};

const DEBIT_TYPES = new Set([
  'WITHDRAWAL', 'ACTIVATION_FEE', 'SPIN_COST', 'ADMIN_DEBIT',
  'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY_REVOKE', 'CHAT_WITHDRAWAL',
]);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const currentUser = await Profile.findOne({ email: session.user.email })
      .select('_id')
      .lean();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') || 'all';
    const status     = searchParams.get('status')     || '';
    const limit      = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page       = Math.max(parseInt(searchParams.get('page')  || '1'), 1);
    const skip       = (page - 1) * limit;

    const userId  = (currentUser as any)._id;
    const userStr = userId.toString();

    // Lazy-load the legacy Transaction model (registered in models.ts on first import)
    const mongoose = (await import('mongoose')).default;
    const LegacyTx = mongoose.models['Transaction'] || null;

    // ── Build per-collection filters ──────────────────────────────────────────
    const legacyFilter: any = { user_id: userId, target_type: 'user' };
    if (sourceType === 'downline') legacyFilter.type = 'REFERRAL';
    else if (sourceType === 'direct') legacyFilter.type = { $ne: 'REFERRAL' };
    if (status) legacyFilter.status = status;

    const cfFilter: any = { user_id: userStr };
    if (sourceType === 'downline') cfFilter.type = 'CHAT_REFERRAL_EARNING';
    else if (sourceType === 'direct') cfFilter.type = { $ne: 'CHAT_REFERRAL_EARNING' };
    if (status) cfFilter.status = status;

    // ── True DB-level pagination: parallel count + paginated fetch ────────────
    // We split the page across both collections proportionally by using cursors.
    // Simpler: fetch page from each collection independently, merge & re-sort.
    // Since we can't know the exact split across two unrelated collections, we
    // fetch (skip + limit) from each, merge-sort, then slice [skip, skip+limit].
    // This is much faster than fetching ALL records — it caps both queries at
    // (skip + limit) documents maximum.
    const fetchUpTo = skip + limit;

    const [legacyCount, cfCount, legacyTxns, cfTxns, wallet] = await Promise.all([
      LegacyTx ? LegacyTx.countDocuments(legacyFilter) : Promise.resolve(0),
      (ChatForeignersTransaction as any).countDocuments(cfFilter),
      LegacyTx
        ? LegacyTx.find(legacyFilter)
            .populate('mpesa_transaction_id', 'mpesa_receipt_number')
            .select('_id amount_cents type description status transaction_code mpesa_transaction_id metadata created_at balance_after_cents source target_type')
            .sort({ created_at: -1 })
            .limit(fetchUpTo)
            .lean()
        : Promise.resolve([]),
      (ChatForeignersTransaction as any)
        .find(cfFilter)
        .select('_id amount_cents type description status metadata created_at target_type')
        .sort({ created_at: -1 })
        .limit(fetchUpTo)
        .lean(),
      ChatForeignersWallet.findOne({ user_id: userStr })
        .select('balance_cents total_earned_cents downline_earnings_cents')
        .lean(),
    ]);

    // ── Stats aggregation queries (single pass each, no full load) ────────────
    const [legacyEarningsAgg, cfEarningsAgg] = await Promise.all([
      LegacyTx ? LegacyTx.aggregate([
        { $match: { user_id: userId, target_type: 'user', status: 'completed' } },
        { $group: {
          _id: null,
          totalCredits:    { $sum: { $cond: [{ $not: [{ $in: ['$type', Array.from(DEBIT_TYPES)] }] }, '$amount_cents', 0] } },
          totalDebits:     { $sum: { $cond: [{ $in:  ['$type', Array.from(DEBIT_TYPES)] }, '$amount_cents', 0] } },
          downlineCredits: { $sum: { $cond: [{ $eq: ['$type', 'REFERRAL'] }, '$amount_cents', 0] } },
        }},
      ]) : Promise.resolve([]),
      (ChatForeignersTransaction as any).aggregate([
        { $match: { user_id: userStr, status: 'completed', target_type: { $ne: 'company' } } },
        { $group: {
          _id: null,
          totalCredits:    { $sum: '$amount_cents' },
          totalDebits:     { $sum: { $cond: [{ $eq: ['$type', 'CHAT_WITHDRAWAL'] }, '$amount_cents', 0] } },
          downlineCredits: { $sum: { $cond: [{ $eq: ['$type', 'CHAT_REFERRAL_EARNING'] }, '$amount_cents', 0] } },
        }},
      ]),
    ]);

    const legacyStats = legacyEarningsAgg[0] || { totalCredits: 0, totalDebits: 0, downlineCredits: 0 };
    const cfStats     = cfEarningsAgg[0]     || { totalCredits: 0, totalDebits: 0, downlineCredits: 0 };

    // ── Normalise ─────────────────────────────────────────────────────────────
    const normLegacy = (t: any) => {
      const meta    = t.metadata || {};
      const isDebit = DEBIT_TYPES.has(t.type);

      // Coop ref: transaction_code field (set by Coop bank payment flow)
      const coopRef  = t.transaction_code || 'N/A';
      // M-Pesa receipt: populate mpesa_transaction_id -> mpesa_receipt_number
      const mpesaRef = t.mpesa_transaction_id?.mpesa_receipt_number || meta.mpesaReceiptNumber || 'N/A';

      let desc = t.description || TYPE_LABELS[t.type] || t.type;
      if (t.type === 'REFERRAL') {
        const lvl = meta.level === 2 ? 'Level 2 — KES 10' : 'Level 1 — KES 65';
        const src = meta.source === 'chat_foreigners_unlock'
          ? `downline unlocked a Chat Foreigners personality (${lvl})`
          : desc;
        desc = `Referral commission: ${src}`;
      } else if (t.type === 'ACTIVATION_FEE') {
        desc = 'Account activation fee paid';
      }

      return {
        id:                  t._id?.toString(),
        amount:              (t.amount_cents || 0) / 100,
        amount_cents:        t.amount_cents || 0,
        transaction_type:    isDebit ? 'debit' : 'credit',
        type_label:          TYPE_LABELS[t.type] || t.type || 'N/A',
        source:              t.source || t.type || 'N/A',
        earning_source_type: t.type === 'REFERRAL' ? 'downline' : 'direct',
        description:         desc,
        status:              t.status || 'completed',
        date:                t.created_at,
        target_user:         'N/A',
        coop_reference_id:   coopRef,
        mpesa_reference_id:  mpesaRef,
        downline_level:      meta.level ?? 'N/A',
        balance_after:       t.balance_after_cents != null ? t.balance_after_cents / 100 : 'N/A',
        collection:          'legacy',
      };
    };

    const normCF = (t: any) => ({
      id:                  t._id?.toString(),
      amount:              (t.amount_cents || 0) / 100,
      amount_cents:        t.amount_cents || 0,
      transaction_type:    t.target_type === 'company' ? 'debit' : 'credit',
      type_label:          TYPE_LABELS[t.type] || t.type || 'N/A',
      source:              t.type || 'chat_foreigners',
      earning_source_type: t.type === 'CHAT_REFERRAL_EARNING' ? 'downline' : 'direct',
      description:         t.description || TYPE_LABELS[t.type] || 'Chat Foreigners transaction',
      status:              t.status || 'completed',
      date:                t.created_at,
      target_user:         'N/A',
      coop_reference_id:   'N/A',
      mpesa_reference_id:  'N/A',
      downline_level:      'N/A',
      balance_after:       'N/A',
      collection:          'chat_foreigners',
    });

    // Merge-sort the two sets (both already sorted desc) then take [skip, skip+limit]
    const merged = [
      ...(legacyTxns as any[]).map(normLegacy),
      ...(cfTxns     as any[]).map(normCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCount = legacyCount + cfCount;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const paginated  = merged.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginated,
        stats: {
          totalEarnings:    (legacyStats.totalCredits    + cfStats.totalCredits)    / 100,
          totalWithdrawals: (legacyStats.totalDebits     + cfStats.totalDebits)     / 100,
          downlineEarnings: (legacyStats.downlineCredits + cfStats.downlineCredits) / 100,
          walletBalance:    wallet ? (wallet as any).balance_cents / 100 : 0,
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit,
        },
      },
      message: 'Transactions fetched successfully',
    });

  } catch (error) {
    console.error('Transactions API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching transactions.' },
      { status: 500 }
    );
  }
}
