import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; 
import { connectToDatabase, Profile, CoopBankPayment } from '@/app/lib/models';
import { TransactionLedger } from '@/app/lib/models/RevenueStreams';

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

    const user = await Profile.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const source = searchParams.get('source') || 'all';
    const status = searchParams.get('status') || 'all';
    const sourceType = searchParams.get('sourceType') || 'all';
    const coopRef = searchParams.get('coopRef') || '';
    const mpesaRef = searchParams.get('mpesaRef') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const skip = (page - 1) * limit;

    let query: any = {};
    
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
      query.coop_reference_id = new RegExp(coopRef, 'i');
    }

    if (mpesaRef) {
      query.mpesa_reference_id = new RegExp(mpesaRef, 'i');
    }
    
    if (dateFrom || dateTo) {
      query.created_at = {};
      if (dateFrom) {
        query.created_at.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.created_at.$lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Get total count for pagination
    const total = await TransactionLedger.countDocuments(query);
    const pages = Math.ceil(total / limit);

    const transactions = await TransactionLedger.find(query)
      .populate('user_id', 'username email')
      .populate('referrer_id', 'username email')
      .populate('downline_user_id', 'username email')
      .populate('coop_bank_payment_id', 'coop_transaction_id')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const transformedTransactions = transactions.map((txn: any) => ({
      id: txn._id.toString(),
      user_id: txn.user_id?._id?.toString() || null,
      user_email: txn.user_id?.email || 'System',
      user_username: txn.user_id?.username || 'System',
      amount: txn.amount_cents / 100,
      amount_cents: txn.amount_cents,
      transaction_type: txn.transaction_type,
      source: txn.source,
      earning_source_type: txn.earning_source_type || 'direct',
      status: txn.status,
      description: txn.description,
      date: txn.created_at,
      
      // Downline commission details
      referrer_id: txn.referrer_id?._id?.toString() || null,
      referrer_email: txn.referrer_id?.email || null,
      referrer_username: txn.referrer_id?.username || null,
      downline_user_id: txn.downline_user_id?._id?.toString() || null,
      downline_user_email: txn.downline_user_id?.email || null,
      downline_level: txn.downline_level || null,
      commission_percentage: txn.commission_percentage || null,
      
      // Payment method tracking
      payment_method: txn.payment_method || null,
      coop_reference_id: txn.coop_reference_id || null,
      mpesa_reference_id: txn.mpesa_reference_id || null,
      coop_bank_transaction_id: txn.coop_bank_payment_id?.coop_transaction_id || null,
      
      reference_id: txn.reference_id || null,
      reference_type: txn.reference_type || null,
      balance_after: txn.balance_after_cents / 100,
      
      metadata: txn.metadata || {}
    }));

    return NextResponse.json({
      success: true,
      data: { 
        transactions: transformedTransactions,
        count: transformedTransactions.length,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      },
      message: 'Transactions fetched successfully'
    });

  } catch (error) {
    console.error('Admin transactions API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

