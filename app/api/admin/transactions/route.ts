import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  connectToDatabase,
  Profile,
  Transaction,
  Withdrawal,
  MpesaTransaction
} from '@/app/lib/models';

/**
 * GET /api/admin/transactions
 * Fetches paginated transactions with filtering, stats, and summaries
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is admin (you may want to add an isAdmin check here)
    await connectToDatabase();
    const user = await Profile.findOne({ email: session.user.email }).lean();
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const source = searchParams.get('source');
    const sourceType = searchParams.get('sourceType');
    const status = searchParams.get('status');
    const coopRef = searchParams.get('coopRef');
    const mpesaRef = searchParams.get('mpesaRef');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query filter
    const query: any = {};

    if (source && source !== 'all') {
      query.source = source;
    }

    if (sourceType && sourceType !== 'all') {
      query.earning_source_type = sourceType;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (coopRef) {
      query.coop_reference_id = { $regex: coopRef, $options: 'i' };
    }

    if (mpesaRef) {
      query.mpesa_reference_id = { $regex: mpesaRef, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      query.created_at = {};
      if (dateFrom) {
        query.created_at.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.created_at.$lte = toDate;
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute parallel queries: get transactions count and data
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('user_id', 'username email')
        .populate('mpesa_transaction_id', 'mpesa_receipt_number phone_number')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    // Transform transactions for response
    const transformedTransactions = transactions.map((txn: any) => ({
      id: txn._id?.toString(),
      user_id: txn.user_id?._id?.toString() || null,
      user_email: txn.user_id?.email || 'System',
      user_username: txn.user_id?.username || 'System',
      amount: txn.amount_cents ? txn.amount_cents / 100 : 0,
      amount_cents: txn.amount_cents || 0,
      transaction_type: txn.type?.includes('DEPOSIT') || txn.type?.includes('BONUS') ? 'credit' : 'debit',
      type: txn.type || 'UNKNOWN',
      type_label: txn.type_label || txn.type || 'N/A',
      source: txn.source || 'wallet',
      earning_source_type: txn.earning_source_type || 'direct',
      status: txn.status || 'pending',
      description: txn.description || '',
      date: txn.created_at?.toISOString() || new Date().toISOString(),
      target: txn.target_type === 'company' ? 'Company' : 'User Wallet',
      coop_reference_id: txn.coop_reference_id || null,
      mpesa_reference_id: txn.mpesa_transaction_id?.mpesa_receipt_number || txn.mpesa_reference_id || null,
      balance_after: txn.balance_after || null,
      collection: txn.collection || null,
      mpesa_transaction_id: txn.mpesa_transaction_id?._id?.toString() || null,
      target_type: txn.target_type || 'user',
      target_id: txn.target_id?.toString() || txn.user_id?._id?.toString() || null
    }));

    // Calculate summary statistics using aggregation pipeline
    const summary = await Transaction.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      { $eq: ['$target_type', 'company'] },
                      { $divide: ['$amount_cents', 100] },
                      0
                    ]
                  }
                },
                totalPayouts: {
                  $sum: {
                    $cond: [
                      { $eq: ['$target_type', 'user'] },
                      { $divide: ['$amount_cents', 100] },
                      0
                    ]
                  }
                }
              }
            }
          ],
          byCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const totals = summary[0]?.totals[0] || {};
    const statusCounts = summary[0]?.byCounts || [];

    const statusMap: { [key: string]: number } = {};
    statusCounts.forEach((item: any) => {
      statusMap[item._id] = item.count;
    });

    const summaryData = {
      totalCount: totals.totalCount || 0,
      totalRevenue: totals.totalRevenue || 0,
      totalPayouts: totals.totalPayouts || 0,
      completedCount: statusMap['completed'] || 0,
      pendingCount: statusMap['pending'] || 0,
      failedCount: statusMap['failed'] || 0
    };

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        transactions: transformedTransactions,
        pagination: {
          page,
          limit,
          total,
          pages
        },
        summary: summaryData
      },
      message: 'Transactions fetched successfully'
    });

  } catch (error) {
    console.error('Get admin transactions error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch transactions', error: String(error) },
      { status: 500 }
    );
  }
}
