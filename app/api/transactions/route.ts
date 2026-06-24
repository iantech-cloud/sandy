import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase, ChatForeignersTransaction, Transaction, MpesaTransaction } from '@/app/lib/models';
import { auth } from '@/auth';

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

// Debit types — money leaving user wallet
const DEBIT_TYPES = new Set([
  'WITHDRAWAL', 'ACTIVATION_FEE', 'SPIN_COST', 'ADMIN_DEBIT',
  'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY_REVOKE',
]);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const currentUser = await Profile.findOne({ email: session.user.email }).select('_id').lean();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') || 'all';
    const status     = searchParams.get('status') || '';
    const limit      = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page       = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const skip       = (page - 1) * limit;

    const userId = (currentUser as any)._id.toString();

    // ─── Build filters ────────────────────────────────────────────
    let legacyMatch: any = { user_id: userId };
    if (status) legacyMatch.status = status;
    if (sourceType === 'downline') legacyMatch.type = 'REFERRAL';
    else if (sourceType === 'direct') legacyMatch.type = { $nin: ['REFERRAL'] };

    const cfMatch: any = { user_id: userId };
    if (status) cfMatch.status = status;
    if (sourceType === 'downline') cfMatch.type = 'CHAT_REFERRAL_EARNING';
    else if (sourceType === 'direct') cfMatch.type = { $ne: 'CHAT_REFERRAL_EARNING' };

    // ─── Run aggregations in parallel ─────────────────────────────
    // Each uses $facet to get BOTH paginated rows AND all-time totals in ONE query
    const [legacyResult, cfResult, profileDoc] = await Promise.all([
      (Transaction as any)
        ? LegacyTransaction.aggregate([
            { $match: legacyMatch },
            {
              $facet: {
                data: [
                  { $sort: { created_at: -1 } },
                  { $skip: skip },
                  { $limit: limit },
                  // Populate mpesa_transaction_id for real receipt number
                  {
                    $lookup: {
                      from: 'mpesatransactions',
                      localField: 'mpesa_transaction_id',
                      foreignField: '_id',
                      as: '_mpesa',
                    },
                  },
                  // Populate user_id for username/email
                  {
                    $lookup: {
                      from: 'profiles',
                      localField: 'user_id',
                      foreignField: '_id',
                      as: '_profile',
                    },
                  },
                ],
                totalCount: [{ $count: 'n' }],
                // All-time totals via aggregation — not in-memory
                creditSum: [
                  { $match: { target_type: { $in: ['user', null] }, $expr: { $not: { $in: ['$type', Array.from(DEBIT_TYPES)] } } } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                debitSum: [
                  { $match: { $expr: { $in: ['$type', Array.from(DEBIT_TYPES)] } } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
                downlineSum: [
                  { $match: { type: 'REFERRAL' } },
                  { $group: { _id: null, total: { $sum: '$amount_cents' } } },
                ],
              },
            },
          ])
        : Promise.resolve([{ data: [], totalCount: [], creditSum: [], debitSum: [], downlineSum: [] }]),

      (ChatForeignersTransaction as any).aggregate([
        { $match: cfMatch },
        {
          $facet: {
            data: [
              { $sort: { created_at: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'n' }],
            creditSum: [
              { $match: { target_type: 'user' } },
              { $group: { _id: null, total: { $sum: '$amount_cents' } } },
            ],
            debitSum: [
              { $match: { target_type: 'company' } },
              { $group: { _id: null, total: { $sum: '$amount_cents' } } },
            ],
            downlineSum: [
              { $match: { type: 'CHAT_REFERRAL_EARNING' } },
              { $group: { _id: null, total: { $sum: '$amount_cents' } } },
            ],
          },
        },
      ]),

      // Fetch main wallet balance from Profile (the available/withdrawable balance)
      Profile.findById(userId)
        .select('balance_cents')
        .lean(),
    ]);

    const lr = legacyResult[0];
    const cr = cfResult[0];

    // ─── Normalise rows ────────────────────────────────────────────
    const normLegacy = (txn: any) => {
      const isDebit = DEBIT_TYPES.has(txn.type);
      const meta    = txn.metadata || {};
      const mpesa   = txn._mpesa?.[0];
      const profile = txn._profile?.[0];

      let description = txn.description || TYPE_LABELS[txn.type] || txn.type;
      if (txn.type === 'REFERRAL') {
        const level = meta.level === 2 ? 'Level 2 (KES 10)' : 'Level 1 (KES 65)';
        const src   = meta.source === 'chat_foreigners_unlock'
          ? `downline unlocked a Chat Foreigners personality — ${level}`
          : description;
        description = description.toLowerCase().includes('chat foreigners') ? description : `Referral commission: ${src}`;
      } else if (txn.type === 'ACTIVATION_FEE') {
        description = 'Account activation fee paid';
      }

      return {
        id:               txn._id?.toString(),
        amount:           (txn.amount_cents || 0) / 100,
        amount_cents:     txn.amount_cents || 0,
        transaction_type: isDebit ? 'debit' : 'credit',
        type:             txn.type || 'N/A',
        type_label:       TYPE_LABELS[txn.type] || txn.type || 'N/A',
        source:           txn.source || txn.type || 'N/A',
        target_type:      txn.target_type || 'user',
        target:           txn.target_type === 'company' ? 'Company' : 'User Wallet',
        earning_source_type: txn.type === 'REFERRAL' ? 'downline' : 'direct',
        description,
        status:           txn.status || 'completed',
        date:             txn.created_at,
        // Real Coop bank reference from transaction_code field
        coop_reference_id:  txn.transaction_code || null,
        // Real M-Pesa receipt number from populated MpesaTransaction document
        mpesa_reference_id: mpesa?.mpesa_receipt_number || null,
        downline_level:   meta.level ?? null,
        collection:       'legacy',
      };
    };

    const normCF = (txn: any) => ({
      id:               txn._id?.toString(),
      amount:           (txn.amount_cents || 0) / 100,
      amount_cents:     txn.amount_cents || 0,
      transaction_type: txn.target_type === 'company' ? 'debit' : 'credit',
      type:             txn.type || 'N/A',
      type_label:       CF_TYPE_LABELS[txn.type] || txn.type || 'N/A',
      source:           txn.type || 'chat_foreigners',
      target_type:      txn.target_type || 'user',
      target:           txn.target_type === 'company' ? 'Company' : 'User Wallet',
      earning_source_type: txn.type === 'CHAT_REFERRAL_EARNING' ? 'downline' : 'direct',
      description:      txn.description || CF_TYPE_LABELS[txn.type] || 'Chat Foreigners Transaction',
      status:           txn.status || 'completed',
      date:             txn.created_at,
      coop_reference_id:  null,
      mpesa_reference_id: null,
      downline_level:   null,
      collection:       'chat_foreigners',
    });

    // Merge paginated rows and re-sort
    const rows = [
      ...(lr.data || []).map(normLegacy),
      ...(cr.data || []).map(normCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
     .slice(0, limit);

    // ─── Totals from aggregation (all-time, not just current page) ─
    const legacyTotal    = (lr.totalCount[0]?.n    || 0);
    const cfTotal        = (cr.totalCount[0]?.n    || 0);
    const totalCount     = legacyTotal + cfTotal;
    const totalPages     = Math.max(Math.ceil(totalCount / limit), 1);

    const totalEarnings    = ((lr.creditSum[0]?.total   || 0) + (cr.creditSum[0]?.total   || 0)) / 100;
    const totalWithdrawals = ((lr.debitSum[0]?.total    || 0) + (cr.debitSum[0]?.total    || 0)) / 100;
    const downlineEarnings = ((lr.downlineSum[0]?.total || 0) + (cr.downlineSum[0]?.total || 0)) / 100;

    return NextResponse.json({
      success: true,
      data: {
        transactions: rows,
        stats: {
          totalEarnings,
          totalWithdrawals,
          downlineEarnings,
          // Main wallet available balance from Profile.balance_cents
          walletBalance: profileDoc ? (profileDoc as any).balance_cents / 100 : 0,
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
    });

  } catch (error) {
    console.error('Transactions API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching transactions.' },
      { status: 500 }
    );
  }
}
