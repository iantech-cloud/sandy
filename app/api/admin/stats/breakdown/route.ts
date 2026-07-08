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

    // Use aggregation pipelines for unlimited record processing (no hard limit)
    const [revenueAgg, expenseAgg] = await Promise.all([
      // Company Revenue: All completed transactions to company grouped by type
      (Transaction as any).aggregate([
        { $match: { target_type: 'company', status: 'completed' } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount_cents' },
            docs: { $push: { type: '$type', metadata: '$metadata', description: '$description', amount: '$amount_cents' } }
          }
        }
      ]),
      
      // Company Expenses: All completed payouts grouped by type
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
                'WITHDRAWAL'
              ] 
            }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount_cents' }
          }
        }
      ])
    ]);

    // Calculate Revenue Breakdown from aggregation results
    let activationFees = 0;
    let unclaimedReferrals = 0;
    let spinCosts = 0;
    let contentPayments = 0;
    let otherRevenue = 0;

    for (const group of revenueAgg) {
      const amount = group.total;
      
      switch (group._id) {
        case 'ACTIVATION_FEE':
        case 'ACCOUNT_ACTIVATION':
        case 'COMPANY_REVENUE':
          // Check first document in group for metadata
          const firstDoc = group.docs?.[0];
          if (firstDoc?.metadata?.source === 'unclaimed_referral') {
            unclaimedReferrals += amount;
          } else {
            activationFees += amount;
          }
          break;
        
        case 'SPIN_COST':
          spinCosts += amount;
          break;
        
        default:
          // Check if any document mentions content
          if (group.docs?.some((d: any) => d.description?.toLowerCase().includes('content'))) {
            contentPayments += amount;
          } else {
            otherRevenue += amount;
          }
      }
    }

    const totalCompanyRevenue = activationFees + unclaimedReferrals + spinCosts + contentPayments + otherRevenue;

    // Calculate Expense Breakdown from aggregation results
    let userPayouts = 0;
    let bonuses = 0;
    let referralCommissions = 0;
    let spinPrizes = 0;
    let taskPayments = 0;
    let surveyPayments = 0;
    let otherExpenses = 0;

    for (const group of expenseAgg) {
      const amount = group.total;
      
      switch (group._id) {
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
