import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, MpesaTransaction } from '@/app/lib/models';
import { createCoopBankService } from '@/app/lib/services/coop-bank';

/**
 * GET /api/payments/coop-bank/status/:messageReference
 * Checks the status of a transaction via Co-operative Bank API
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get authenticated user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract message reference from query params
    const { searchParams } = new URL(request.url);
    const messageReference = searchParams.get('messageReference');

    if (!messageReference) {
      return NextResponse.json(
        { success: false, error: 'messageReference query parameter is required' },
        { status: 400 }
      );
    }

    // Find transaction
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: messageReference,
      user_id: session.user.id,
    });

    if (!mpesaTransaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // If transaction is already in terminal state, return cached status
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status) && mpesaTransaction.metadata?.callback_processed) {
      console.log('[Status] Transaction already in terminal state:', mpesaTransaction.status);

      return NextResponse.json({
        success: true,
        data: {
          messageReference,
          status: mpesaTransaction.status,
          amount: mpesaTransaction.amount_cents / 100,
          cached: true,
          lastCheckedAt: mpesaTransaction.callback_received_at || mpesaTransaction.created_at,
        },
      });
    }

    // Query Co-op Bank API for live status
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(messageReference);

      console.log('[Status] Live status from Co-op Bank:', {
        messageReference,
        ResponseCode: statusResponse.ResponseCode,
        ResponseDescription: statusResponse.ResponseDescription,
      });

      // Map Co-op Bank ResponseCode to our internal status
      let mappedStatus: 'completed' | 'pending' | 'failed' = 'pending';
      if (statusResponse.ResponseCode === '0') {
        mappedStatus = 'completed';
      } else if (statusResponse.ResponseCode === '2002' || statusResponse.ResponseCode === '2001') {
        mappedStatus = 'failed';
      }

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
      console.error('[Status] Error querying Co-op Bank API:', apiError);

      // Fall back to database status if API fails
      return NextResponse.json({
        success: true,
        data: {
          messageReference,
          status: mpesaTransaction.status,
          amount: mpesaTransaction.amount_cents / 100,
          cached: true,
          fallback: true,
          message: 'Using cached status due to API unavailability',
          lastCheckedAt: mpesaTransaction.callback_received_at || mpesaTransaction.created_at,
        },
      });
    }
  } catch (error) {
    console.error('[Status] Error checking transaction status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check transaction status',
      },
      { status: 500 }
    );
  }
}
