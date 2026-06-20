'use server';

import { auth } from '@/auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import { createCoopBankService } from '@/app/lib/services/coop-bank';
import { 
  Profile, 
  MpesaTransaction, 
  Transaction
} from '@/app/lib/models';
import { formatPhoneNumber, getMpesaPhoneFormat } from '@/app/lib/utils/phoneFormatter';
import mongoose from 'mongoose';

interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface SurveyPaymentData {
  messageReference: string;
  amount: number;
  phoneNumber: string;
  surveyId: string;
  callbackUrl: string;
}

/**
 * Initiate payment for survey access (KSH 30 via Coop Bank)
 * Follows same pattern as activation.ts for consistency
 */
export async function initiateSurveyPayment(
  surveyId: string
): Promise<ApiResponse<SurveyPaymentData>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: 'You must be logged in to pay for surveys.',
      };
    }

    await connectToDatabase();

    const user = await Profile.findOne({ email: session.user.email });
    if (!user) {
      return {
        success: false,
        message: 'User profile not found.',
      };
    }

    if (!user.phone_number) {
      return {
        success: false,
        message: 'Phone number required. Please update your profile.',
      };
    }

    // Check if user already has a pending payment for this survey
    const existingPending = await MpesaTransaction.findOne({
      user_id: user._id,
      'metadata.survey_id': surveyId,
      status: 'pending'
    });

    if (existingPending) {
      return {
        success: false,
        message: 'You already have a pending payment for this survey.',
      };
    }

    // Check if user already paid for this survey
    const alreadyPaid = await MpesaTransaction.findOne({
      user_id: user._id,
      'metadata.survey_id': surveyId,
      status: 'completed'
    });

    if (alreadyPaid) {
      return {
        success: false,
        message: 'You have already paid for this survey.',
      };
    }

    const formattedPhone = formatPhoneNumber(user.phone_number);
    const phoneNumber = getMpesaPhoneFormat(formattedPhone);
    const amountInCents = 3000; // KSH 30 = 3000 cents
    const amountInKsh = 30;
    const messageReference = `SURVEY${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/payments/coop-bank/callback`;

    // Create MpesaTransaction BEFORE calling API (idempotency)
    const mpesaTransaction = new MpesaTransaction({
      user_id: user._id,
      amount_cents: amountInCents,
      phone_number: phoneNumber,
      account_reference: `SURVEY-${surveyId.substring(0, 8)}`,
      transaction_desc: `Survey access payment - Survey ID: ${surveyId}`,
      checkout_request_id: messageReference,
      status: 'initiated',
      source: 'survey_payment',
      metadata: {
        survey_id: surveyId,
        payment_reason: 'survey_access',
        user_username: user.username,
        initiated_at: new Date().toISOString(),
      },
    });

    await mpesaTransaction.save();

    // Audit transaction record
    await Transaction.create({
      user_id: user._id,
      amount_cents: amountInCents,
      type: 'SURVEY_PAYMENT',
      description: `Survey payment for survey: ${surveyId}`,
      status: 'pending',
      mpesa_transaction_id: mpesaTransaction._id,
      target_type: 'survey',
      target_id: surveyId,
      metadata: {
        phoneNumber,
        provider: 'coop_bank',
        messageReference,
        initiated_at: new Date().toISOString(),
      },
    });

    // Initiate STK Push with correct signature
    const coopBank = createCoopBankService();
    let stkResponse;
    
    try {
      console.log('[SurveyPayment] Calling initiateSTKPush...');
      stkResponse = await coopBank.initiateSTKPush(
        phoneNumber,
        amountInKsh,
        `Sandy Survey Access - KES ${amountInKsh}`,
        callbackUrl,
        messageReference
      );
      console.log('[SurveyPayment] STK Push response:', stkResponse);
    } catch (stkError) {
      console.error('[SurveyPayment] STK Push initiation failed:', stkError);
      // Mark transaction as failed
      await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: stkError instanceof Error ? stkError.message : 'STK Push request failed',
        failed_at: new Date(),
      });

      return {
        success: false,
        message: stkError instanceof Error ? stkError.message : 'Failed to initiate payment. Please check your connection and try again.',
      };
    }

    // Check response validity
    if (!stkResponse || stkResponse.ResponseCode !== '0') {
      console.error('[SurveyPayment] STK Push rejected:', stkResponse?.ResponseDescription);
      await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: stkResponse?.ResponseDescription || 'STK Push rejected by bank',
        failed_at: new Date(),
      });

      return {
        success: false,
        message: stkResponse?.ResponseDescription || 'Failed to initiate payment. Please try again.',
      };
    }

    // Update transaction with successful STK initiation
    mpesaTransaction.status = 'pending';
    await mpesaTransaction.save();

    return {
      success: true,
      data: {
        messageReference,
        amount: amountInKsh,
        phoneNumber,
        surveyId,
        callbackUrl,
      },
      message: `Survey payment initiated. You will receive an M-Pesa prompt on ${phoneNumber}`,
    };
  } catch (error: any) {
    console.error('[SurveyPayment] Error:', error);
    return {
      success: false,
      message: 'Failed to initiate survey payment.',
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Complete survey payment after callback
 * Called from payment callback route when payment succeeds
 */
export async function completeSurveyPayment(
  messageReference: string,
  surveyId: string
): Promise<ApiResponse> {
  let session: mongoose.ClientSession | null = null;

  try {
    await connectToDatabase();

    session = await mongoose.startSession();
    session.startTransaction();

    // Find transaction by messageReference (idempotency key)
    const mpesaTransaction = await MpesaTransaction.findOne({
      checkout_request_id: messageReference
    }).session(session);

    if (!mpesaTransaction) {
      console.warn('[SurveyPayment] Transaction not found for messageReference:', messageReference);
      await session.abortTransaction();
      return {
        success: false,
        message: 'Transaction not found.',
      };
    }

    const user = await Profile.findById(mpesaTransaction.user_id).session(session);
    if (!user) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'User not found.',
      };
    }

    // Update transaction status to completed
    mpesaTransaction.status = 'completed';
    mpesaTransaction.completed_at = new Date();
    await mpesaTransaction.save({ session });

    // Update audit transaction status
    await Transaction.findOneAndUpdate(
      { mpesa_transaction_id: mpesaTransaction._id },
      { status: 'completed', completed_at: new Date() },
      { session }
    );

    await session.commitTransaction();

    console.log('[SurveyPayment] Payment completed successfully for survey:', surveyId);

    return {
      success: true,
      message: 'Survey payment completed successfully.',
    };
  } catch (error: any) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('[SurveyPaymentCompletion] Error:', error);
    return {
      success: false,
      message: 'Failed to complete survey payment.',
      error: error.message,
    };
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * Get survey payment status for a user
 */
export async function getSurveyPaymentStatus(surveyId: string): Promise<ApiResponse<{ 
  paid: boolean; 
  pendingPayment: boolean;
}>> {
  try {
    const authSession = await auth();
    if (!authSession?.user?.email) {
      return {
        success: false,
        message: 'You must be logged in.',
      };
    }

    await connectToDatabase();

    const user = await Profile.findOne({ email: authSession.user.email });
    if (!user) {
      return {
        success: false,
        message: 'User profile not found.',
      };
    }

    // Check for completed payment using correct nested field query
    const completedPayment = await MpesaTransaction.findOne({
      user_id: user._id,
      'metadata.survey_id': surveyId,
      status: 'completed'
    });

    // Check for pending payment
    const pendingPayment = await MpesaTransaction.findOne({
      user_id: user._id,
      'metadata.survey_id': surveyId,
      status: { $in: ['pending', 'initiated'] }
    });

    return {
      success: true,
      data: {
        paid: !!completedPayment,
        pendingPayment: !!pendingPayment
      }
    };
  } catch (error: any) {
    console.error('[SurveyPaymentStatus] Error:', error);
    return {
      success: false,
      message: 'Failed to get payment status.',
      error: error.message,
    };
  }
}
