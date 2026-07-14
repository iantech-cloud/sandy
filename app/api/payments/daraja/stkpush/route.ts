import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/daraja/stkpush
 * 
 * Initiates an M-PESA Express (STK Push) payment request
 * Sends a prompt to the customer's phone to enter their M-PESA PIN
 * 
 * Request body:
 * {
 *   "amount": 100,
 *   "phoneNumber": "254791234567", // or "0791234567" or "+254791234567"
 *   "accountReference": "INV12345",
 *   "description": "Payment for services"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "checkoutRequestId": "ws_CO_...",
 *   "merchantRequestId": "16813-3651308-1",
 *   "message": "Payment initiated successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { amount, phoneNumber, accountReference, description } = body;

    // Validate required fields
    if (!amount || !phoneNumber || !accountReference) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: amount, phoneNumber, accountReference',
        },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount must be greater than 0',
        },
        { status: 400 }
      );
    }

    // Generate callback URL
    const baseUrl = process.env.BASE_URL || request.nextUrl.origin;
    const callbackUrl = `${baseUrl}/api/payments/daraja/callback`;

    // Initiate payment
    const paymentResponse = await MpesaDarajaService.initiatePayment(
      {
        amount,
        phoneNumber,
        accountReference,
        description,
      },
      callbackUrl
    );

    if (paymentResponse.success) {
      return NextResponse.json(paymentResponse, { status: 200 });
    } else {
      return NextResponse.json(paymentResponse, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Daraja STK Push API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Payment initiation failed',
      },
      { status: 500 }
    );
  }
}
