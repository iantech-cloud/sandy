import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payments/daraja/c2b/validate
 * 
 * C2B Validation Endpoint
 * Called by Safaricom when a customer initiates a payment (Spin Wallet / Chat Foreigners)
 * Use this to validate if the payment should be accepted
 * 
 * Callback payload structure:
 * {
 *   "TransactionType":"Pay Bill",
 *   "TransID":"LGR41WUVF2",
 *   "TransTime":"20170727143625",
 *   "TransAmount":1000,
 *   "BusinessShortCode":"600123",
 *   "BillRefNumber":"ABC123",
 *   "InvoiceNumber":"INV001",
 *   "OrgAccountBalance":"49147.00",
 *   "ThirdPartyTransID":"",
 *   "MSISDN":"254712345678",
 *   "FirstName":"John"
 * }
 * 
 * Response must include:
 * {
 *   "ResultCode": 0,     // 0 = accept, non-zero = reject
 *   "ResultDesc": "Accepted"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[C2B Validation] Received:', JSON.stringify(body, null, 2));

    const {
      TransactionType,
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      MSISDN,
      FirstName,
    } = body;

    // TODO: Implement your validation logic here:
    // 1. Verify the bill reference number exists in your system
    // 2. Check if the customer has pending invoices
    // 3. Validate the amount matches expected payment
    // 4. Check for fraud/duplicate transactions
    // 5. Verify account status and limits

    // Example validation
    const isValid = await validatePayment({
      billRefNumber: BillRefNumber,
      amount: TransAmount,
      msisdn: MSISDN,
      shortCode: BusinessShortCode,
    });

    if (!isValid) {
      console.log('[C2B Validation] Payment rejected');
      return NextResponse.json(
        {
          ResultCode: 1,
          ResultDesc: 'Payment validation failed - invalid reference or amount',
        },
        { status: 200 }
      );
    }

    // Store validation details for confirmation step
    console.log('[C2B Validation] Payment accepted, awaiting confirmation', {
      transID: TransID,
      amount: TransAmount,
      msisdn: MSISDN,
      billRef: BillRefNumber,
    });

    return NextResponse.json(
      {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[C2B Validation] Error:', error);

    // Always return 200 to prevent Safaricom from retrying
    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Validation process error',
      },
      { status: 200 }
    );
  }
}

/**
 * Validate payment details
 * Replace with your actual business logic
 */
async function validatePayment(params: {
  billRefNumber: string;
  amount: number;
  msisdn: string;
  shortCode: string;
}): Promise<boolean> {
  // TODO: Implement your validation logic:
  // - Check if bill reference exists in database
  // - Verify customer account
  // - Check payment amount
  // - Verify short code matches your business
  // - Check fraud patterns

  // Placeholder: accept all for now
  return true;
}
