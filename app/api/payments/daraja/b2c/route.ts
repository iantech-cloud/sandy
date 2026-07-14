import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/daraja/b2c
 * 
 * B2C Payment - Spin Wallet Payout
 * Initiates a payment from business to customer (wallet credit/salary/promotion)
 * 
 * Request body:
 * {
 *   "phoneNumber": "254712345678",
 *   "amount": 5000,
 *   "commandId": "BusinessPayment",  // SalaryPayment, BusinessPayment, PromotionPayment
 *   "remarks": "Salary payment",
 *   "callbackUrl": "https://yourdomain.com/api/payments/daraja/callback"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication (implement based on your auth system)
    const auth = request.headers.get('authorization');
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber, amount, commandId = 'BusinessPayment', remarks, callbackUrl } = body;

    // Validate required fields
    if (!phoneNumber || !amount || !callbackUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumber, amount, callbackUrl' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Initiate B2C payment
    const result = await MpesaDarajaService.initiateB2CPayment(
      phoneNumber,
      amount,
      commandId,
      remarks || 'HustleHub Africa Payment',
      callbackUrl
    );

    if ('success' in result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'B2C payment initiation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'B2C payment initiated successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[B2C Payment API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to initiate B2C payment',
      },
      { status: 500 }
    );
  }
}
