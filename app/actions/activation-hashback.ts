'use server';

import { auth } from '@/auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import { Profile, ActivationPayment, ActivationLog } from '@/app/lib/models';
import { isValidPhoneNumber, formatPhoneNumber, getMpesaPhoneFormat, phoneNumbersMatch } from '@/app/lib/utils/phoneFormatter';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Create HashBack activation payment record
 * Called from client before opening HashBack payment popup
 */
export async function initiateHashBackActivation(
  phoneNumber: string,
  customAmountCents?: number
): Promise<ApiResponse<{ paymentId: string; reference: string; amount: number }>> {
  try {
    await connectToDatabase();

    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'User not authenticated' };
    }

    const sessionId = (session.user as any).id || (session.user as any).userId;
    const userProfile = sessionId
      ? await (Profile as any).findById(sessionId)
      : await (Profile as any).findOne({ email: session.user.email });

    if (!userProfile) {
      return { success: false, message: 'User profile not found' };
    }

    // Check if already activated
    const isActivationPaid = userProfile.approval_status === 'approved' && userProfile.rank !== 'Unactivated';
    if (isActivationPaid) {
      console.log('[v0] User already activated, refusing HashBack activation:', {
        username: userProfile.username,
        approval_status: userProfile.approval_status,
        rank: userProfile.rank
      });
      return { success: false, message: 'Account is already activated' };
    }

    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return { success: false, message: 'Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX' };
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const mpesaPhone = getMpesaPhoneFormat(formattedPhone);

    // Phone must match user's registered number
    if (!phoneNumbersMatch(mpesaPhone, userProfile.phone_number)) {
      return {
        success: false,
        message: 'Phone number does not match your registered phone number. Activation payments must be made from your registered phone number.',
      };
    }

    // Use dynamic amount if provided, otherwise default to KES 95 (9500 cents)
    const activationAmount = customAmountCents ?? 9500; // cents

    // Create payment record
    const activationPayment = new (ActivationPayment as any)({
      user_id: userProfile._id,
      amount_cents: activationAmount,
      provider: 'hashback',
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: {
        activation_type: 'account_activation',
        payment_method: 'hashback',
        initiated_at: new Date().toISOString(),
      },
    });
    await activationPayment.save();

    // Create audit log
    const activationLog = new (ActivationLog as any)({
      user_id: userProfile._id,
      action: 'initiated_hashback',
      amount_cents: activationAmount,
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: { activation_payment_id: activationPayment._id, payment_method: 'hashback' },
    });
    await activationLog.save();

    // Create reference for HashBack tracking
    const timestamp = Date.now();
    const reference = `ACT_${userProfile._id}_${timestamp}`;

    // Update payment record with reference
    activationPayment.provider_reference = reference;
    await activationPayment.save();

    console.log('[v0] HashBack activation initiated:', {
      userId: userProfile._id,
      amount: activationAmount,
      reference,
    });

    return {
      success: true,
      data: {
        paymentId: activationPayment._id.toString(),
        reference,
        amount: activationAmount / 100, // Convert cents to KES for display
      },
    };
  } catch (error) {
    console.error('[v0] Error initiating HashBack activation:', error);
    return {
      success: false,
      message: 'Failed to initiate HashBack activation',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if HashBack activation is enabled
 */
export async function isHashBackActivationEnabled(): Promise<{ enabled: boolean }> {
  const isEnabled = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID;
  return { enabled: !!isEnabled };
}
