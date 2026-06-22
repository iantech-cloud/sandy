import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase, ChatForeignersTransaction, ChatForeignersWallet } from '@/app/lib/models';
import { auth } from '@/auth';

// Label map for legacy transaction types
const TYPE_LABELS: Record<string, string> = {
  REFERRAL:               'Referral Bonus',
  ACTIVATION_FEE:         'Account Activation Fee',
  ACCOUNT_ACTIVATION:     'Account Activation',
  DEPOSIT:                'Wallet Deposit',
  WITHDRAWAL:             'Withdrawal',
  BONUS:                  'Bonus',
  TASK_PAYMENT:           'Task Payment',
  SPIN_WIN:               'Spin Win',
  SPIN_PRIZE:             'Spin Prize',
  SPIN_COST:              'Spin Entry Cost',
  SPIN_WALLET_DEPOSIT:    'Spin Wallet Deposit',
  SURVEY:                 'Survey Reward',
  SURVEY_REVOKE:          'Survey Reward Revoked',
  ADMIN_CREDIT:           'Admin Credit',
  ADMIN_DEBIT:            'Admin Debit',
  COMPANY_REVENUE:        'Platform Fee',
  UNCLAIMED_REFERRAL:     'Unclaimed Referral',
  CHAT_DEPOSIT:           'Chat Wallet Deposit',
  CHAT_MESSAGE_EARNING:   'Chat Message Earning',
  CHAT_WITHDRAWAL:        'Chat Wallet Withdrawal',
  CHAT_REFERRAL_EARNING:  'Chat Foreigners Referral',
  CHAT_EARNINGS:          'Chat Foreigners Earnings',
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
    const page       = Math.max(parseInt(searchParams.get('page')  || '1'),  1);
    const skip       = (page - 1) * limit;

    const userId  = (currentUser as any)._id;
    const userStr = userId.toString();

    // ── lazy-load legacy model ──────────────────────────────────────────────
    const mongoose = (await import('mongoose')).default;
    const LegacyTx = mongoose.models['Transaction'] || null;

    // ── build filters ───────────────────────────────────────────────────────
    let legacyFilter: any = { user_id: userId, target_type: 'user' };
    if (sourceType === 'downline') legacyFilter.type = 'REFERRAL';
    else if (sourceType === 'direct') legacyFilter.type = { $ne: 'REFERRAL' };
    if (status) legacyFilter.status = status;

    let cfFilter: any = { user_id: userStr };
    if (status) cfFilter.status = status;
    // For downline filter on CF use CHAT_REFERRAL_EARNING
    if (sourceType === 'downline') cfFilter.type = 'CHAT_REFERRAL_EARNING';
    else if (sourceType === 'direct') cfFilter.type = { $ne: 'CHAT_REFERRAL_EARNING' };

    // ── parallel: DB-level counts + paginated fetch + wallet ───────────────
    const [legacyCount, cfCount, legacyTxns, cfTxns, wallet] = await Promise.all([
      LegacyTx ? LegacyTx.countDocuments(legacyFilter) : Promise.resolve(0),
      (ChatForeignersTransaction as any).countDocuments(cfFilter),
      LegacyTx
        ? LegacyTx.find(legacyFilter)
            .select('_id amount_cents type description status transaction_code metadata created_at balance_after_cents source target_type mpesa_transaction_id')
            .sort({ created_at: -1 })
            .lean()
        : Promise.resolve([]),
      (ChatForeignersTransaction as any)
        .find(cfFilter)
        .select('_id amount_cents type description status metadata created_at target_type')
        .sort({ created_at: -1 })
        .lean(),
      ChatForeignersWallet.findOne({ user_id: userStr })
        .select('balance_cents total_earned_cents downline_earnings_cents')
        .lean(),
    ]);

    // ── normalise ───────────────────────────────────────────────────────────
    const normLegacy = (t: any) => {
      const meta   = t.metadata || {};
      const isDebit = DEBIT_TYPES.has(t.type);
      const coopRef  = t.transaction_code || meta.receipt || 'N/A';
      const mpesaRef = meta.mpesaReceiptNumber || meta.receipt || 'N/A';

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
      transaction_type:    (t.target_type === 'company' ? 'debit' : 'credit') as 'credit' | 'debit',
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

    // Merge, sort, paginate in memory (both sets already sorted desc, merge-sort)
    const combined = [
      ...(legacyTxns as any[]).map(normLegacy),
      ...(cfTxns     as any[]).map(normCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCount = legacyCount + cfCount;
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const paginated  = combined.slice(skip, skip + limit);

    // ── all-time stats (from full combined array) ───────────────────────────
    const totalEarningsCents = combined
      .filter(t => t.transaction_type === 'credit')
      .reduce((s, t) => s + t.amount_cents, 0);
    const totalWithdrawalsCents = combined
      .filter(t => t.transaction_type === 'debit')
      .reduce((s, t) => s + t.amount_cents, 0);
    const downlineEarningsCents = combined
      .filter(t => t.earning_source_type === 'downline' && t.transaction_type === 'credit')
      .reduce((s, t) => s + t.amount_cents, 0);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginated,
        stats: {
          totalEarnings:    totalEarningsCents    / 100,
          totalWithdrawals: totalWithdrawalsCents / 100,
          downlineEarnings: downlineEarningsCents / 100,
          walletBalance:    wallet ? (wallet as any).balance_cents / 100 : 0,
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext:  page < totalPages,
          hasPrev:  page > 1,
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
