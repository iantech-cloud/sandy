// app/actions/activation.ts - UPDATED FOR NEXTAUTH V5 AND CORRECT SCHEMA
'use server';

import { auth } from '@/auth'; // NextAuth v5 auth import
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/app/lib/mongoose';
import { formatPhoneNumber, isValidPhoneNumber, phoneNumbersMatch, getMpesaPhoneFormat } from '@/app/lib/utils/phoneFormatter';
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

interface UrlRegistrationData {
  confirmationUrl: string;
  validationUrl: string;
  callbackUrl: string;
}

interface ActivationPaymentData {
  checkoutRequestId: string;
  amount: number;
  phoneNumber: string;
  activationPaymentId: string;
  callbackUrl: string;
  merchantRequestId: string;
}

interface MpesaStatusData {
  status: string;
  resultCode?: string;
  resultDesc?: string;
  mpesaReceiptNumber?: string | null;
  amount?: number;
  isActivationPayment?: boolean;
  completedAt?: Date;
  failedAt?: Date;
  source?: string;
  callbackUrl?: string;
}

interface MpesaSTKPushResult {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseDescription?: string;
  customerMessage?: string;
  callbackUrl?: string;
  responseTime?: number;
  error?: string;
}

interface StatusMapping {
  status: string;
  description: string;
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

/**
 * Get M-Pesa Access Token
 */
async function getMpesaAccessToken(): Promise<string> {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    if (!consumerKey || !consumerSecret) {
      throw new Error('MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET not found');
    }

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const response = await fetch(
      process.env.MPESA_ENVIRONMENT === 'production' 
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error);
    throw error;
  }
}

/**
 * Map M-Pesa API status codes to valid database enum values
 */
function mapMpesaStatusToDatabase(resultCode: string, resultDesc: string = ''): StatusMapping {
  const statusMap: { [key: string]: StatusMapping } = {
    '0': { 
      status: 'completed', 
      description: 'Payment completed successfully' 
    },
    '1': { status: 'failed', description: 'Insufficient balance' },
    '1032': { status: 'cancelled', description: 'Request cancelled by user' },
    '1037': { status: 'timeout', description: 'Request timeout - no response from user' },
    '2001': { status: 'failed', description: 'Invalid phone number format' },
    '1019': { status: 'failed', description: 'Transaction has expired' },
    '1001': { status: 'failed', description: 'Unable to lock subscriber - transaction in process' },
    '1025': { status: 'failed', description: 'Error sending push request' },
    '9999': { status: 'failed', description: 'Error sending push request' },
    '4999': { status: 'pending', description: 'Transaction in progress' }
  };

  if (!statusMap[resultCode]) {
    if (resultCode === '0' || parseInt(resultCode) < 1000) {
      return { status: 'pending', description: resultDesc || 'Transaction in progress' };
    }
    return { status: 'failed', description: resultDesc || 'Transaction failed' };
  }

  return statusMap[resultCode];
}

/**
 * Map M-Pesa result codes to valid database enum values
 */
function mapMpesaResultCodeToDatabase(resultCode: string): number {
  const code = parseInt(resultCode);
  const validCodes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 20, 26, 1032, 1037, 2001];
  
  if (validCodes.includes(code)) {
    return code;
  }
  
  if (code >= 1000 && code <= 1999) {
    return 1032;
  }
  
  if (code >= 2000 && code <= 2999) {
    return 2001;
  }
  
  return 11;
}

/**
 * M-Pesa STK Push initiation - matching deposit.ts working pattern exactly
 * Amount is in CENTS - will be converted to KES for M-Pesa
 */
