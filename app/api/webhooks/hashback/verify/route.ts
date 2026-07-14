import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ActivationPayment } from '@/app/lib/models';
import { auth } from '@/auth';

/**
 * HashBack Payment Verification Endpoint
 * Called from client after successful M-Pesa payment
 * Polls server to check if webhook has been received and processed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const body = await request.json();
    const { reference, amount, receipt, checkoutId } = body;

    if (!reference || !amount || !receipt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[v0] Verifying HashBack payment:', {
      reference,
      amount,
      receipt,
      userId: session.user.id,
    });

    // Look for completed payment record
    const payment = await ActivationPayment.findOne({
      user_id: session.user.id,
      hashback_receipt: receipt,
      status: 'completed',
    });

    if (payment) {
      console.log('[v0] HashBack payment verified:', payment._id);
      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Payment verified',
        paymentId: payment._id,
      });
    }

    // Payment not yet verified (webhook may not have been received)
    // Check if we have a pending payment for this checkout
    const pendingPayment = await ActivationPayment.findOne({
      user_id: session.user.id,
      hashback_checkout_id: checkoutId,
      status: 'pending',
    });

    if (pendingPayment) {
      console.log('[v0] Payment pending webhook confirmation:', checkoutId);
      return NextResponse.json({
        success: true,
        verified: false,
        message: 'Payment pending confirmation',
        paymentId: pendingPayment._id,
      });
    }

    console.log('[v0] No payment record found for:', reference);
    return NextResponse.json(
      { success: false, error: 'Payment not found', verified: false },
      { status: 404 }
    );
  } catch (error) {
    console.error('[v0] Error verifying HashBack payment:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
