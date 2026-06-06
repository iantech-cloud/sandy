import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, ChatForeignersMpesaTransaction, ChatForeignersPayment } from '@/app/lib/models';
import { createCoopBankService, CoopBankService } from '@/app/lib/services/coop-bank';
import { completeBotUnlockPayment } from '@/app/actions/chat-foreigners/payments';

/**
 * GET /api/chat-foreigners/payments/status
 *
 * Accepts EITHER:
 *   ?messageReference=<ref>   — look up by checkout_request_id, query Co-op Bank Enquiry API
 *                                exactly like the activation status route (preferred).
 *   ?paymentId=<id>           — legacy: look up ChatForeignersPayment by _id only (no live query).
 *
 * The messageReference path mirrors /api/payments/coop-bank/status so the same
 * polling / backoff behaviour works for both the activation and chat-unlock flows.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const messageReference = searchParams.get('messageReference');
    const paymentId = searchParams.get('paymentId');

    // ----------------------------------------------------------------
    // Path A — messageReference: query Co-op Bank Enquiry API (primary)
    // ----------------------------------------------------------------
    if (messageReference) {
      const mpesaTxn = await ChatForeignersMpesaTransaction.findOne({
        checkout_request_id: messageReference,
      });

      if (!mpesaTxn) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
      }

      const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];

      // Return cached terminal state immediately (avoid unnecessary API call)
      if (terminalStatuses.includes(mpesaTxn.status) && mpesaTxn.metadata?.callback_processed) {
        console.log('[CF Status] Cached terminal status:', mpesaTxn.status);
        return NextResponse.json({
          success: true,
          data: {
            messageReference,
            status: mpesaTxn.status,
            amount: mpesaTxn.amount_cents / 100,
            mpesaReceiptNumber: mpesaTxn.mpesa_receipt_number,
            resultCode: mpesaTxn.result_code?.toString(),
            resultDesc: mpesaTxn.result_desc,
            cached: true,
          },
        });
      }

      // Query Co-op Bank Enquiry API — same as activation status route
      try {
        const coopBank = createCoopBankService();
        const statusResponse = await coopBank.getTransactionStatus(messageReference);
        const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

        console.log('[CF Status] API response:', {
          messageReference,
          responseCode: statusResponse.ResponseCode,
          mappedStatus,
        });

        // Persist terminal status
        if (terminalStatuses.includes(mappedStatus)) {
          const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
          await ChatForeignersMpesaTransaction.findByIdAndUpdate(mpesaTxn._id, {
            status: mappedStatus,
            result_code: isNaN(resultCode) ? 1 : resultCode,
            result_desc: statusResponse.ResponseDescription || '',
            ...(mappedStatus === 'completed' ? { completed_at: new Date() } : { failed_at: new Date() }),
          });

          // If completed and unlock not yet recorded, complete it now (callback-miss recovery)
          if (mappedStatus === 'completed') {
            const payment = await ChatForeignersPayment.findOne({
              mpesa_transaction_id: mpesaTxn._id,
            });
            if (payment && payment.status !== 'completed') {
              console.log('[CF Status] Completing unlock from status poll (callback missed)');
              try {
                await completeBotUnlockPayment(mpesaTxn._id.toString());
              } catch (completionErr) {
                console.error('[CF Status] completeBotUnlockPayment error:', completionErr);
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            messageReference,
            status: mappedStatus,
            amount: mpesaTxn.amount_cents / 100,
            cached: false,
            liveData: {
              responseCode: statusResponse.ResponseCode,
              responseDescription: statusResponse.ResponseDescription,
            },
          },
        });
      } catch (apiError) {
        console.error('[CF Status] Co-op Bank API error, falling back to DB:', apiError);
        // Fallback: return last known DB status
        return NextResponse.json({
          success: true,
          data: {
            messageReference,
            status: mpesaTxn.status,
            amount: mpesaTxn.amount_cents / 100,
            cached: true,
            fallback: true,
          },
        });
      }
    }

    // ----------------------------------------------------------------
    // Path B — paymentId legacy lookup (DB only, no live Co-op query)
    // ----------------------------------------------------------------
    if (paymentId) {
      const payment = await ChatForeignersPayment.findById(paymentId);
      if (!payment) {
        return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: {
          status: payment.status,
          amount_cents: payment.amount_cents,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'messageReference or paymentId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CF Status] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
