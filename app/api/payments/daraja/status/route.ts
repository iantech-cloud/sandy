import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/daraja/status
 * 
 * Queries the status of an M-PESA transaction
 * Can be called to check if a payment succeeded or failed
 * 
 * Request body:
 * {
 *   "checkoutRequestId": "ws_CO_191220191020375734"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "resultCode": 0,
 *   "resultDesc": "The service request has been accepted successfully",
 *   "amount": 1000,
 *   "mpesaReceiptNumber": "PEG4K1GTRY",
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkoutRequestId } = body;

    if (!checkoutRequestId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: checkoutRequestId',
        },
        { status: 400 }
      );
    }

    // Query transaction status
    const statusResponse = await MpesaDarajaService.checkTransactionStatus(
      checkoutRequestId
    );

    // Determine if transaction was successful
    const success = statusResponse.ResponseCode === '0';

    return NextResponse.json(
      {
        success,
        resultCode: statusResponse.ResultCode,
        resultDesc: statusResponse.ResultDesc,
        amount: statusResponse.Amount,
        mpesaReceiptNumber: statusResponse.MpesaReceiptNumber,
        transactionDate: statusResponse.TransactionDate,
        responseCode: statusResponse.ResponseCode,
        responseDescription: statusResponse.ResponseDescription,
      },
      { status: success ? 200 : 400 }
    );
  } catch (error: any) {
    console.error('[Daraja Status API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Status query failed',
      },
      { status: 500 }
    );
  }
}
