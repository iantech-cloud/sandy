// app/actions/activation.ts - CO-OP BANK STK PUSH (no Daraja/M-Pesa)
'use server';

import { auth } from '@/auth'; // NextAuth v5 auth import
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/app/lib/mongoose';
import { formatPhoneNumber, isValidPhoneNumber, phoneNumbersMatch, getMpesaPhoneFormat } from '@/app/lib/utils/phoneFormatter';
import { createCoopBankService, CoopBankService } from '@/app/lib/services/coop-bank';
import { 
  Profile, 
  MpesaTransaction, 
  ActivationPayment, 
  Transaction, 
  ActivationLog,
  Referral,
  Earning,
  AdminAuditLog,
  Company
} from '@/app/lib/models';

// Import email function for payment confirmation
import { sendPaymentConfirmationInvoice } from '@/app/actions/email';

// Import company helper function
import { createCompanyRevenueTransaction } from './company';

// Import notification function
import { createReferralActivationNotification } from './notifications';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface ActivationStatusData {
  activation_paid: boolean;
  approval_status: string;
  rank: string;
  is_active: boolean;
  status: string;
  username: string;
  email: string;
}

interface ActivationPaymentData {
  messageReference: string;
  amount: number;
  phoneNumber: string;
  activationPaymentId: string;
  callbackUrl: string;
}

interface MpesaStatusData {
  status: string;
  resultCode?: string;
  resultDesc?: string;
  receiptNumber?: string | null;
  amount?: number;
  isActivationPayment?: boolean;
  completedAt?: Date;
  failedAt?: Date;
  source?: string;
  callbackUrl?: string;
  message?: string;
  fallbackReason?: string;
}

// MpesaSTKPushResult kept as alias for Co-op Bank result shape
interface CoopSTKPushResult {
  success: boolean;
  messageReference?: string;
  responseDescription?: string;
  callbackUrl?: string;
  error?: string;
}

interface ActivationCompletionData {
  username: string;
  activationDate: Date;
  rank: string;
  approval_status: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// NOTE: Use CoopBankService.mapResponseCode() from the service layer instead
// Do NOT use local mapping functions - maintain single source of truth

/**
 * Get or create company profile
 */
async function getOrCreateCompany() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let company = await (Company as any).findOne({ email: 'company@hustlehubafrica.com' });

  if (!company) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    company = await (Company as any).create({
      name: 'HustleHub Africa Ltd',
      email: 'company@hustlehubafrica.com',
      phone_number: '+254700000000',
      wallet_balance_cents: 0,
      total_revenue_cents: 0,
      total_expenses_cents: 0,
      activation_revenue_cents: 0,
      unclaimed_referral_revenue_cents: 0,
      content_payment_revenue_cents: 0,
      other_revenue_cents: 0,
      is_active: true
    });
    
    console.log('✅ Company profile created:', company._id);
  }
  
  return company;
}

/**
 * Send payment confirmation invoice after successful activation
 */
