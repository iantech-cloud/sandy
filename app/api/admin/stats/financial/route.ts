import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile, Transaction, Company, Withdrawal } from '@/app/lib/models';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Verify admin access
    const adminUser = await (Profile as any).findOne({ email: session.user.email }).select('role').lean();
    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }
    
    // Get or create company record
    let company = await (Company as any).findOne({}).lean();
    if (!company) {
      company = {
        wallet_balance_cents: 0,
        total_revenue_cents: 0,
        total_expenses_cents: 0
      };
    }

    // Get all user balances (no hardcoded values)
    const userBalancesAgg = await (Profile as any).aggregate([
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$balance_cents' } 
        } 
      }
    ]);
    
    // Get pending withdrawals (real data)
    const pendingWithdrawalsAgg = await (Withdrawal as any).aggregate([
      { 
        $match: { status: 'pending' } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$amount_cents' },
          count: { $sum: 1 }
        } 
      }
    ]);

    const totalUserBalances = userBalancesAgg[0]?.total || 0;
    const pendingWithdrawalsAmount = pendingWithdrawalsAgg[0]?.total || 0;
    const pendingWithdrawalsCount = pendingWithdrawalsAgg[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        companyWalletBalance: company.wallet_balance_cents,
        totalCompanyRevenue: company.total_revenue_cents || 0,
        totalCompanyExpenses: company.total_expenses_cents || 0,
        netProfit: (company.total_revenue_cents || 0) - (company.total_expenses_cents || 0),
        totalUserBalances,
        pendingWithdrawalsAmount,
        pendingWithdrawalsCount
      }
    });
  } catch (error: any) {
    console.error('[v0] Financial stats error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
