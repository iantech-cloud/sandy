import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, MpesaTransaction, Transaction } from '@/app/lib/models';
import { createCoopBankService, CoopBankService } from '@/app/lib/services/coop-bank';

// ---------------------------------------------------------------------------
// Shared handler — resolves a message reference from either a GET query param
// or a POST JSON body, then returns the transaction status.
// ---------------------------------------------------------------------------

async function handleStatusCheck(request: NextRequest, messageReferenceFromPath?: string) {
  try {
    await connectToDatabase();

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Resolve the message reference from the request
    let messageReference: string | null = messageReferenceFromPath || null;

    if (!messageReference) {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          messageReference = body?.MessageReference || body?.messageReference || null;
        } catch {
          // Body parse failed — fall through to check query params
        }
      }
    }

    if (!messageReference) {
      const { searchParams } = new URL(request.url);
      messageReference =
        searchParams.get('MessageReference') ||
        searchParams.get('messageReference') ||
        null;
    }

    if (!messageReference) {
      return NextResponse.json(
        {
          success: false,
          error: 'messageReference is required (query param or JSON body field "MessageReference")',
        },
        { status: 400 }
      );
    }

    console.log('[CoopStatus] Checking transaction:', {
      messageReference,
      userId: session.user.id,
    });

    // Find transaction — scoped to the authenticated user
    // Support both checkout_request_id and account_reference lookups
    const mpesaTransaction = await MpesaTransaction.findOne({
      $or: [
        { checkout_request_id: messageReference },
        { account_reference: messageReference }
      ],
      user_id: session.user.id,
    });

    if (!mpesaTransaction) {
      console.warn('[CoopStatus] Transaction not found for:', messageReference);
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    console.log('[CoopStatus] Transaction found:', {
      id: mpesaTransaction._id,
      status: mpesaTransaction.status,
      amount: mpesaTransaction.amount_cents,
    });

    // Terminal state — return cached status immediately (avoid unnecessary API call)
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (
      terminalStatuses.includes(mpesaTransaction.status) &&
      mpesaTransaction.metadata?.callback_processed
    ) {
      console.log('[CoopStatus] Returning cached terminal status:', mpesaTransaction.status);
      return NextResponse.json({
        success: true,
        data: {
          messageReference,
          status: mpesaTransaction.status,
          amount: mpesaTransaction.amount_cents / 100,
          cached: true,
          lastCheckedAt:
            mpesaTransaction.callback_received_at || mpesaTransaction.created_at,
        },
      });
    }

    // Not yet terminal — query Co-op Bank Enquiry API
    console.log('[CoopStatus] Querying Co-op Bank API for status...');
    // POST /Enquiry/STK/1.0.0/ with body { MessageReference }
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(messageReference);

      console.log('[CoopStatus] API Response:', statusResponse);

      // Use the canonical mapping from the service (consistent with the callback route)
      const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

      console.log('[CoopStatus] Mapped status:', {
        responseCode: statusResponse.ResponseCode,
        mappedStatus,
      });

      // Persist the updated status if we got a terminal result
      if (terminalStatuses.includes(mappedStatus)) {
        console.log('[CoopStatus] Persisting terminal status to DB...');
        
        // Extract M-Pesa receipt and operator transaction ID (returned on completed transactions)
        const mpesaReceiptNumber = statusResponse.ReceiptNumber || null;
        const operatorTxnID = statusResponse.OperatorTxnID || null;
        
        const updateData: any = {
          status: mappedStatus,
          result_code: parseInt(statusResponse.ResponseCode || '1', 10),
          result_desc: statusResponse.ResponseDescription || '',
          ...(mappedStatus === 'completed'
            ? { completed_at: new Date() }
            : { failed_at: new Date() }),
        };
        
        // Persist receipt numbers if available
        if (mpesaReceiptNumber) {
          updateData.mpesa_receipt_number = mpesaReceiptNumber;
        }
        
        await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, updateData);
        
        // Also update the linked Transaction ledger record with the transaction code
        if (mappedStatus === 'completed' && operatorTxnID) {
          await (Transaction as any).findOneAndUpdate(
            { mpesa_transaction_id: mpesaTransaction._id },
            { transaction_code: operatorTxnID }
          );
        }
      }

      console.log('[CoopStatus] Returning live status:', mappedStatus);
      return NextResponse.json({
        success: true,
        data: {
          messageReference,
          status: mappedStatus,
          amount: mpesaTransaction.amount_cents / 100,
          cached: false,
          lastCheckedAt: new Date(),
          liveData: {
            responseCode: statusResponse.ResponseCode,
            responseDescription: statusResponse.ResponseDescription,
          },
        },
      });
    } catch (apiError) {
      console.error('[CoopStatus] Co-op Bank API error:', apiError, 'for messageReference:', messageReference);

      // Fallback to cached DB status when the API is unreachable
      return NextResponse.json({
        success: true,
        data: {
          messageReference,
          status: mpesaTransaction.status,
          amount: mpesaTransaction.amount_cents / 100,
          cached: true,
          fallback: true,
          message: 'Using cached status — Co-op Bank API temporarily unavailable',
          lastCheckedAt:
            mpesaTransaction.callback_received_at || mpesaTransaction.created_at,
        },
      });
    }
  } catch (error) {
    console.error('[CoopStatus] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check transaction status',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET  /api/payments/coop-bank/status?messageReference=<ref>
// POST /api/payments/coop-bank/status   body: { "MessageReference": "<ref>" }
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  return handleStatusCheck(request);
}

export async function POST(request: NextRequest) {
  return handleStatusCheck(request);
}
