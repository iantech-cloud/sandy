import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';
import { DarajaCallbackBody } from '@/app/lib/types/mpesa-daraja';

/**
 * POST /api/payments/daraja/callback
 * 
 * Webhook endpoint that receives M-PESA transaction callbacks
 * Called by Safaricom Daraja platform when a transaction completes/fails
 * 
 * This is configured in the STK Push request as the CallBackURL
 */
export async function POST(request: NextRequest) {
  try {
    const body: DarajaCallbackBody = await request.json();

    console.log('[Daraja Callback] Received callback:', JSON.stringify(body, null, 2));

    // Validate callback structure
    if (!body.Body?.stkCallback) {
      console.warn('[Daraja Callback] Invalid callback structure');
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: 'Invalid callback structure' },
        { status: 400 }
      );
    }

    // Process the callback
    const callbackResult = await MpesaDarajaService.handleWebhookCallback(body);

    console.log('[Daraja Callback] Processed callback:', callbackResult);

    // Extract transaction details for further processing
    const stkCallback = body.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    // TODO: Implement your business logic here:
    // 1. If resultCode === 0 (success):
    //    - Update payment status in your database
    //    - Credit user's wallet/account
    //    - Send confirmation email/SMS
    //    - Trigger downstream actions (job completion, gig payment, etc.)
    //
    // 2. If resultCode !== 0 (user cancelled or error):
    //    - Update payment status to failed/cancelled
    //    - Notify user
    //    - Clean up any temporary records

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json(
      { ResultCode: 0, ResultDesc: 'Callback processed successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Daraja Callback] Error processing callback:', error);

    // Still return 200 to prevent Safaricom from retrying
    // But log the error for investigation
    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Callback processing error',
        error: error.message,
      },
      { status: 200 }
    );
  }
}
