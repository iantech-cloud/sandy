import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersMpesaTransaction } from '@/app/lib/models';
import { getCurrentUser } from '@/app/actions/auth';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const checkoutRequestId = request.nextUrl.searchParams.get('checkoutRequestId');
    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, error: 'checkoutRequestId is required' },
        { status: 400 }
      );
    }

    const mpesaTxn = await ChatForeignersMpesaTransaction.findOne({
      checkout_request_id: checkoutRequestId,
    });

    if (!mpesaTxn) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: mpesaTxn.status,
        transactionType: mpesaTxn.transaction_type,
        amount_cents: mpesaTxn.amount_cents,
        mpesaReceiptNumber: mpesaTxn.mpesa_receipt_number,
        resultCode: mpesaTxn.result_code,
        resultDesc: mpesaTxn.result_desc,
      },
    });
  } catch (error) {
    console.error('[API] Payment status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
