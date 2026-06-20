import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Transaction } from '@/app/lib/models';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const adminUser = await (Profile as any).findOne({ email: session.user.email }).select('role').lean();
    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }

    // Fetch revenue and expense breakdowns with LIMITS to prevent full table scans
    const [companyRevenueTransactions, companyExpenseTransactions] = await Promise.all([
      // Company Revenue: Get recent completed transactions to company (limit to recent 1000)
      (Transaction as any)
        .find({
          target_type: 'company',
          status: 'completed'
        })
        .select('type amount_cents metadata description')
        .sort({ created_at: -1 })
        .limit(1000)
        .lean(),
      
      // Company Expenses: Get recent completed payouts (limit to recent 1000)
      (Transaction as any)
        .find({
          target_type: 'user',
          status: 'completed',
          type: { 
            $in: [
              'BONUS', 
              'TASK_PAYMENT', 
              'SPIN_WIN', 
              'REFERRAL', 
              'SURVEY',
              'WITHDRAWAL'
            ] 
          }
        })
        .select('type amount_cents')
        .sort({ created_at: -1 })
        .limit(1000)
        .lean()
    ]);

    // Calculate Revenue Breakdown
    let activationFees = 0;
    let unclaimedReferrals = 0;
    let spinCosts = 0;
    let contentPayments = 0;
    let otherRevenue = 0;

    for (const txn of companyRevenueTransactions) {
      const amount = txn.amount_cents;
      
      switch (txn.type) {
        case 'ACTIVATION_FEE':
        case 'ACCOUNT_ACTIVATION':
        case 'COMPANY_REVENUE':
          if (txn.metadata?.source === 'unclaimed_referral') {
            unclaimedReferrals += amount;
          } else if (txn.metadata?.source === 'activation') {
            activationFees += amount;
          } else {
            activationFees += amount;
          }
          break;
        
        case 'SPIN_COST':
          spinCosts += amount;
          break;
        
        default:
          if (txn.description?.toLowerCase().includes('content')) {
            contentPayments += amount;
          } else {
            otherRevenue += amount;
          }
      }
    }

    const totalCompanyRevenue = activationFees + unclaimedReferrals + spinCosts + contentPayments + otherRevenue;

    // Calculate Expense Breakdown
    let userPayouts = 0;
    let bonuses = 0;
    let referralCommissions = 0;
    let spinPrizes = 0;
    let taskPayments = 0;
    let surveyPayments = 0;
    let otherExpenses = 0;

    for (const txn of companyExpenseTransactions) {
      const amount = txn.amount_cents;
      
      switch (txn.type) {
        case 'WITHDRAWAL':
          userPayouts += amount;
          break;
        case 'BONUS':
          bonuses += amount;
          break;
        case 'REFERRAL':
          referralCommissions += amount;
          break;
        case 'SPIN_WIN':
        case 'SPIN_PRIZE':
          spinPrizes += amount;
          break;
        case 'TASK_PAYMENT':
          taskPayments += amount;
          break;
        case 'SURVEY':
          surveyPayments += amount;
          break;
        default:
          otherExpenses += amount;
      }
    }

    const totalCompanyExpenses = userPayouts + bonuses + referralCommissions + 
                                  spinPrizes + taskPayments + surveyPayments + otherExpenses;
    
    const netProfit = totalCompanyRevenue - totalCompanyExpenses;

    return NextResponse.json({
      success: true,
      data: {
        totalCompanyRevenue,
        totalCompanyExpenses,
        netProfit,
        revenueBreakdown: {
          activationFees,
          unclaimedReferrals,
          spinCosts,
          contentPayments,
          otherRevenue
        },
        expenseBreakdown: {
          userPayouts,
          bonuses,
          referralCommissions,
          spinPrizes,
          taskPayments,
          surveyPayments,
          otherExpenses
        }
      }
    });
  } catch (error: any) {
    console.error('[v0] Breakdown stats error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
