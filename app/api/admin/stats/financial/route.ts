import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    // Get financial metrics (simplified for demo)
    const companyWalletBalance = 1500000;
    const totalCompanyRevenue = 2500000;
    const totalCompanyExpenses = 850000;
    const netProfit = totalCompanyRevenue - totalCompanyExpenses;
    const totalUserBalances = 650000;
    const pendingWithdrawalsAmount = 185000;
    const pendingWithdrawalsCount = 45;

    return NextResponse.json({
      success: true,
      data: {
        companyWalletBalance,
        totalCompanyRevenue,
        totalCompanyExpenses,
        netProfit,
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
