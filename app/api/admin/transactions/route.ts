import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, ChatForeignersTransaction } from '@/app/lib/models';

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

    const user = await Profile.findOne({ email: session.user.email }).select('role').lean();
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Forbidden — admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page       = Math.max(parseInt(searchParams.get('page')  || '1'),  1);
    const limit      = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const source     = searchParams.get('source')     || 'all';
    const status     = searchParams.get('status')     || 'all';
    const sourceType = searchParams.get('sourceType') || 'all';
    const coopRef    = searchParams.get('coopRef')    || '';
    const mpesaRef   = searchParams.get('mpesaRef')   || '';
    const dateFrom   = searchParams.get('dateFrom')   || '';
    const dateTo     = searchParams.get('dateTo')     || '';
    const collection = searchParams.get('collection') || 'all'; // 'all' | 'legacy' | 'cf'

    const skip = (page - 1) * limit;

    // ─────────────────────────────────────────────────────────────
    // Build date range filter (shared)
    // ─────────────────────────────────────────────────────────────
    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      dateFilter.created_at = {};
      if (dateFrom) dateFilter.created_at.$gte = new Date(dateFrom);
      if (dateTo)   dateFilter.created_at.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    // ─────────────────────────────────────────────────────────────
    // Legacy Transaction model (mongoose.models['Transaction'])
    // ─────────────────────────────────────────────────────────────
    const mongoose = (await import('mongoose')).default;
    const LegacyTransaction = mongoose.models['Transaction'] || null;

    let legacyFilter: any = { target_type: 'user', ...dateFilter };
    if (source !== 'all')     legacyFilter.source = source;
    if (status !== 'all')     legacyFilter.status = status;
    if (coopRef)              legacyFilter.transaction_code = new RegExp(coopRef, 'i');
    if (mpesaRef)             legacyFilter['metadata.mpesaReceiptNumber'] = new RegExp(mpesaRef, 'i');
    if (sourceType === 'downline') legacyFilter.type = 'REFERRAL';
    else if (sourceType === 'direct') legacyFilter.type = { $ne: 'REFERRAL' };

    // ─────────────────────────────────────────────────────────────
    // ChatForeigners Transaction filter
    // ─────────────────────────────────────────────────────────────
    let cfFilter: any = { ...dateFilter };
    if (status !== 'all') cfFilter.status = status;

    // ─────────────────────────────────────────────────────────────
    // Count + fetch in parallel — use lean + limit per collection
    // ─────────────────────────────────────────────────────────────
    const fetchLegacy = collection !== 'cf' && LegacyTransaction;
    const fetchCF     = collection !== 'legacy';

    const [legacyTxns, cfTxns] = await Promise.all([
      fetchLegacy
        ? LegacyTransaction.find(legacyFilter)
            .populate('user_id', 'username email')
            .sort({ created_at: -1 })
            .lean()
        : Promise.resolve([]),
      fetchCF
        ? (ChatForeignersTransaction as any).find(cfFilter)
            .sort({ created_at: -1 })
            .lean()
        : Promise.resolve([]),
    ]);

    // ─────────────────────────────────────────────────────────────
    // Normalise
    // ─────────────────────────────────────────────────────────────
    const typeLabels: Record<string, string> = {
      REFERRAL: 'Referral Bonus',
      ACTIVATION_FEE: 'Account Activation Fee',
      ACCOUNT_ACTIVATION: 'Account Activated',
      DEPOSIT: 'Deposit',
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
      COMPANY_REVENUE: 'Platform Fee',
      UNCLAIMED_REFERRAL: 'Unclaimed Referral',
    };

    const cfTypeLabels: Record<string, string> = {
      CHAT_DEPOSIT: 'Chat Wallet Deposit',
      CHAT_MESSAGE_EARNING: 'Chat Message Earning',
      CHAT_WITHDRAWAL: 'Chat Wallet Withdrawal',
      CHAT_REFERRAL_EARNING: 'Chat Foreigners Referral Earnings',
      CHAT_EARNINGS: 'Chat Foreigners Platform Fee',
    };

    const normLegacy = (txn: any) => {
      const isDebit = ['WITHDRAWAL', 'ACTIVATION_FEE', 'SPIN_COST', 'ADMIN_DEBIT', 'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY_REVOKE'].includes(txn.type);
      const meta    = txn.metadata || {};
      let description = txn.description || typeLabels[txn.type] || txn.type;

      if (txn.type === 'REFERRAL') {
        const level = meta.level === 2 ? 'Level 2 (KES 10)' : 'Level 1 (KES 65)';
        const src   = meta.source === 'chat_foreigners_unlock'
          ? `downline unlocked a Chat Foreigners personality — ${level}`
          : description;
        description = `Referral commission: ${src}`;
      } else if (txn.type === 'ACTIVATION_FEE') {
        description = 'Account activation fee paid';
      }

      return {
        id: txn._id?.toString(),
        user_id:       txn.user_id?._id?.toString() || txn.user_id?.toString() || 'N/A',
        user_email:    txn.user_id?.email    || 'N/A',
        user_username: txn.user_id?.username || 'N/A',
        amount: (txn.amount_cents || 0) / 100,
        amount_cents: txn.amount_cents || 0,
        transaction_type: isDebit ? 'debit' : 'credit',
        type: txn.type || 'N/A',
        source: txn.source || txn.type || 'N/A',
        earning_source_type: txn.type === 'REFERRAL' ? 'downline' : 'direct',
        status: txn.status || 'N/A',
        description,
        date: txn.created_at,
        payment_method:       'N/A',
        coop_reference_id:    txn.transaction_code || meta.receipt || 'N/A',
        mpesa_reference_id:   meta.mpesaReceiptNumber || meta.receipt || 'N/A',
        downline_level:       meta.level ?? 'N/A',
        reference_id:         txn.transaction_code || 'N/A',
        reference_type:       txn.type || 'N/A',
        balance_after:        txn.balance_after_cents != null ? txn.balance_after_cents / 100 : 'N/A',
        metadata:             meta,
        collection:           'legacy',
      };
    };

    const normCF = (txn: any) => ({
      id: txn._id?.toString(),
      user_id:       txn.user_id?.toString() || 'N/A',
      user_email:    'N/A',
      user_username: 'N/A',
      amount: (txn.amount_cents || 0) / 100,
      amount_cents: txn.amount_cents || 0,
      transaction_type: txn.target_type === 'company' ? 'debit' : 'credit',
      type: txn.type || 'N/A',
      source: txn.type || 'chat_foreigners',
      earning_source_type: txn.type === 'CHAT_REFERRAL_EARNING' ? 'downline' : 'direct',
      status: txn.status || 'N/A',
      description: txn.description || cfTypeLabels[txn.type] || 'Chat Foreigners Transaction',
      date: txn.created_at,
      payment_method:     'N/A',
      coop_reference_id:  'N/A',
      mpesa_reference_id: 'N/A',
      downline_level:     'N/A',
      reference_id:       txn._id?.toString() || 'N/A',
      reference_type:     txn.type || 'N/A',
      balance_after:      'N/A',
      metadata:           txn.metadata || {},
      collection:         'chat_foreigners',
    });

    const all = [
      ...(legacyTxns as any[]).map(normLegacy),
      ...(cfTxns    as any[]).map(normCF),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = all.length;
    const pages = Math.max(Math.ceil(total / limit), 1);
    const paginated = all.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: {
        transactions: paginated,
        count: paginated.length,
        pagination: { page, limit, total, pages },
      },
      message: 'Transactions fetched successfully',
    });

  } catch (error) {
    console.error('Admin transactions API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
