import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ActivationPayment, Profile } from '@/app/lib/models';

const WEBHOOK_SECRET = process.env.HASHBACK_WEBHOOK_SECRET || '';

/**
 * HashBack Webhook Handler
 * Receives payment confirmations, verifies signatures, and activates users
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.arrayBuffer();
    const bodyText = Buffer.from(rawBody).toString('utf-8');

    // Verify signature
    const sigHeader = request.headers.get('x-hashpay-signature') || '';
    const expected = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(bodyText)
      .digest('hex');

    // Use timing-safe comparison
    const valid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sigHeader)
    );

    if (!valid) {
      console.error('[Webhook] Invalid HashBack signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = JSON.parse(bodyText);
    console.log('[Webhook] HashBack payment event:', payload.event);

    // Connect to database
    await connectToDatabase();

    // Handle different events
    if (payload.event === 'payment.success' && payload.ResponseCode === 0) {
      const {
        TransactionID,
        TransactionReference,
        TransactionAmount,
        TransactionReceipt,
        Msisdn,
      } = payload;

      console.log(`[Webhook] Processing HashBack payment: ${TransactionReference}`);

      // Parse reference to extract userId
      // Format: ACT_userId_timestamp or DEPOSIT_userId_timestamp
      const refParts = TransactionReference.split('_');
      if (refParts.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Invalid reference format' },
          { status: 400 }
        );
      }

      const paymentType = refParts[0]; // ACT, DEPOSIT, etc.
      const userId = refParts[1];

      // Find activation payment record
      const activationPayment = await ActivationPayment.findOne({
        user_id: userId,
        status: 'pending',
        provider: 'hashback',
      });

      if (!activationPayment) {
        console.error(`[Webhook] No pending HashBack payment found for user: ${userId}`);
        return NextResponse.json(
          { success: false, error: 'Payment not found' },
          { status: 404 }
        );
      }

      // Verify amount matches (in cents)
      const receivedAmountCents = Math.round(TransactionAmount * 100);
      if (receivedAmountCents !== activationPayment.amount_cents) {
        console.error(
          `[Webhook] Amount mismatch for ${userId}: received ${receivedAmountCents}, expected ${activationPayment.amount_cents}`
        );
        return NextResponse.json(
          { success: false, error: 'Amount mismatch' },
          { status: 400 }
        );
      }

      // Check if receipt already processed (idempotency)
      const existingPayment = await ActivationPayment.findOne({
        hashback_receipt: TransactionReceipt,
        status: 'completed',
      });

      if (existingPayment) {
        console.log(`[Webhook] Receipt ${TransactionReceipt} already processed`);
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // Update payment record
      activationPayment.status = 'completed';
      activationPayment.paid_at = new Date();
      activationPayment.hashback_transaction_id = TransactionID;
      activationPayment.hashback_receipt = TransactionReceipt;
      activationPayment.hashback_verified = true;
      activationPayment.provider = 'hashback';

      await activationPayment.save();
      console.log(`[Webhook] Activation payment updated for user: ${userId}`);

      // Activate user if this is account activation
      if (paymentType === 'ACT') {
        const user = await Profile.findById(userId);

        if (user) {
          // Update user activation status
          user.approval_status = 'approved';
          user.rank = 'Member'; // Set default rank
          user.activation_paid = true;
          await user.save();

          console.log(`[Webhook] User activated: ${userId}`);

          // TODO: Process referral commissions here if needed
        }
      }

      console.log(`[Webhook] HashBack payment processed successfully: ${TransactionReference}`);
      return NextResponse.json({ success: true, message: 'Payment processed' });
    }

    // Handle payment failures
    if (payload.event === 'payment.failed' || payload.ResponseCode !== 0) {
      const { TransactionReference, ResponseDescription } = payload;

      console.log(`[Webhook] HashBack payment failed: ${TransactionReference}`);

      const activationPayment = await ActivationPayment.findOne({
        hashback_checkout_id: TransactionReference,
      });

      if (activationPayment) {
        activationPayment.status = 'failed';
        activationPayment.error_message = ResponseDescription || 'Payment failed';
        await activationPayment.save();
      }

      return NextResponse.json({ success: true, message: 'Failure recorded' });
    }

    console.log('[Webhook] Unhandled event:', payload.event);
    return NextResponse.json({ success: true, message: 'Event recorded' });
  } catch (error) {
    console.error('[Webhook] Error processing HashBack webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
