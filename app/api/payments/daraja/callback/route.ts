import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';
import { DarajaCallbackBody } from '@/app/lib/types/mpesa-daraja';
import { verifySafaricomRequest } from '@/app/lib/middleware/verify-safaricom';

/**
 * POST /api/payments/daraja/callback
 * 
 * Webhook endpoint that receives M-PESA transaction callbacks
 * Called by Safaricom Daraja platform when transaction completes/fails
 * Handles: STK Push, B2C, B2B, and other async transaction callbacks
 * 
 * Security:
 * - Verifies request comes from whitelisted Safaricom IPs
 * - Validates JSON payload structure
 * - Logs all callbacks for audit trail
 * 
 * This endpoint is configured in requests as the CallBackURL/ResultURL
 * Examples:
 * - STK Push: CallBackURL parameter
 * - B2C: ResultURL parameter
 * - B2B: ResultURL parameter
 * - Balance: ResultURL parameter
 * - Reversal: ResultURL parameter
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from Safaricom (with IP whitelisting)
    const verification = await verifySafaricomRequest(request);
    
    if (!verification.valid) {
      console.warn('[Daraja Callback] Request verification failed:', {
        error: verification.error,
        clientIp: verification.clientIp,
      });
      
      // In production, reject invalid requests
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { ResultCode: 1, ResultDesc: verification.error },
          { status: verification.status || 403 }
        );
      }
      
      // In development, log but allow for testing
      console.warn('[Daraja Callback] Development mode: allowing unverified request');
    }

    const body: DarajaCallbackBody = await request.json();

    console.log('[Daraja Callback] Received callback from:', verification.clientIp);
    console.log('[Daraja Callback] Callback data:', JSON.stringify(body, null, 2));

    // Validate callback structure
    if (!body.Body?.stkCallback) {
      console.warn('[Daraja Callback] Invalid callback structure');
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: 'Invalid callback structure' },
        { status: 200 } // Return 200 even on validation error to prevent retries
      );
    }

    // Process the callback
    const callbackResult = await MpesaDarajaService.handleWebhookCallback(body);

    console.log('[Daraja Callback] Processed callback:', callbackResult);

    // Extract transaction details
    const stkCallback = body.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // TODO: Implement your business logic here:
    // This is where you integrate with your HustleHub Africa system
    //
    // 1. If resultCode === 0 (success):
    //    - Find payment record by checkoutRequestId or merchantRequestId
    //    - Extract amount, phone, receipt number from CallbackMetadata
    //    - Update payment status to 'COMPLETED' in your database
    //    - Credit freelancer/gig worker wallet
    //    - Update job/gig status
    //    - Send SMS/Email confirmation to user
    //    - Log transaction for accounting
    //    - Trigger downstream workflows (rate user, send thank you, etc.)
    //
    // 2. If resultCode === 1 (user cancelled):
    //    - Update payment status to 'CANCELLED'
    //    - Notify user their payment was cancelled
    //    - Offer to retry
    //
    // 3. If resultCode !== 0 and !== 1 (error/timeout):
    //    - Update payment status to 'FAILED'
    //    - Log error details
    //    - Alert support team if critical error
    //    - Offer user to retry

    // Example implementation:
    /*
    if (resultCode === 0) {
      // Extract payment details
      const amount = stkCallback.CallbackMetadata?.Item?.find(
        (item) => item.Name === 'Amount'
      )?.Value;
      const mpesaReceiptNumber = stkCallback.CallbackMetadata?.Item?.find(
        (item) => item.Name === 'MpesaReceiptNumber'
      )?.Value;
      
      // Update database
      await updatePayment(checkoutRequestId, {
        status: 'COMPLETED',
        resultCode,
        mpesaReceiptNumber,
        amount,
        completedAt: new Date(),
      });
      
      // Send confirmation
      await sendPaymentConfirmation(checkoutRequestId);
    }
    */

    // Always return 200 OK to acknowledge receipt
    // Safaricom will retry if we return 4xx or 5xx
    return NextResponse.json(
      { ResultCode: 0, ResultDesc: 'Callback processed successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Daraja Callback] Error processing callback:', error);
    console.error('[Daraja Callback] Stack trace:', error.stack);

    // Still return 200 to prevent Safaricom from retrying
    // Log the error for investigation
    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Callback processing error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 200 }
    );
  }
}
