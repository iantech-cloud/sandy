import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/daraja/b2b
 * 
 * B2B Payment - Business to Business Transfer
 * Used for inter-business payments, payroll to business accounts, fund transfers
 * 
 * Request body:
 * {
 *   "amount": 50000,
 *   "partyA": "600123",              // Sender short code
 *   "partyB": "600456",              // Receiver short code
 *   "accountReference": "INV-2024-001",
 *   "remarks": "Payment for services",
 *   "commandId": "BusinessPayBill",  // BusinessPayBill, MerchantToMerchantTransfer, DisburseFundsToBusiness
 *   "callbackUrl": "https://yourdomain.com/api/payments/daraja/callback"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      amount,
      partyA,
      partyB,
      accountReference,
      remarks = 'B2B Transfer',
      commandId = 'BusinessPayBill',
      callbackUrl,
    } = body;

    // Validate required fields
    if (!amount || !partyA || !partyB || !accountReference || !callbackUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, partyA, partyB, accountReference, callbackUrl' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Initiate B2B payment
    const result = await MpesaDarajaService.initiateB2BPayment(
      amount,
      partyA,
      partyB,
      accountReference,
      remarks,
      commandId,
      callbackUrl
    );

    if ('success' in result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'B2B payment initiation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'B2B payment initiated successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[B2B Payment API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to initiate B2B payment',
      },
      { status: 500 }
    );
  }
}
