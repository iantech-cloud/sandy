import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth } from '../../middleware';
import { connectToDatabase, Profile, SpinWallet, Transaction, Withdrawal } from '@/app/lib/models';

export async function GET(req: NextRequest) {
  try {
    // Validate admin access
    const authResult = await validateAdminAuth();
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    await connectToDatabase();

    // Calculate actual financial metrics from database
    const [
      totalUsers,
      activeUsers,
      totalUserWalletBalance,
      totalSpinWalletBalance,
      pendingWithdrawalsCount,
      pendingWithdrawalsAmount,
      approvedWithdrawalsThisMonth,
      totalRevenueTransactions,
      totalExpenseTransactions,
    ] = await Promise.all([
      Profile.countDocuments({ is_verified: true }),
      Profile.countDocuments({ is_verified: true, last_login: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      // Sum all user wallet balances from Profile collection
      (Profile as any).aggregate([{ $group: { _id: null, total: { $sum: '$balance_cents' } } }]),
      // Sum all spin wallet balances from SpinWallet collection
      (SpinWallet as any).aggregate([{ $group: { _id: null, total: { $sum: '$balance_cents' } } }]),
      // Count pending withdrawals
      Withdrawal.countDocuments({ status: 'pending' }),
      // Sum pending withdrawal amounts
      (Withdrawal as any).aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount_cents' } } }
      ]),
      // Count completed withdrawals this month
      Withdrawal.countDocuments({
        status: 'completed',
        processed_at: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      // Sum all revenue transactions
      (Transaction as any).aggregate([
        { $match: { target_type: 'company', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Sum all expense transactions (user payouts)
      (Transaction as any).aggregate([
        { $match: { target_type: 'user', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
    ]);

    const userWalletTotal = totalUserWalletBalance[0]?.total || 0;
    const spinWalletTotal = totalSpinWalletBalance[0]?.total || 0;
    const withdrawalsPending = pendingWithdrawalsAmount[0]?.total || 0;
    const totalRevenue = totalRevenueTransactions[0]?.total || 0;
    const totalExpenses = totalExpenseTransactions[0]?.total || 0;
    const netProfit = totalRevenue - totalExpenses;
    const companyBalance = totalRevenue - (totalExpenses + userWalletTotal + spinWalletTotal + withdrawalsPending);

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        wallets: {
          userWalletTotal,
          spinWalletTotal,
          totalUserFunds: userWalletTotal + spinWalletTotal,
        },
        withdrawals: {
          pending: {
            count: pendingWithdrawalsCount,
            amount: withdrawalsPending,
          },
          completedThisMonth: approvedWithdrawalsThisMonth,
        },
        financials: {
          totalRevenue,
          totalExpenses,
          netProfit,
          companyBalance,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[v0] Financial stats error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to calculate financial stats' },
      { status: 500 }
    );
  }
}
