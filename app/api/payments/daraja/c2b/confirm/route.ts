import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payments/daraja/c2b/confirm
 * 
 * C2B Confirmation Endpoint
 * Called by Safaricom after payment is successfully received
 * Use this to confirm/settle the payment in your system
 * 
 * Callback payload structure (same as validation):
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
 * This endpoint receives the same data twice:
 * 1. First during validation phase (validate endpoint)
 * 2. Second during confirmation phase (this endpoint) - after money is received
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[C2B Confirmation] Received:', JSON.stringify(body, null, 2));

    const {
      TransactionType,
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
    } = body;

    // TODO: Implement your confirmation logic here:
    // 1. Update payment status to "Completed"
    // 2. Mark invoice as paid
    // 3. Update customer balance/account
    // 4. Update business account balance
    // 5. Send payment confirmation to customer (SMS/Email)
    // 6. Trigger any downstream workflows (gig completion, freelancer payment, etc.)
    // 7. Log transaction for reconciliation

    const confirmationResult = await confirmPayment({
      transID: TransID,
      amount: TransAmount,
      msisdn: MSISDN,
      billRef: BillRefNumber,
      invoiceNumber: InvoiceNumber,
      transTime: TransTime,
      firstName: FirstName,
      orgBalance: OrgAccountBalance,
    });

    if (!confirmationResult.success) {
      console.error('[C2B Confirmation] Failed to process payment:', confirmationResult.error);
      // Still return 200 to prevent re-delivery
      return NextResponse.json(
        {
          ResultCode: 1,
          ResultDesc: `Confirmation error: ${confirmationResult.error}`,
        },
        { status: 200 }
      );
    }

    console.log('[C2B Confirmation] Payment confirmed successfully', {
      transID: TransID,
      amount: TransAmount,
      msisdn: MSISDN,
    });

    return NextResponse.json(
      {
        ResultCode: 0,
        ResultDesc: 'Confirmation received successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[C2B Confirmation] Error:', error);

    // Always return 200 to prevent Safaricom from retrying
    return NextResponse.json(
      {
        ResultCode: 1,
        ResultDesc: 'Confirmation process error',
      },
      { status: 200 }
    );
  }
}

/**
 * Process and confirm payment in your system
 * Replace with your actual business logic
 */
async function confirmPayment(params: {
  transID: string;
  amount: number;
  msisdn: string;
  billRef: string;
  invoiceNumber?: string;
  transTime: string;
  firstName?: string;
  orgBalance?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Implement your confirmation logic:
    // 1. Find payment record by transID or bill reference
    // 2. Verify amount matches
    // 3. Update payment status in database
    // 4. Update invoice status to PAID
    // 5. Create accounting entries
    // 6. Send notifications
    // 7. Trigger post-payment workflows

    console.log('[confirmPayment] Processing:', {
      transID: params.transID,
      amount: params.amount,
      msisdn: params.msisdn,
      billRef: params.billRef,
    });

    // Placeholder: simulate database update
    // const result = await db.payments.update({
    //   where: { reference: params.billRef },
    //   data: {
    //     status: 'CONFIRMED',
    //     mpesaTransactionId: params.transID,
    //     confirmedAt: new Date(),
    //   }
    // });

    // Example: Send confirmation SMS
    // await sendSMS(params.msisdn, `Payment of KES ${params.amount} confirmed. Ref: ${params.transID}`);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