async function initiateMpesaSTKPush(
  phoneNumber: string, 
  amountCents: number, 
  description: string,
  reference: string,
  activationPaymentId: string
): Promise<MpesaSTKPushResult> {
  try {
    // Convert cents to KES for M-Pesa API
    const amountKES = Math.floor(amountCents / 100);
    
    console.log('🔍 M-Pesa STK Push Initiation Started');
    console.log('📱 Phone:', phoneNumber);
    console.log('💰 Amount (cents):', amountCents, '| Amount (KES):', amountKES);
    console.log('📝 Description:', description);
    console.log('🏷️ Reference:', reference);
    console.log('🎯 Activation Payment ID:', activationPaymentId);

    const BusinessShortCode = process.env.MPESA_SHORTCODE;
    const PassKey = process.env.MPESA_PASSKEY;
    const CallbackUrl = process.env.MPESA_CALLBACK_URL;
    const Environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

    console.log('🔧 Environment Variables Check:');
    console.log('  BusinessShortCode:', BusinessShortCode ? '✅ Set' : '❌ Missing');
    console.log('  PassKey:', PassKey ? '✅ Set' : '❌ Missing');
    console.log('  CallbackUrl:', CallbackUrl ? '✅ Set' : '❌ Missing');
    console.log('  Environment:', Environment);

    if (!BusinessShortCode || !PassKey || !CallbackUrl) {
      const missingVars: string[] = [];
      if (!BusinessShortCode) missingVars.push('MPESA_SHORTCODE');
      if (!PassKey) missingVars.push('MPESA_PASSKEY');
      if (!CallbackUrl) missingVars.push('MPESA_CALLBACK_URL');
      
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`;
      console.error('❌', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    console.log('🔑 Getting M-Pesa access token...');
    const accessToken = await getMpesaAccessToken();
    console.log('✅ Access token obtained');

    // Generate timestamp matching deposit.ts format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    
    const password = Buffer.from(`${BusinessShortCode}${PassKey}${timestamp}`).toString('base64');

    console.log('⏰ Timestamp:', timestamp);
    console.log('🔐 Password (base64):', password.substring(0, 20) + '...');
    
    const stkPushPayload = {
      BusinessShortCode: BusinessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountKES,
      PartyA: phoneNumber,
      PartyB: BusinessShortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: CallbackUrl,
      AccountReference: reference,
      TransactionDesc: description.substring(0, 13),
    };

    console.log('📦 STK Push Payload:', JSON.stringify(stkPushPayload, null, 2));
    console.log('🌐 Callback URL Being Registered:', CallbackUrl);
    console.log('⚙️ Environment:', Environment);

    const mpesaApiUrl = Environment === 'production' 
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    console.log('🌐 M-Pesa API Endpoint:', mpesaApiUrl);

    const startTime = Date.now();
    const response = await fetch(mpesaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(stkPushPayload)
    });

    const responseTime = Date.now() - startTime;
    console.log('📡 M-Pesa API Response Time:', responseTime, 'ms');
    console.log('📡 M-Pesa Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ M-Pesa API Error Response:', errorText);
      
      let errorMessage = `M-Pesa API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errorMessage) {
          errorMessage = errorData.errorMessage;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.responseDescription) {
          errorMessage = errorData.responseDescription;
        } else if (errorData.ResultDesc) {
          errorMessage = errorData.ResultDesc;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      return {
        success: false,
        error: errorMessage,
        responseTime
      };
    }

    const data = await response.json();
    console.log('📨 M-Pesa API Success Response:', JSON.stringify(data, null, 2));

    if (data.ResponseCode === '0') {
      console.log('✅ M-Pesa STK Push initiated successfully');
      console.log('🔗 CheckoutRequestID:', data.CheckoutRequestID);
      console.log('🔗 MerchantRequestID:', data.MerchantRequestID);

      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
        callbackUrl: CallbackUrl,
        responseTime
      };
    } else {
      console.error('❌ M-Pesa STK Push failed with code:', data.ResponseCode);
      
      return {
        success: false,
        error: data.ResponseDescription || 'M-Pesa request failed',
        responseTime
      };
    }
  } catch (error) {
    console.error('💥 M-Pesa STK Push network error:', error);
    
    let errorMessage = 'Failed to connect to M-Pesa service';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Query M-Pesa transaction status - NO retry logic here, client handles polling
 */
async function queryMpesaTransactionStatus(checkoutRequestId: string): Promise<ApiResponse<MpesaStatusData>> {
  try {
    console.log('[v0] Querying M-Pesa for status:', checkoutRequestId);

    const accessToken = await getMpesaAccessToken();
    
    const BusinessShortCode = process.env.MPESA_SHORTCODE;
    const PassKey = process.env.MPESA_PASSKEY;
    const Environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

    if (!BusinessShortCode || !PassKey) {
      throw new Error('MPESA_SHORTCODE or MPESA_PASSKEY not found');
    }

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${BusinessShortCode}${PassKey}${timestamp}`).toString('base64');

    const queryPayload = {
      BusinessShortCode: BusinessShortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    const mpesaApiUrl = Environment === 'production' 
      ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    const response = await fetch(mpesaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(queryPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[v0] M-Pesa API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    console.log('[v0] M-Pesa response:', data);

    // "Transaction within processing limit" means PENDING - not an error
    if (data.ResponseDescription?.includes('processing') || data.ResponseDescription?.includes('limit')) {
      console.log('[v0] Transaction processing - pending status');
      return {
        success: true,
        data: {
          status: 'pending',
          resultCode: '4999',
          resultDesc: 'Transaction in progress',
          mpesaReceiptNumber: null,
          amount: 0,
          isActivationPayment: true
        }
      };
    }

    const mappedStatus = mapMpesaStatusToDatabase(data.ResultCode, data.ResultDesc);
    const mappedResultCode = mapMpesaResultCodeToDatabase(data.ResultCode);

    return {
      success: true,
      data: {
        status: mappedStatus.status,
        resultCode: mappedResultCode.toString(),
        resultDesc: mappedStatus.description || data.ResultDesc,
        mpesaReceiptNumber: data.MpesaReceiptNumber || null,
        amount: 0,
        isActivationPayment: true
      }
    };

  } catch (error) {
    console.error('[v0] Query error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to query transaction status' 
    };
  }
}

/**
 * Get or create company profile
 */
async function getOrCreateCompany() {
  let company = await Company.findOne({ email: 'company@hustlehubafrica.com' });
  
  if (!company) {
    company = await Company.create({
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
      paymentMethod: 'mpesa' as const,
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
 * Sync activation transaction status with M-Pesa transaction status
 * Following the exact pattern from deposit.ts
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
 * Check activation payment status via M-Pesa
 * Replicates the exact pattern from deposit.ts checkMpesaPaymentStatus()
 */
export async function checkActivationPaymentStatus(checkoutRequestId: string): Promise<ApiResponse<MpesaStatusData>> {
  try {
    console.log('🔍 Checking activation payment status:', checkoutRequestId);

    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'User not authenticated' };
    }

    await connectToDatabase();

    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: checkoutRequestId
    });

    if (!mpesaTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // If already final status, return immediately (no need to query M-Pesa again)
    // This ensures we use the callback-provided data when available
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(mpesaTransaction.status)) {
      console.log('✅ Transaction already in final state:', mpesaTransaction.status);
      console.log('📝 Source:', mpesaTransaction.metadata?.callback_processed ? 'Safaricom Callback' : 'Database');
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          isActivationPayment: true,
          completedAt: mpesaTransaction.completed_at,
          failedAt: mpesaTransaction.failed_at,
          source: mpesaTransaction.metadata?.callback_processed ? 'safaricom_callback' : 'database'
        },
        message: `Payment status: ${mpesaTransaction.status}`
      };
    }

    // Query M-Pesa for latest status
    console.log('📡 Querying M-Pesa API for activation payment status...');
    
    let accessToken, timestamp, password, queryPayload;
    
    try {
      accessToken = await getMpesaAccessToken();
      timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

      queryPayload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };
    } catch (tokenError) {
      console.error('❌ Failed to get M-Pesa access token:', tokenError);
      // Return current transaction status from database
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc || 'Checking payment status...',
          source: 'database_fallback',
          isActivationPayment: true,
          message: 'Could not reach M-Pesa service, using last known status'
        }
      };
    }

    const mpesaApiUrl = (process.env.MPESA_ENVIRONMENT === 'production') 
      ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    let queryResponse;
    try {
      queryResponse = await fetch(mpesaApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryPayload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
    } catch (fetchError) {
      console.error('❌ M-Pesa API fetch error:', fetchError);
      // Return current transaction status from database as fallback
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc || 'Checking payment status...',
          source: 'database_fallback',
          isActivationPayment: true,
          fallbackReason: 'M-Pesa API unavailable'
        },
        message: 'M-Pesa service temporarily unavailable. Using last known status. Please check again in a moment.'
      };
    }

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('❌ M-Pesa query API error:', errorText);
      // Return current transaction status from database
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc || 'Checking payment status...',
          source: 'database_fallback',
          isActivationPayment: true
        },
        message: 'Using last known status. Please wait for payment confirmation.'
      };
    }

    const queryData = await queryResponse.json();
    console.log('📨 M-Pesa query response:', queryData);

    const safeResultCode = mapMpesaResultCodeToDatabase(queryData.ResultCode);
    const safeStatus = mapMpesaStatusToDatabase(queryData.ResultCode).status;

    // Update MpesaTransaction
    mpesaTransaction.status = safeStatus;
    mpesaTransaction.result_code = safeResultCode;
    mpesaTransaction.result_desc = queryData.ResultDesc || 'No description provided';

    if (safeStatus === 'completed') {
      mpesaTransaction.mpesa_receipt_number = queryData.MpesaReceiptNumber;
      mpesaTransaction.completed_at = new Date();
    } else if (['failed', 'cancelled', 'timeout'].includes(safeStatus)) {
      mpesaTransaction.failed_at = new Date();
    }

    try {
      await mpesaTransaction.save();
      console.log('💾 Successfully updated M-Pesa transaction with status:', safeStatus);
    } catch (saveError) {
      console.error('❌ Failed to save M-Pesa transaction:', saveError);
      return {
        success: true,
        data: {
          status: safeStatus,
          resultCode: safeResultCode.toString(),
          resultDesc: queryData.ResultDesc,
          mpesaReceiptNumber: queryData.MpesaReceiptNumber,
          source: 'api_unsaved',
          isActivationPayment: true
        },
        message: `Payment status: ${safeStatus} (database update failed)`
      };
    }

    // Sync Transaction record and update profile if completed
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(safeStatus)) {
      try {
        await syncActivationTransactionWithMpesaStatus(
          mpesaTransaction._id,
          safeStatus,
          safeResultCode,
          queryData.ResultDesc,
          queryData.MpesaReceiptNumber
        );

        // If completed, update user profile activation status
        if (safeStatus === 'completed') {
          const user = await (Profile as any).findById(mpesaTransaction.user_id);
          if (user) {
            user.activation_paid = true;
            user.approval_status = 'approved';
            user.rank = 'Bronze';
            user.is_active = true;
            user.status = 'active';
            await user.save();
            console.log('✅ User activation status updated');
            revalidatePath('/dashboard');
            revalidatePath('/auth/activate');
          }
        }
      } catch (updateError) {
        console.error('❌ Failed to sync transaction or update profile:', updateError);
      }
    }

    return {
      success: true,
      data: {
        status: mpesaTransaction.status,
        resultCode: mpesaTransaction.result_code?.toString(),
        resultDesc: mpesaTransaction.result_desc,
        mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
        completedAt: mpesaTransaction.completed_at,
        failedAt: mpesaTransaction.failed_at,
        source: 'api',
        isActivationPayment: true
      },
      message: `Payment status: ${mpesaTransaction.status}`
    };

  } catch (error) {
    console.error('💥 Check activation payment status error:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to check activation payment status. Please try again.';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Network error while checking payment status. The M-Pesa service may be temporarily unavailable. Please check again in a moment.';
    } else if (error instanceof Error && error.message.includes('timeout')) {
      errorMessage = 'Payment status check timed out. Please wait a moment and try again.';
    }
    
    return { 
      success: false, 
      message: errorMessage,
      data: {
        status: 'error',
        resultCode: '9999',
        resultDesc: 'Unable to verify payment status'
      }
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
 * Register C2B URLs with M-Pesa
 */
export async function registerMpesaUrls(): Promise<ApiResponse<UrlRegistrationData>> {
  try {
    console.log('🔗 Registering M-Pesa URLs...');

    const BusinessShortCode = process.env.MPESA_SHORTCODE;
    const Environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    const baseUrl = process.env.NEXTAUTH_URL || process.env.MPESA_CALLBACK_URL?.replace('/api/mpesa/callback', '');

    if (!BusinessShortCode || !baseUrl) {
      throw new Error('MPESA_SHORTCODE or base URL not found');
    }

    const accessToken = await getMpesaAccessToken();

    const c2bPayload = {
      ShortCode: BusinessShortCode,
      ResponseType: 'Completed',
      ConfirmationURL: `${baseUrl}/api/mpesa/confirmation`,
      ValidationURL: `${baseUrl}/api/mpesa/validation`
    };

    const c2bApiUrl = Environment === 'production' 
      ? 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl'
      : 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl';

    const response = await fetch(c2bApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(c2bPayload)
    });

    const data = await response.json();

    if (data.ResponseCode === '0') {
      console.log('✅ M-Pesa URLs registered successfully');
      
      return { 
        success: true, 
        message: 'URLs registered successfully',
        data: {
          confirmationUrl: c2bPayload.ConfirmationURL,
          validationUrl: c2bPayload.ValidationURL,
          callbackUrl: `${baseUrl}/api/mpesa/callback`
        }
      };
    } else {
      console.error('❌ M-Pesa URL registration failed:', data.ResponseDescription);
      return { 
        success: false, 
        error: data.ResponseDescription || 'Failed to register URLs' 
      };
    }
  } catch (error) {
    console.error('💥 M-Pesa URL registration error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to register M-Pesa URLs' 
    };
  }
}

/**
 * ✅ FIXED: Initiate activation payment - check correct fields
 */
export async function initiateActivationPayment(phoneNumber: string): Promise<ApiResponse<ActivationPaymentData>> {
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

    // ✅ FIXED: Check if already activated using correct fields
    const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';
    if (isActivationPaid) {
      return { success: false, message: 'Account is already activated' };
    }

    // Validate and format phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return { success: false, message: 'Invalid phone number format. Use 791406285, 0791406285, 254791406285, or +254791406285' };
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    const mpesaPhone = getMpesaPhoneFormat(formattedPhone);

    // CRITICAL: Verify that the phone number matches the user's registered phone
    if (!phoneNumbersMatch(mpesaPhone, userProfile.phone_number)) {
      console.error('[v0] Phone number mismatch for activation:', {
        providedPhone: mpesaPhone,
        registeredPhone: userProfile.phone_number,
        userId: userProfile._id
      });
      return { success: false, message: 'Phone number does not match your registered phone number. Activation payments must be made from your registered phone number.' };
    }

    // Always use 9000 cents (KES 90) as the standard activation fee
    // This ensures consistency regardless of any legacy values in user profiles
    const activationAmount = 9000; // KES 90 - standard activation fee

    console.log('🎯 Starting activation payment process:');
    console.log('👤 User:', userProfile.username);
    console.log('📱 Phone:', formattedPhone);
    console.log('💰 Amount:', activationAmount, 'cents');

    const activationPayment = new (ActivationPayment as any)({
      user_id: userProfile._id,
      amount_cents: activationAmount,
      provider: 'mpesa',
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: {
        activation_type: 'account_activation',
        auto_approved: false,
        requires_manual_review: false,
        initiated_at: new Date().toISOString()
      }
    });

    await activationPayment.save();
    console.log('💾 Activation payment record created:', activationPayment._id);

    const activationLog = new (ActivationLog as any)({
      user_id: userProfile._id,
      action: 'initiated',
      amount_cents: activationAmount,
      phone_number: mpesaPhone,
      status: 'pending',
      metadata: {
        activation_payment_id: activationPayment._id
      }
    });
    await activationLog.save();

    const mpesaResult = await initiateMpesaSTKPush(
      mpesaPhone,
      activationAmount,
      `Activation fee for ${userProfile.username}`,
      `ACTIVATION-${userProfile._id}`,
      activationPayment._id.toString()
    );

    if (mpesaResult.success && mpesaResult.checkoutRequestId && mpesaResult.merchantRequestId) {
      activationPayment.checkout_request_id = mpesaResult.checkoutRequestId;
      activationPayment.provider_reference = mpesaResult.merchantRequestId;
      activationPayment.metadata = {
        ...activationPayment.metadata,
        callback_url: mpesaResult.callbackUrl,
        stk_push_initiated_at: new Date().toISOString()
      };
      await activationPayment.save();

      const mpesaTransaction = new (MpesaTransaction as any)({
        user_id: userProfile._id,
        amount_cents: activationAmount,
        phone_number: formattedPhone,
        account_reference: `ACTIVATION-${userProfile._id}`,
        transaction_desc: `Account activation fee for ${userProfile.username}`,
        checkout_request_id: mpesaResult.checkoutRequestId,
        merchant_request_id: mpesaResult.merchantRequestId,
        status: 'pending',
        is_activation_payment: true,
        source: 'activation',
        metadata: {
          activation_payment_id: activationPayment._id,
          callback_url: mpesaResult.callbackUrl,
          user_username: userProfile.username,
          deposit_type: 'activation'
        }
      });
      await mpesaTransaction.save();

      activationPayment.mpesa_transaction_id = mpesaTransaction._id;
      await activationPayment.save();

      // 🔧 CREATE TRANSACTION RECORD for ledger (matching deposit.ts pattern)
      const transaction = await (Transaction as any).create({
        user_id: userProfile._id,
        amount_cents: activationAmount,
        type: 'ACCOUNT_ACTIVATION',
        description: `Account activation fee via M-Pesa from ${formattedPhone}`,
        status: 'pending',
        mpesa_transaction_id: mpesaTransaction._id,
        
        // ✅ REQUIRED fields for transaction tracking.
        // target_type must match schema enum ['user','company'].
        // deposit_type in metadata identifies this as an activation payment
        // so the callback can route it correctly.
        target_type: 'user',
        target_id: userProfile._id.toString(),
        
        metadata: {
          phoneNumber: formattedPhone,
          provider: 'mpesa',
          checkoutRequestID: mpesaResult.checkoutRequestId,
          merchantRequestID: mpesaResult.merchantRequestId,
          accountReference: `ACTIVATION-${userProfile._id}`,
          initiated_at: new Date().toISOString()
        }
      });

      activationLog.metadata = {
        ...activationLog.metadata,
        checkout_request_id: mpesaResult.checkoutRequestId,
        merchant_request_id: mpesaResult.merchantRequestId,
        mpesa_transaction_id: mpesaTransaction._id,
        transaction_id: transaction._id
      };
      await activationLog.save();

      console.log('✅ M-Pesa STK Push initiated successfully');
      console.log('✅ M-Pesa transaction created:', mpesaTransaction._id);
      console.log('✅ Transaction record created:', transaction._id);

      return {
        success: true,
        data: {
          checkoutRequestId: mpesaResult.checkoutRequestId,
          amount: activationAmount,
          phoneNumber: formattedPhone,
          activationPaymentId: activationPayment._id.toString(),
          callbackUrl: mpesaResult.callbackUrl || '',
          merchantRequestId: mpesaResult.merchantRequestId
        }
      };
    } else {
      activationPayment.status = 'failed';
      activationPayment.error_message = mpesaResult.error;
      await activationPayment.save();

      activationLog.status = 'failed';
      activationLog.error_message = mpesaResult.error;
      await activationLog.save();

      return { 
        success: false, 
        message: mpesaResult.error || 'Failed to initiate M-Pesa payment' 
      };
    }
  } catch (error) {
    console.error('💥 Activation payment error:', error);
    return { success: false, message: 'An error occurred during payment processing' };
  }
}

/**
 * Enhanced M-Pesa payment status check
 */
export async function checkMpesaPaymentStatus(checkoutRequestId: string): Promise<ApiResponse<MpesaStatusData>> {
  try {
    await connectToDatabase();

    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, message: 'User not authenticated' };
    }

    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: checkoutRequestId
    });

    if (mpesaTransaction && ['completed', 'failed'].includes(mpesaTransaction.status)) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          amount: mpesaTransaction.amount_cents,
          isActivationPayment: mpesaTransaction.is_activation_payment,
          completedAt: mpesaTransaction.completed_at,
          failedAt: mpesaTransaction.failed_at,
          source: 'database'
        }
      };
    }

    console.log('🔍 Querying M-Pesa API directly for status...');
    const apiStatus = await queryMpesaTransactionStatus(checkoutRequestId);
    
    if (apiStatus.success && apiStatus.data) {
      if (mpesaTransaction) {
        const updateData: any = {
          status: apiStatus.data.status,
          result_code: apiStatus.data.resultCode,
          result_desc: apiStatus.data.resultDesc,
        };

        if (apiStatus.data.status === 'completed' && apiStatus.data.mpesaReceiptNumber && apiStatus.data.mpesaReceiptNumber !== 'N/A') {
          updateData.mpesa_receipt_number = apiStatus.data.mpesaReceiptNumber;
          updateData.completed_at = new Date();
        } else if (apiStatus.data.status === 'failed') {
          updateData.failed_at = new Date();
        }

        await (MpesaTransaction as any).updateOne(
          { _id: mpesaTransaction._id },
          { $set: updateData }
        );
      }

      return {
        success: true,
        data: {
          ...apiStatus.data,
          source: 'api'
        }
      };
    }

    if (mpesaTransaction) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code?.toString(),
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          amount: mpesaTransaction.amount_cents,
          isActivationPayment: mpesaTransaction.is_activation_payment,
          source: 'database_fallback'
        }
      };
    }

    return { 
      success: false, 
      message: 'Transaction not found' 
    };

  } catch (error) {
    console.error('Error checking payment status:', error);
    return { success: false, message: 'Failed to check payment status' };
  }
}

/**
 * ✅ FIXED: Complete activation after successful payment - Update correct schema fields
 */
export async function completeActivationAfterPayment(activationPaymentId: string): Promise<ApiResponse<ActivationCompletionData>> {
  try {
    await connectToDatabase();

    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, message: 'User not authenticated' };
    }

    const userProfile = await (Profile as any).findOne({ email: session.user.email });
    const activationPayment = await (ActivationPayment as any).findById(activationPaymentId);

    if (!userProfile || !activationPayment) {
      return { success: false, message: 'User or activation payment not found' };
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
        payment_method: 'mpesa',
        mpesa_receipt: activationPayment.mpesa_receipt_number,
        phone_number: activationPayment.phone_number
      }
    });
    await activationFeeTransaction.save();

    // =============================================================================
    // STEP 2: Process Referral Bonus - KES 70 per Direct Referral
    // =============================================================================
    let referralBonus = null;

    if (userProfile.referred_by) {
      try {
        const referrer = await (Profile as any).findById(userProfile.referred_by);
        
        if (referrer) {
          const referralRecord = await (Referral as any).findOne({
            referrer_id: referrer._id,
            referred_id: userProfile._id
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

            console.log(`✅ Direct referral bonus awarded: ${referrer.username} earned KES 70`);

          } else if (referralRecord && referralRecord.referral_bonus_paid) {
            console.log(`[v0] Referral bonus already paid for ${userProfile.username}`);
          }
        }
      } catch (referralError) {
        console.error('⚠️ Error processing referral bonus:', referralError);
      }
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
    userProfile.approval_status = 'approved'; // ��� FIXED: Set approval_status to 'approved'
    userProfile.is_approved = true;
    userProfile.level = 1;
    userProfile.rank = 'Bronze'; // ✅ FIXED: Change rank from 'Unactivated' to 'Bronze'
    userProfile.activation_transaction_id = activationFeeTransaction._id;
    await userProfile.save();

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
