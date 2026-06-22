import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase, ChatForeignersTransaction } from '@/app/lib/models';
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

    const currentUser = await Profile.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const sourceType = searchParams.get('sourceType') || 'all'; // 'all', 'direct', 'downline'
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const page = parseInt(searchParams.get('page') || '1');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filter for user transactions
    let filter: any = {};
    
    if (sourceType === 'direct') {
      // Only direct earnings (user is the earner)
      filter.user_id = currentUser._id.toString();
      filter.$or = [
        { earning_source_type: 'direct' },
        { earning_source_type: { $exists: false } } // backward compatibility
      ];
    } else if (sourceType === 'downline') {
      // Only downline earnings (user is the referrer)
      filter.referrer_id = currentUser._id.toString();
      filter.earning_source_type = 'downline';
    } else {
      // All earnings (both direct and downline)
      filter.$or = [
        { user_id: currentUser._id.toString() },
        { referrer_id: currentUser._id.toString() }
      ];
    }

    if (source) {
      filter.source = source;
    }

    if (status) {
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

    const skip = (page - 1) * limit;

    // Query both old and new transaction collections
    const [newTransactions, oldTransactions] = await Promise.all([
      TransactionLedger.find(filter)
        .populate('referrer_id', 'username email')
        .populate('downline_user_id', 'username email')
        .sort({ created_at: -1 })
        .lean(),
      // For old transactions, search by user_id
      (ChatForeignersTransaction as any).find({
        user_id: currentUser._id.toString(),
        ...(status && { status })
      })
        .sort({ created_at: -1 })
        .lean()
    ]);

    // Combine and deduplicate transactions
    const allTransactions = [
      ...newTransactions,
      ...oldTransactions
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = allTransactions.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Apply pagination after combining
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    // Format transactions with N/A for missing fields
    const formattedTransactions = paginatedTransactions.map((transaction: any) => ({
      id: transaction._id?.toString() || 'N/A',
      amount: (transaction.amount_cents || transaction.amount) ? (transaction.amount_cents || transaction.amount * 100) / 100 : 0,
      amount_cents: transaction.amount_cents || (transaction.amount ? transaction.amount * 100 : 0),
      transaction_type: transaction.transaction_type || transaction.type || 'N/A',
      source: transaction.source || transaction.type || 'N/A',
      earning_source_type: transaction.earning_source_type || transaction.target_type || 'N/A',
      description: transaction.description || 'N/A',
      status: transaction.status || 'N/A',
      date: transaction.created_at || transaction.created_at || 'N/A',
      
      // Payment method details
      payment_method: transaction.payment_method || 'N/A',
      coop_reference_id: transaction.coop_reference_id || 'N/A',
      mpesa_reference_id: transaction.mpesa_reference_id || 'N/A',
      
      // Downline commission details (if applicable)
      referrer_id: transaction.referrer_id?._id?.toString() || transaction.referrer_id?.toString() || 'N/A',
      referrer_username: transaction.referrer_id?.username || 'N/A',
      downline_user_id: transaction.downline_user_id?._id?.toString() || 'N/A',
      downline_username: transaction.downline_user_id?.username || 'N/A',
      downline_level: transaction.downline_level || 'N/A',
      commission_percentage: transaction.commission_percentage || 'N/A',
      
      reference_id: transaction.reference_id || 'N/A',
      reference_type: transaction.reference_type || transaction.type || 'N/A',
      balance_after: transaction.balance_after_cents ? transaction.balance_after_cents / 100 : 'N/A',
      
      metadata: transaction.metadata || {}
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit
        }
      },
      message: 'Transactions fetched successfully'
    });

  } catch (error) {
    console.error('Transactions API Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal Server Error while fetching transactions.' 
      },
      { status: 500 }
    );
  }
}



