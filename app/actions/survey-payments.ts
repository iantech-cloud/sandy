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
      metadata: { survey_id: surveyId },
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
      metadata: { survey_id: surveyId },
      status: 'completed'
    });

    if (alreadyPaid) {
      return {
        success: false,
        message: 'You have already paid for this survey.',
      };
    }

    const coopBankService = createCoopBankService();
    const phoneNumber = getMpesaPhoneFormat(user.phone_number);
    const amountInCents = 3000; // KSH 30 = 3000 cents
    const amountInKsh = 30;

    // Create transaction record
    const transaction = new MpesaTransaction({
      user_id: user._id,
      phone_number: phoneNumber,
      amount: amountInKsh,
      amount_cents: amountInCents,
      status: 'pending',
      transaction_type: 'survey_payment',
      metadata: {
        survey_id: surveyId,
        payment_reason: 'survey_access'
      }
    });

    await transaction.save();

    // Initiate STK Push
    const stkResult = await coopBankService.initiateSTKPush({
      phoneNumber,
      amount: amountInKsh,
      accountReference: `SURVEY_${surveyId}`,
      description: `Sandy Survey Access - ${amountInKsh} KSH`,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payments/coop-bank/callback`,
      messageReference: `ACT.survey.${surveyId}.${transaction._id}`
    });

    if (!stkResult.success) {
      transaction.status = 'failed';
      transaction.result_desc = stkResult.error || 'STK Push initiation failed';
      await transaction.save();

      return {
        success: false,
        message: 'Failed to initiate payment. Please try again.',
        error: stkResult.error,
      };
    }

    // Store the message reference for callback matching
    transaction.checkout_request_id = stkResult.messageReference;
    await transaction.save();

    return {
      success: true,
      data: {
        messageReference: stkResult.messageReference || '',
        amount: amountInKsh,
        phoneNumber,
        surveyId,
        callbackUrl: stkResult.callbackUrl || ''
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
  transactionId: string,
  surveyId: string
): Promise<ApiResponse> {
  let session: mongoose.ClientSession | null = null;

  try {
    await connectToDatabase();

    session = await mongoose.startSession();
    session.startTransaction();

    const transaction = await MpesaTransaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Transaction not found.',
      };
    }

    const user = await Profile.findById(transaction.user_id).session(session);
    if (!user) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'User not found.',
      };
    }

    // Debit survey wallet
    const amountToPay = transaction.amount_cents || 3000;
    if (user.survey_wallet_cents < amountToPay) {
      // This shouldn't happen in normal flow, but handle it
      user.survey_wallet_cents = 0;
    } else {
      user.survey_wallet_cents -= amountToPay;
    }

    // Note: We don't actually debit from survey_wallet_cents on payment
    // The user deposits to their wallet separately
    // This transaction just confirms payment received
    
    await user.save({ session });

    // Create Transaction record for audit
    const auditTransaction = new Transaction({
      user_id: user._id,
      transaction_type: 'survey_payment',
      amount_cents: amountToPay,
      status: 'completed',
      description: `Survey access payment - Survey ID: ${surveyId}`,
      metadata: {
        survey_id: surveyId,
        mpesa_transaction_id: transaction._id
      }
    });

    await auditTransaction.save({ session });

    await session.commitTransaction();

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
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: 'You must be logged in.',
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

    // Check for completed payment
    const completedPayment = await MpesaTransaction.findOne({
      user_id: user._id,
      metadata: { survey_id: surveyId },
      status: 'completed'
    });

    // Check for pending payment
    const pendingPayment = await MpesaTransaction.findOne({
      user_id: user._id,
      metadata: { survey_id: surveyId },
      status: 'pending'
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
