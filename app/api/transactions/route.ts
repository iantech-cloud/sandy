import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase, ChatForeignersTransaction, ChatForeignersWallet } from '@/app/lib/models';
import { TransactionLedger } from '@/app/lib/models/RevenueStreams';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const currentUser = await Profile.findOne({ email: session.user.email }).select('_id').lean();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') || 'all';
    const status     = searchParams.get('status') || '';
    const limit      = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const page       = Math.max(parseInt(searchParams.get('page') || '1'), 1);

    const userId = (currentUser as any)._id.toString();

    // ─────────────────────────────────────────────────────────────
    // 1. Legacy Transaction collection (DEPOSIT, WITHDRAWAL, BONUS,
    //    REFERRAL, ACTIVATION_FEE, ADMIN_CREDIT, SPIN_WIN, etc.)
    // ─────────────────────────────────────────────────────────────
    const mongoose = (await import('mongoose')).default;
    const LegacyTransaction = mongoose.models['Transaction'] || null;

    // ─────────────────────────────────────────────────────────────
    // 2. ChatForeigners wallet transactions
    // ─────────────────────────────────────────────────────────────
    const cfFilter: any = { user_id: userId };
    if (status) cfFilter.status = status;

    // ─────────────────────────────────────────────────────────────
    // 3. Build legacy filter
    // ─────────────────────────────────────────────────────────────
    let legacyFilter: any = {};
    if (sourceType === 'downline') {
      // Downline = referral bonuses earned because someone in downline activated / unlocked
      legacyFilter = {
        user_id: (currentUser as any)._id,
        type: { $in: ['REFERRAL'] },
        target_type: 'user',
      };
    } else if (sourceType === 'direct') {
      legacyFilter = {
        user_id: (currentUser as any)._id,
        type: { $in: ['DEPOSIT', 'BONUS', 'TASK_PAYMENT', 'SPIN_WIN', 'SURVEY', 'ACTIVATION_FEE', 'ADMIN_CREDIT', 'SPIN_PRIZE', 'SPIN_WALLET_DEPOSIT'] },
        target_type: 'user',
      };
    } else {
      legacyFilter = {
        user_id: (currentUser as any)._id,
        target_type: 'user',
      };
    }
    if (status) legacyFilter.status = status;

    // ─────────────────────────────────────────────────────────────
    // Fetch all three sources in parallel
    // ─────────────────────────────────────────────────────────────
    const [legacyTxns, cfTxns, wallet] = await Promise.all([
      LegacyTransaction
        ? LegacyTransaction.find(legacyFilter)
            .sort({ created_at: -1 })
            .lean()
        : Promise.resolve([]),
      (ChatForeignersTransaction as any).find(cfFilter)
        .sort({ created_at: -1 })
        .lean(),
      ChatForeignersWallet.findOne({ user_id: userId }).select('balance_cents total_earned_cents downline_earnings_cents chat_earnings_cents').lean(),
    ]);

    // ─────────────────────────────────────────────────────────────
    // Normalise legacy transactions → unified shape
    // ─────────────────────────────────────────────────────────────
    const normaliseLegacy = (txn: any) => {
      const typeMap: Record<string, string> = {
        REFERRAL: 'Referral Bonus',
        ACTIVATION_FEE: 'Account Activation Fee',
        DEPOSIT: 'Wallet Deposit',
        WITHDRAWAL: 'Withdrawal',
        BONUS: 'Bonus',
        TASK_PAYMENT: 'Task Payment',
        SPIN_WIN: 'Spin Win',
        SPIN_PRIZE: 'Spin Prize',
        SPIN_COST: 'Spin Entry Cost',
        SPIN_WALLET_DEPOSIT: 'Spin Wallet Deposit',
        SURVEY: 'Survey Reward',
        SURVEY_REVOKE: 'Survey Reward Revoked',
        ADMIN_CREDIT: 'Admin Credit',
        ADMIN_DEBIT: 'Admin Debit',
        ACCOUNT_ACTIVATION: 'Account Activation',
        COMPANY_REVENUE: 'Platform Fee',
        UNCLAIMED_REFERRAL: 'Unclaimed Referral',
      };

      const isDebit = ['WITHDRAWAL', 'ACTIVATION_FEE', 'SPIN_COST', 'ADMIN_DEBIT', 'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY_REVOKE'].includes(txn.type);

      // Fix description grammar based on type
      let description = txn.description || typeMap[txn.type] || txn.type || 'Transaction';
      if (txn.type === 'REFERRAL') {
        const meta = txn.metadata || {};
        const level = meta.level === 2 ? 'Level 2 (KES 10)' : 'Level 1 (KES 65)';
        const source = meta.source === 'chat_foreigners_unlock'
          ? `downline unlocked a Chat Foreigners personality — ${level}`
          : description;
        description = description.includes('Chat Foreigners')
          ? description
          : `Referral commission: ${source}`;
      } else if (txn.type === 'ACTIVATION_FEE') {
        description = 'Account activation fee paid';
      } else if (txn.type === 'ACCOUNT_ACTIVATION') {
        description = 'Account activated';
      }

      return {
        id: txn._id?.toString(),
        amount: (txn.amount_cents || 0) / 100,
        amount_cents: txn.amount_cents || 0,
        transaction_type: isDebit ? 'debit' : 'credit',
        source: txn.source || txn.type || 'N/A',
        earning_source_type: txn.type === 'REFERRAL' ? 'downline' : 'direct',
        description,
        status: txn.status || 'completed',
        date: txn.created_at,
        payment_method: txn.metadata?.payment_method || 'N/A',
        coop_reference_id: txn.transaction_code || txn.metadata?.receipt || 'N/A',
        mpesa_reference_id: txn.metadata?.mpesaReceiptNumber || txn.metadata?.receipt || 'N/A',
        downline_level: txn.metadata?.level || 'N/A',
        metadata: txn.metadata || {},
        _collection: 'legacy',
      };
    };

    // Normalise ChatForeigners transactions
    const normaliseCF = (txn: any) => {
      const cfTypeMap: Record<string, string> = {
        CHAT_DEPOSIT: 'Chat Wallet Deposit',
        CHAT_MESSAGE_EARNING: 'Chat Message Earning',
        CHAT_WITHDRAWAL: 'Chat Wallet Withdrawal',
        CHAT_REFERRAL_EARNING: 'Chat Foreigners Referral Earnings',
        CHAT_EARNINGS: 'Chat Foreigners Platform Fee',
      };

      const isDebit = ['CHAT_WITHDRAWAL', 'CHAT_DEPOSIT'].includes(txn.type) && txn.target_type === 'company';

      return {
        id: txn._id?.toString(),
        amount: (txn.amount_cents || 0) / 100,
        amount_cents: txn.amount_cents || 0,
        transaction_type: isDebit ? 'debit' : 'credit',
        source: txn.type || 'chat_foreigners',
        earning_source_type: txn.type === 'CHAT_REFERRAL_EARNING' ? 'downline' : 'direct',
        description: txn.description || cfTypeMap[txn.type] || 'Chat Foreigners Transaction',
        status: txn.status || 'completed',
        date: txn.created_at,
        payment_method: 'N/A',
        coop_reference_id: 'N/A',
        mpesa_reference_id: 'N/A',
        downline_level: 'N/A',
        metadata: txn.metadata || {},
        _collection: 'chat_foreigners',
      };
    };

    // Combine all, deduplicate by id, sort by date
    const normalised = [
      ...(legacyTxns as any[]).map(normaliseLegacy),
      ...(cfTxns as any[]).map(normaliseCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter by sourceType after normalisation
    const filtered = sourceType === 'all'
      ? normalised
      : normalised.filter(t => t.earning_source_type === sourceType);

    const totalCount  = filtered.length;
    const totalPages  = Math.max(Math.ceil(totalCount / limit), 1);
    const skip        = (page - 1) * limit;
    const paginated   = filtered.slice(skip, skip + limit);

    // ─────────────────────────────────────────────────────────────
    // All-time stats from wallet + full transaction set (not paged)
    // ─────────────────────────────────────────────────────────────
    const allTimeEarnings = normalised
      .filter(t => t.transaction_type === 'credit')
      .reduce((s, t) => s + t.amount_cents, 0);

    const allTimeWithdrawals = normalised
      .filter(t => t.transaction_type === 'debit')
      .reduce((s, t) => s + t.amount_cents, 0);

    const downlineEarnings = normalised
      .filter(t => t.earning_source_type === 'downline' && t.transaction_type === 'credit')
      .reduce((s, t) => s + t.amount_cents, 0);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginated,
        stats: {
          totalEarnings: allTimeEarnings / 100,
          totalWithdrawals: allTimeWithdrawals / 100,
          downlineEarnings: downlineEarnings / 100,
          walletBalance: wallet ? (wallet as any).balance_cents / 100 : 0,
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