async function sendActivationConfirmationInvoice(
  userProfile: any,
  activationPayment: any,
  transactionId: string
): Promise<void> {
  try {
    console.log('📧 Sending payment confirmation invoice for activation');
    
    const invoiceData = {
      invoiceNumber: `CONF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalInvoiceNumber: `INV-${activationPayment._id}`,
      amount: activationPayment.amount_cents / 100, // Convert cents to KSH
      paymentDate: new Date().toLocaleDateString(),
      transactionId: transactionId,
      paymentMethod: 'coop_bank' as const,
      user: {
        name: userProfile.name || userProfile.username,
        email: userProfile.email
      },
      business: {
        name: 'HustleHub Africa',
        address: 'Nairobi, Kenya',
        phone: '+254 707 871154',
        email: 'support@hustlehub.africa'
      },
      activationDate: new Date().toLocaleDateString()
    };

    const result = await sendPaymentConfirmationInvoice(
      userProfile.email,
      userProfile.name || userProfile.username,
      invoiceData
    );

    if (result.success) {
      console.log('✅ Payment confirmation invoice sent successfully');
    } else {
      console.error('❌ Failed to send payment confirmation invoice:', result.error);
    }
  } catch (error) {
    console.error('❌ Error sending payment confirmation invoice:', error);
    // Don't throw error - activation should continue even if email fails
  }
}

/**
 * Get or create company profile
 */
async function syncActivationTransactionWithMpesaStatus(
    mpesaTransactionId: any, 
    status: string, 
    resultCode: number, 
    resultDesc: string,
    mpesaReceiptNumber?: string
): Promise<void> {
  try {
    const updateData: any = {
      status: status,
      metadata: {
        result_code: resultCode,
        result_desc: resultDesc,
        status_updated_at: new Date().toISOString()
      }
    };

    if (status === 'completed' && mpesaReceiptNumber) {
      updateData.metadata.mpesa_receipt_number = mpesaReceiptNumber;
      updateData.metadata.completed_at = new Date().toISOString();
    }

    if (['failed', 'cancelled', 'timeout'].includes(status)) {
      updateData.metadata.failed_at = new Date().toISOString();
    }

    await (Transaction as any).findOneAndUpdate(
      { mpesa_transaction_id: mpesaTransactionId },
      updateData
    );

    console.log(`🔄 Successfully synced activation Transaction status to: ${status}`);
  } catch (error) {
    console.error('❌ Failed to sync activation Transaction status:', error);
    throw error;
  }
}

/**
 * Check activation payment status via Co-op Bank Enquiry API.
 * messageReference == checkout_request_id stored on the MpesaTransaction.
 */
export async function checkActivationPaymentStatus(messageReference: string): Promise<ApiResponse<MpesaStatusData>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, message: 'User not authenticated' };
    }

    await connectToDatabase();

    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: messageReference,
    });

    if (!mpesaTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // Already in a terminal state — return DB result immediately
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(mpesaTransaction.status)) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          receiptNumber: mpesaTransaction.mpesa_receipt_number,
          isActivationPayment: true,
          completedAt: mpesaTransaction.completed_at,
          failedAt: mpesaTransaction.failed_at,
          source: mpesaTransaction.metadata?.callback_processed ? 'coop_callback' : 'database',
        },
        message: `Payment status: ${mpesaTransaction.status}`,
      };
    }

    // Callback already flagged it — return
    if (mpesaTransaction.metadata?.callback_processed) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          source: 'callback_processed',
          isActivationPayment: true,
        },
        message: `Payment ${mpesaTransaction.status}`,
      };
    }

    // Query Co-op Bank Enquiry API
    try {
      const coopBank = createCoopBankService();
      const statusResponse = await coopBank.getTransactionStatus(messageReference);
      
      // Use centralized mapping from CoopBankService (single source of truth)
      const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

      console.log('[Activation] Status check:', {
        messageReference,
        responseCode: statusResponse.ResponseCode,
        mappedStatus,
        description: statusResponse.ResponseDescription,
      });

      // Persist status update
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: mappedStatus,
        result_code: parseInt(statusResponse.ResponseCode || '1', 10),
        result_desc: statusResponse.ResponseDescription || '',
        ...(mappedStatus === 'completed' ? { completed_at: new Date() } : {}),
        ...((['failed', 'cancelled', 'timeout'].includes(mappedStatus)) ? { failed_at: new Date() } : {}),
      });

      // If completed via poll (callback missed), run activation logic
      if (mappedStatus === 'completed') {
        console.log('[Activation] Activation triggered from status poll');
        const activationPayment = await (ActivationPayment as any).findOne({
          checkout_request_id: messageReference,
        });
        if (activationPayment && activationPayment.status !== 'completed') {
          activationPayment.status = 'completed';
          activationPayment.paid_at = new Date();
          await activationPayment.save();
          await completeActivationAfterPayment(activationPayment._id.toString());
        }
      }

      return {
        success: true,
        data: {
          status: mappedStatus,
          resultCode: statusResponse.ResponseCode,
          resultDesc: statusResponse.ResponseDescription || '',
          isActivationPayment: true,
          source: 'coop_api',
        },
        message: `Payment status: ${mappedStatus}`,
      };
    } catch (apiError) {
      console.error('[Activation] Co-op Bank API error, returning DB status:', apiError);
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultDesc: 'Checking payment status...',
          source: 'database_fallback',
          isActivationPayment: true,
        },
        message: 'Using last known status. Please wait for payment confirmation.',
      };
    }
  } catch (error) {
    console.error('[Activation] checkActivationPaymentStatus error:', error);
    return {
      success: false,
      message: 'Failed to check activation payment status. Please try again.',
      data: { status: 'error', resultDesc: 'Unable to verify payment status' },
    };
  }
}

// =============================================================================
// EXPORTED ACTIONS
// =============================================================================

/**
 * ✅ FIXED: Check user activation status using correct schema fields
 */
export async function checkActivationStatus(): Promise<ApiResponse<ActivationStatusData>> {
  try {
    await connectToDatabase();
    
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, message: 'User not authenticated' };
    }

    const userProfile = await (Profile as any).findOne({ email: session.user.email });
    if (!userProfile) {
      return { success: false, message: 'User profile not found' };
    }

    // ✅ FIXED: Check activation based on approval_status and rank
    const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';

    return {
      success: true,
      data: {
        activation_paid: isActivationPaid,
        approval_status: userProfile.approval_status || 'pending',
        rank: userProfile.rank || 'Unactivated',
        is_active: userProfile.is_active || false,
        status: userProfile.status || 'inactive',
        username: userProfile.username,
        email: userProfile.email
      }
    };
  } catch (error) {
    console.error('Error checking activation status:', error);
    return { success: false, message: 'Failed to check activation status' };
  }
}

/**
 * Co-op Bank does not use C2B URL registration (that was Safaricom-only).
 * This function is kept as a no-op so callers such as verifyUrlRegistration
 * continue to compile and return a stable response.
 */
export async function registerMpesaUrls(): Promise<ApiResponse<UrlRegistrationData>> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
  return {
    success: true,
    message: 'Co-op Bank STK Push does not require C2B URL registration',
    data: {
      confirmationUrl: `${baseUrl}/api/coop/callback`,
      validationUrl: `${baseUrl}/api/coop/callback`,
      callbackUrl: `${baseUrl}/api/coop/callback`,
    },
  };
}

/**
 * Initiate activation payment via Co-op Bank STK Push.
 * Returns messageReference which the client polls with checkActivationPaymentStatus.
 */
export async function initiateActivationPayment(phoneNumber: string): Promise<ApiResponse<ActivationPaymentData>> {
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
    const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';
    if (isActivationPaid) {
      return { success: false, message: 'Account is already activated' };
    }

    // Validate and format phone number
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

    // Standard activation fee: KES 90
    const activationAmount = 9000; // cents

    const activationPayment = new (ActivationPayment as any)({
      user_id: userProfile._id,
      amount_cents: activationAmount,
      provider: 'coop_bank',
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: {
        activation_type: 'account_activation',
        initiated_at: new Date().toISOString(),
      },
    });
    await activationPayment.save();

    const activationLog = new (ActivationLog as any)({
      user_id: userProfile._id,
      action: 'initiated',
      amount_cents: activationAmount,
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: { activation_payment_id: activationPayment._id },
    });
    await activationLog.save();

    // Unique message reference (idempotency key)
    const messageReference = `ACT${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    // Create MpesaTransaction BEFORE calling the API so the callback always finds it
    const mpesaTransaction = new (MpesaTransaction as any)({
      user_id: userProfile._id,
      amount_cents: activationAmount,
      phone_number: mpesaPhone,
      account_reference: `ACTIVATION-${userProfile._id}`,
      transaction_desc: `Account activation fee for ${userProfile.username}`,
      checkout_request_id: messageReference,
      status: 'initiated',
      is_activation_payment: true,
      source: 'activation',
      metadata: {
        activation_payment_id: activationPayment._id,
        callback_url: callbackUrl,
        user_username: userProfile.username,
        deposit_type: 'activation',
        payment_method: 'coop_bank_stk_push',
        initiated_at: new Date().toISOString(),
      },
    });
    await mpesaTransaction.save();

    // Link the payment record to the transaction
    activationPayment.checkout_request_id = messageReference;
    activationPayment.mpesa_transaction_id = mpesaTransaction._id;
    await activationPayment.save();

    // Ledger record
    await (Transaction as any).create({
      user_id: userProfile._id,
      amount_cents: activationAmount,
      type: 'ACCOUNT_ACTIVATION',
      description: `Account activation fee via Co-op Bank from ${mpesaPhone}`,
      status: 'pending',
      mpesa_transaction_id: mpesaTransaction._id,
      target_type: 'user',
      target_id: userProfile._id.toString(),
      metadata: {
        phoneNumber: mpesaPhone,
        provider: 'coop_bank',
        messageReference,
        initiated_at: new Date().toISOString(),
      },
    });

    // Initiate Co-op Bank STK Push
    const coopBank = createCoopBankService();
    const stkResponse = await coopBank.initiateSTKPush(
      mpesaPhone,
      activationAmount / 100, // KES
      `Activation fee - ${userProfile.username}`,
      callbackUrl,
      messageReference
    );

    if (stkResponse.ResponseCode !== '0') {
      // Mark records as failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: stkResponse.ResponseDescription || 'STK Push rejected by bank',
      });
      activationPayment.status = 'failed';
      activationPayment.error_message = stkResponse.ResponseDescription || 'STK Push rejected';
      await activationPayment.save();
      activationLog.status = 'failed';
      activationLog.error_message = stkResponse.ResponseDescription;
      await activationLog.save();

      return {
        success: false,
        message: stkResponse.ResponseDescription || 'Failed to initiate payment. Please try again.',
      };
    }

    activationLog.metadata = {
      ...activationLog.metadata,
      message_reference: messageReference,
      mpesa_transaction_id: mpesaTransaction._id,
    };
    await activationLog.save();

    return {
      success: true,
      data: {
        messageReference,
        amount: activationAmount,
        phoneNumber: mpesaPhone,
        activationPaymentId: activationPayment._id.toString(),
        callbackUrl,
      },
    };
  } catch (error) {
    console.error('[Activation] initiateActivationPayment error:', error);
    return { success: false, message: 'An error occurred during payment processing' };
  }
}

