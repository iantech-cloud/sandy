import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, buildPaginationMeta } from '../../middleware';
import { connectToDatabase, Transaction } from '@/app/lib/models';

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

    // Use aggregation pipelines for accurate financial calculations
    const [revenueBreakdown, expenseBreakdown] = await Promise.all([
      // Revenue breakdown by type
      (Transaction as any).aggregate([
        { $match: { target_type: 'company', status: 'completed' } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]),
      
      // Expense breakdown by type
      (Transaction as any).aggregate([
        {
          $match: {
            target_type: 'user',
            status: 'completed',
            type: { 
              $in: [
                'BONUS', 
                'TASK_PAYMENT', 
                'SPIN_WIN', 
                'REFERRAL', 
                'SURVEY',
                'WITHDRAWAL',
                'ADMIN_CREDIT'
              ] 
            }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ])
    ]);

    // Map revenue categories
    const revenueMap: Record<string, { total: number; count: number }> = {};
    for (const item of revenueBreakdown) {
      revenueMap[item._id] = { total: item.total, count: item.count };
    }

    const activationFees = (revenueMap['ACTIVATION_FEE']?.total || 0) + (revenueMap['ACCOUNT_ACTIVATION']?.total || 0);
    const spinCosts = revenueMap['SPIN_COST']?.total || 0;
    const companyRevenue = revenueMap['COMPANY_REVENUE']?.total || 0;
    const unclaimedReferrals = revenueMap['UNCLAIMED_REFERRAL']?.total || 0;
    const contentPayments = revenueMap['SURVEY']?.total || 0;
    const otherRevenue = revenueBreakdown.reduce((sum: number, item: any) => {
      if (!['ACTIVATION_FEE', 'ACCOUNT_ACTIVATION', 'SPIN_COST', 'COMPANY_REVENUE', 'UNCLAIMED_REFERRAL', 'SURVEY'].includes(item._id)) {
        return sum + item.total;
      }
      return sum;
    }, 0);

    const totalCompanyRevenue = activationFees + spinCosts + companyRevenue + unclaimedReferrals + contentPayments + otherRevenue;

    // Map expense categories
    const expenseMap: Record<string, { total: number; count: number }> = {};
    for (const item of expenseBreakdown) {
      expenseMap[item._id] = { total: item.total, count: item.count };
    }

    const userPayouts = expenseMap['WITHDRAWAL']?.total || 0;
    const bonuses = expenseMap['BONUS']?.total || 0;
    const referralCommissions = expenseMap['REFERRAL']?.total || 0;
    const spinPrizes = (expenseMap['SPIN_WIN']?.total || 0) + (expenseMap['SPIN_PRIZE']?.total || 0);
    const taskPayments = expenseMap['TASK_PAYMENT']?.total || 0;
    const surveyPayments = expenseMap['SURVEY']?.total || 0;
    const adminCredits = expenseMap['ADMIN_CREDIT']?.total || 0;
    const otherExpenses = expenseBreakdown.reduce((sum: number, item: any) => {
      if (!['WITHDRAWAL', 'BONUS', 'REFERRAL', 'SPIN_WIN', 'SPIN_PRIZE', 'TASK_PAYMENT', 'SURVEY', 'ADMIN_CREDIT'].includes(item._id)) {
        return sum + item.total;
      }
      return sum;
    }, 0);

    const totalCompanyExpenses = userPayouts + bonuses + referralCommissions + spinPrizes + taskPayments + surveyPayments + adminCredits + otherExpenses;
    const netProfit = totalCompanyRevenue - totalCompanyExpenses;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue: totalCompanyRevenue,
          totalExpenses: totalCompanyExpenses,
          netProfit: netProfit,
          profitMargin: totalCompanyRevenue > 0 ? ((netProfit / totalCompanyRevenue) * 100).toFixed(2) + '%' : '0%',
        },
        revenueBreakdown: {
          activationFees: { amount: activationFees, count: (revenueMap['ACTIVATION_FEE']?.count || 0) + (revenueMap['ACCOUNT_ACTIVATION']?.count || 0) },
          spinCosts: { amount: spinCosts, count: revenueMap['SPIN_COST']?.count || 0 },
          companyRevenue: { amount: companyRevenue, count: revenueMap['COMPANY_REVENUE']?.count || 0 },
          unclaimedReferrals: { amount: unclaimedReferrals, count: revenueMap['UNCLAIMED_REFERRAL']?.count || 0 },
          contentPayments: { amount: contentPayments, count: revenueMap['SURVEY']?.count || 0 },
          other: { amount: otherRevenue, count: 0 }
        },
        expenseBreakdown: {
          userPayouts: { amount: userPayouts, count: expenseMap['WITHDRAWAL']?.count || 0 },
          bonuses: { amount: bonuses, count: expenseMap['BONUS']?.count || 0 },
          referralCommissions: { amount: referralCommissions, count: expenseMap['REFERRAL']?.count || 0 },
          spinPrizes: { amount: spinPrizes, count: (expenseMap['SPIN_WIN']?.count || 0) + (expenseMap['SPIN_PRIZE']?.count || 0) },
          taskPayments: { amount: taskPayments, count: expenseMap['TASK_PAYMENT']?.count || 0 },
          surveyPayments: { amount: surveyPayments, count: expenseMap['SURVEY']?.count || 0 },
          adminCredits: { amount: adminCredits, count: expenseMap['ADMIN_CREDIT']?.count || 0 },
          other: { amount: otherExpenses, count: 0 }
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[v0] Breakdown stats error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to calculate breakdown' },
      { status: 500 }
    );
  }
}
