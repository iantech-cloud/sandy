import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, validatePaginationParams, buildPaginationMeta } from '../middleware';
import { connectToDatabase, Transaction } from '@/app/lib/models';

const TYPE_LABELS: Record<string, string> = {
  REFERRAL: 'Referral Bonus',
  ACTIVATION_FEE: 'Account Activation',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  BONUS: 'Bonus',
  TASK_PAYMENT: 'Task Payment',
  SPIN_WIN: 'Spin Win',
  SPIN_PRIZE: 'Spin Prize',
  SPIN_COST: 'Spin Entry Cost',
  SURVEY: 'Survey Reward',
  ADMIN_CREDIT: 'Admin Credit',
  ADMIN_DEBIT: 'Admin Debit',
  COMPANY_REVENUE: 'Platform Fee',
};

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

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { skip, limit: parsedLimit } = validatePaginationParams(page, limit);

    // Build filter
    const filter: any = {};

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) {
        filter.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.created_at.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await Transaction.countDocuments(filter);

    // Fetch paginated transactions
    const transactions = await Transaction.find(filter)
      .select('_id type amount status target_type created_at user_id description')
      .populate('user_id', 'email username')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map((t: any) => ({
          _id: t._id?.toString(),
          type: t.type,
          typeLabel: TYPE_LABELS[t.type] || t.type,
          amount: t.amount,
          status: t.status,
          targetType: t.target_type,
          user: t.user_id ? {
            _id: t.user_id._id?.toString(),
            email: t.user_id.email,
            username: t.user_id.username,
          } : null,
          description: t.description,
          createdAt: t.created_at?.toISOString(),
        })),
        pagination,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[v0] Admin transactions API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
