import { NextRequest, NextResponse } from 'next/server';
import { TransactionLedger, Profile, connectToDatabase } from '@/app/lib/models';
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

    const transactions = await TransactionLedger.find(filter)
      .populate('referrer_id', 'username email')
      .populate('downline_user_id', 'username email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await TransactionLedger.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    const formattedTransactions = transactions.map((transaction: any) => ({
      id: transaction._id?.toString(),
      amount: transaction.amount_cents / 100,
      amount_cents: transaction.amount_cents,
      transaction_type: transaction.transaction_type,
      source: transaction.source,
      earning_source_type: transaction.earning_source_type || 'direct',
      description: transaction.description,
      status: transaction.status,
      date: transaction.created_at,
      
      // Payment method details
      payment_method: transaction.payment_method,
      coop_reference_id: transaction.coop_reference_id,
      mpesa_reference_id: transaction.mpesa_reference_id,
      
      // Downline commission details (if applicable)
      referrer_id: transaction.referrer_id?._id?.toString() || null,
      referrer_username: transaction.referrer_id?.username || null,
      downline_user_id: transaction.downline_user_id?._id?.toString() || null,
      downline_username: transaction.downline_user_id?.username || null,
      downline_level: transaction.downline_level || null,
      commission_percentage: transaction.commission_percentage || null,
      
      reference_id: transaction.reference_id,
      reference_type: transaction.reference_type,
      balance_after: transaction.balance_after_cents / 100,
      
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