/**
 * Complete activation after successful payment.
 * NOTE: Called from the Co-op Bank callback route — no session required.
 */
export async function completeActivationAfterPayment(activationPaymentId: string): Promise<ApiResponse<ActivationCompletionData>> {
  try {
    await connectToDatabase();

    // Get activation payment first - this will tell us which user to activate
    const activationPayment = await (ActivationPayment as any).findById(activationPaymentId);
    
    if (!activationPayment) {
      console.error(`[v0] Activation payment not found: ${activationPaymentId}`);
      return { success: false, message: 'Activation payment not found' };
    }

    console.log(`[v0] Processing activation for payment:`, {
      activationPaymentId,
      userId: activationPayment.user_id,
      status: activationPayment.status,
      amount: activationPayment.amount_cents / 100
    });

    // Get user profile using the user_id from the activation payment (not from session)
    const userProfile = await (Profile as any).findById(activationPayment.user_id);

    if (!userProfile) {
      console.error(`[v0] User profile not found for ID: ${activationPayment.user_id}`);
      return { success: false, message: 'User profile not found' };
    }

    // ✅ FIXED: Check if already activated using correct fields
    const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';
    if (isActivationPaid) {
      return { 
        success: true, 
        message: 'Account already activated',
        data: {
          username: userProfile.username,
          activationDate: new Date(),
          rank: userProfile.rank,
          approval_status: userProfile.approval_status
        }
      };
    }

    if (activationPayment.status !== 'completed') {
      return { success: false, message: 'Payment not completed yet' };
    }

    const company = await getOrCreateCompany();

    // =============================================================================
    // STEP 1: Record User's Activation Fee Payment
    // =============================================================================
    const activationFeeTransaction = new (Transaction as any)({
      target_type: 'user',
      target_id: userProfile._id.toString(),
      user_id: userProfile._id,
      amount_cents: activationPayment.amount_cents,
      type: 'ACTIVATION_FEE',
      description: 'Account activation fee payment',
      status: 'completed',
      source: 'activation',
      is_activation_fee: true,
      activation_payment_id: activationPayment._id,
      balance_before_cents: userProfile.balance_cents,
      balance_after_cents: userProfile.balance_cents,
      metadata: {
        payment_method: 'coop_bank_stk_push',
        receipt: activationPayment.mpesa_receipt_number,
        phone_number: activationPayment.phone_number
      }
    });
    await activationFeeTransaction.save();

    // =============================================================================
    // STEP 2: Process Referral Bonus - KES 70 per Direct Referral
    // =============================================================================
    let referralBonus = null;

    if (userProfile.referred_by) {
      console.log(`[v0] User has referrer:`, {
        userId: userProfile._id,
        username: userProfile.username,
        referred_by: userProfile.referred_by,
        type: typeof userProfile.referred_by
      });

      try {
        const referrer = await (Profile as any).findById(userProfile.referred_by);
        
        console.log(`[v0] Referrer lookup:`, {
          referrer_id: userProfile.referred_by,
          found: !!referrer,
          referrer_username: referrer?.username
        });
        
        if (referrer) {
          const referralRecord = await (Referral as any).findOne({
            referrer_id: referrer._id,
            referred_id: userProfile._id
          });

          console.log(`[v0] Referral record lookup:`, {
            referrer_id: referrer._id,
            referred_id: userProfile._id,
            found: !!referralRecord,
            already_paid: referralRecord?.referral_bonus_paid
          });

          if (referralRecord && !referralRecord.referral_bonus_paid) {
            // ✅ FIXED: Referral bonus is KES 70 = 7,000 cents (NOT 70,000)
            const REFERRAL_BONUS_CENTS = 7000; // KES 70
            const referralLevel = 1; // Direct referral (Level 1)

            console.log(`[v0] Processing referral bonus:`, {
              referrer: referrer.username,
              newUser: userProfile.username,
              bonusAmount: REFERRAL_BONUS_CENTS / 100,
              bonusType: 'Direct Referral'
            });

            // Create transaction for direct referral bonus
            const referralTransaction = new (Transaction as any)({
              target_type: 'user',
              target_id: referrer._id.toString(),
              user_id: referrer._id,
              amount_cents: REFERRAL_BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${userProfile.username}'s activation (KES 70)`,
              status: 'completed',
              source: 'activation',
              balance_before_cents: referrer.balance_cents,
              balance_after_cents: referrer.balance_cents + REFERRAL_BONUS_CENTS,
              metadata: {
                referred_user_id: userProfile._id.toString(),
                referred_username: userProfile.username,
                activation_payment_id: activationPayment._id.toString(),
                referral_id: referralRecord._id.toString(),
                level: referralLevel,
                bonus_amount: REFERRAL_BONUS_CENTS
              }
            });
            await referralTransaction.save();

            // Update referrer balance and earnings
            referrer.balance_cents += REFERRAL_BONUS_CENTS;
            referrer.total_earnings_cents += REFERRAL_BONUS_CENTS;
            await referrer.save();

            console.log(`[v0] Referrer balance updated:`, {
              referrer: referrer.username,
              newBalance: referrer.balance_cents / 100,
              earned: REFERRAL_BONUS_CENTS / 100
            });

            // Update referral record
            referralRecord.referral_bonus_paid = true;
            referralRecord.referral_bonus_amount_cents = REFERRAL_BONUS_CENTS;
            referralRecord.bonus_paid_at = new Date();
            referralRecord.status = 'bonus_paid';
            referralRecord.referred_user_activated = true;
            referralRecord.referred_user_activated_at = new Date();
            referralRecord.metadata = {
              level: referralLevel,
              bonus_amount: REFERRAL_BONUS_CENTS,
              activated_at: new Date().toISOString()
            };
            await referralRecord.save();

            // Create earning record
            const earning = new (Earning as any)({
              user_id: referrer._id,
              amount_cents: REFERRAL_BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${userProfile.username}'s activation`,
              source_id: referralRecord._id,
              source_type: 'referral',
              transaction_id: referralTransaction._id,
              processed: true,
              processed_at: new Date(),
              metadata: {
                level: referralLevel,
                referred_user_id: userProfile._id.toString(),
                bonus_amount: REFERRAL_BONUS_CENTS
              }
            });
            await earning.save();

            referralBonus = {
              referrer_id: referrer._id,
              referrer_username: referrer.username,
              amount_cents: REFERRAL_BONUS_CENTS,
              transaction_id: referralTransaction._id,
              level: referralLevel
            };

            console.log(`✅ BONUS PAID: ${referrer.username} earned KES 70`, {
              referrer: referrer.username,
              referrerId: referrer._id,
              newUser: userProfile.username,
              bonusAmount: REFERRAL_BONUS_CENTS / 100,
              transactionId: referralTransaction._id,
              newBalance: referrer.balance_cents / 100
            });

          } else if (referralRecord && referralRecord.referral_bonus_paid) {
            console.log(`[v0] Referral bonus already paid for ${userProfile.username}`);
          } else {
            console.log(`[v0] No referral record found for this user pair`);
          }
        } else {
          console.log(`[v0] Referrer not found by ID: ${userProfile.referred_by}`);
        }
      } catch (referralError) {
        console.error('⚠️ Error processing referral bonus:', referralError);
      }
    } else {
      console.log(`[v0] User has no referrer - no bonus to award`);
    }

    // =============================================================================
    // STEP 3: Record Company Revenue - KES 20 (2,000 cents) per activation
    // =============================================================================
    // Breakdown of KES 90 activation fee:
    // - If has referrer: Referrer gets KES 70, Company gets KES 20
    // - If no referrer: Company gets KES 90 (unclaimed referral bonus)
    
    let companyRevenueCents;
    let unclaimedReferralCents = 0;

    if (userProfile.referred_by && referralBonus) {
      // ✅ FIXED: With referrer, company gets KES 20 = 2,000 cents
      companyRevenueCents = 2000; // KES 20
      unclaimedReferralCents = 0;
    } else {
      // No referrer OR bonus wasn't paid - company gets full amount
      // Split into actual company fee + unclaimed referral bonus
      companyRevenueCents = 2000; // Company fee (KES 20)
      unclaimedReferralCents = 7000; // Unclaimed referral bonus (KES 70)
    }

    console.log(`[v0] Company revenue calculation:`, {
      totalFee: activationPayment.amount_cents / 100,
      hasReferrer: !!userProfile.referred_by,
      bonusWasPaid: !!referralBonus,
      companyRevenue: companyRevenueCents / 100,
      unclaimedReferral: unclaimedReferralCents / 100
    });

    const companyRevenueResult = await createCompanyRevenueTransaction(
      companyRevenueCents,
      'COMPANY_REVENUE',
      `Company fee from ${userProfile.username}'s activation (KES 20)`,
      {
        total_activation_fee: activationPayment.amount_cents,
        referral_bonus_paid: referralBonus ? referralBonus.amount_cents : 0,
        company_revenue: companyRevenueCents,
        unclaimed_referral: unclaimedReferralCents,
        net_company_revenue: companyRevenueCents,
        has_referrer: !!userProfile.referred_by,
        activation_payment_id: activationPayment._id.toString(),
        user_id: userProfile._id.toString()
      },
      userProfile._id.toString()
    );

    if (!companyRevenueResult.success) {
      console.error('❌ Failed to create company revenue transaction');
      return { success: false, message: 'Failed to record company revenue' };
    }

    // =============================================================================
    // STEP 4: Record Unclaimed Referral Revenue (if no referrer)
    // =============================================================================
    if (unclaimedReferralCents > 0) {
      // If no referrer or bonus wasn't paid, record unclaimed referral bonus
      const unclaimedResult = await createCompanyRevenueTransaction(
        unclaimedReferralCents, // KES 70 unclaimed referral bonus
        'UNCLAIMED_REFERRAL',
        `Unclaimed referral bonus from ${userProfile.username}'s activation (KES 70)`,
        {
          activation_payment_id: activationPayment._id.toString(),
          user_id: userProfile._id.toString(),
          reason: userProfile.referred_by ? 'bonus_failed' : 'no_referrer'
        },
        userProfile._id.toString()
      );

      if (unclaimedResult.success) {
        console.log(`[v0] Unclaimed referral bonus recorded: KES ${unclaimedReferralCents / 100}`);
      }
    }

    // =============================================================================
    // STEP 5: ✅ FIXED - Activate User Account with Correct Fields
    // =============================================================================
    userProfile.is_active = true;
    userProfile.status = 'active';
    userProfile.is_verified = true;
    userProfile.approval_status = 'approved'; // ✅ FIXED: Set approval_status to 'approved'
    userProfile.is_approved = true;
    userProfile.level = 1;
    userProfile.rank = 'Bronze'; // ✅ FIXED: Change rank from 'Unactivated' to 'Bronze'
    userProfile.activation_transaction_id = activationFeeTransaction._id;
    await userProfile.save();

    // =============================================================================
    // STEP 5.5: Send Referral Activation Notification to Referrer
    // =============================================================================
    if (userProfile.referred_by) {
      try {
        const notificationResult = await createReferralActivationNotification(
          userProfile.referred_by.toString(),
          userProfile._id.toString()
        );
        
        if (notificationResult.success) {
          console.log(`[v0] Referral activation notification sent to ${userProfile.referred_by}`);
        } else {
          console.warn(`[v0] Failed to send referral notification: ${notificationResult.message}`);
        }
      } catch (notificationError) {
        console.error('[v0] Error sending referral notification:', notificationError);
        // Don't fail activation if notification fails
      }
    }

    // =============================================================================
    // STEP 6: Update Activation Payment Record
    // =============================================================================
    // STEP 6: Update Activation Payment Record
    // =============================================================================
    activationPayment.processed_by_system = true;
    activationPayment.processed_at = new Date();
    activationPayment.metadata = {
      ...activationPayment.metadata,
      activation_transaction_id: activationFeeTransaction._id,
      company_revenue_transaction_id: companyRevenueResult.data?.transaction_id,
      referral_bonus_paid: !!referralBonus
    };
    await activationPayment.save();

    // =============================================================================
    // STEP 7: Send Payment Confirmation Invoice
    // =============================================================================
    await sendActivationConfirmationInvoice(
      userProfile,
      activationPayment,
      activationPayment.mpesa_receipt_number || activationPayment._id.toString()
    );

    // =============================================================================
    // STEP 8: Log Successful Activation
    // =============================================================================
    const activationLog = new (ActivationLog as any)({
      user_id: userProfile._id,
      action: 'activated',
      amount_cents: activationPayment.amount_cents,
      phone_number: activationPayment.phone_number,
      status: 'success',
      metadata: {
        activation_payment_id: activationPayment._id,
        rank: 'Bronze',
        approval_status: 'approved',
        confirmation_invoice_sent: true
      }
    });
    await activationLog.save();

    // =============================================================================
    // STEP 9: Create Admin Audit Log
    // =============================================================================
    const auditLog = new (AdminAuditLog as any)({
      actor_id: userProfile._id,
      action: 'ACTIVATE_USER',
      target_type: 'user',
      target_id: userProfile._id,
      resource_type: 'user',
      resource_id: userProfile._id,
      action_type: 'activate',
      changes: {
        approval_status: 'approved',
        rank: 'Bronze',
        is_active: true,
        status: 'active'
      },
      metadata: {
        activation_payment_id: activationPayment._id,
        has_referrer: !!userProfile.referred_by,
        confirmation_invoice_sent: true
      }
    });
    await auditLog.save();

    revalidatePath('/dashboard');
    revalidatePath('/admin/users');
    revalidatePath('/admin/transactions');

    console.log('🎉 Activation completed successfully');

    return { 
      success: true, 
      message: 'Account activated successfully',
      data: {
        username: userProfile.username,
        activationDate: new Date(),
        rank: 'Bronze',
        approval_status: 'approved'
      }
    };

  } catch (error) {
    console.error('💥 Complete activation error:', error);
    return { success: false, message: 'Failed to complete activation' };
  }
}

/**
 * Verify URL registration status
 */
export async function verifyUrlRegistration(): Promise<ApiResponse<UrlRegistrationData>> {
  try {
    const result = await registerMpesaUrls();
    
    if (result.success && result.data) {
      return {
        success: true,
        message: 'URL registration verified successfully',
        data: result.data
      };
    } else {
      return {
        success: false,
        message: 'URL registration verification failed',
        error: result.error
      };
    }
  } catch (error) {
    console.error('❌ URL registration verification error:', error);
    return {
      success: false,
      message: 'Failed to verify URL registration',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
