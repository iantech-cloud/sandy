// app/actions/deposit.ts
'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { connectToDatabase, Profile, MpesaTransaction, Transaction } from '../lib/models';
import { formatPhoneNumber, isValidPhoneNumber, phoneNumbersMatch, getMpesaPhoneFormat } from '../lib/utils/phoneFormatter';
import { createCoopBankService, CoopBankService } from '../lib/services/coop-bank';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get user-friendly message for deposit status
 */
function getDepositUserMessage(status: string, responseDescription?: string): string {
  switch (status) {
    case 'completed':
      return 'Payment successful! Your wallet has been credited.';
    case 'failed':
      return `Payment failed: ${responseDescription || 'Transaction could not be processed'}`;
    case 'timeout':
      return 'Payment timeout: No response from M-Pesa. Please check your M-Pesa history and try again.';
    case 'cancelled':
      return 'Payment cancelled: You cancelled the M-Pesa prompt.';
    case 'pending':
      return 'Payment is still being processed. Please wait...';
    default:
      return `Payment status: ${status}`;
  }
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface DepositHistoryItem {
    id: string;
    type: string;
    amount: number;
    description: string;
    date: string;
    status: string;
    transaction_code?: string;
    receiptNumber?: string;
}

interface UserBalance {
    balance: number;
    balance_cents: number;
}

interface ValidationResult {
    valid: boolean;
    message: string;
    data?: { formattedPhone: string };
}

interface ProcessDepositResponse {
    success: boolean;
    data?: any;
    message: string;
}

interface PaymentStatusResponse {
    success: boolean;
    data?: any;
    message: string;
}

interface DepositHistoryResponse {
    success: boolean;
    data?: DepositHistoryItem[];
    message: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

interface BalanceResponse {
    success: boolean;
    data?: UserBalance;
    message: string;
}

// ---------------------------------------------------------------------------
// Session type guard
// ---------------------------------------------------------------------------

interface SessionWithUser {
    user: {
        email?: string | null;
        name?: string | null;
        image?: string | null;
    };
    expires: string;
}

function isValidSession(session: unknown): session is SessionWithUser {
    return (
        session !== null &&
        typeof session === 'object' &&
        'user' in session &&
        (session as any).user !== null &&
        typeof (session as any).user === 'object' &&
        'email' in (session as any).user &&
        typeof (session as any).user.email === 'string' &&
        (session as any).user.email.length > 0
    );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate deposit parameters before calling the payment API.
 */
async function validateDeposit(
    userId: string,
    amount: number,
    phoneNumber: string
): Promise<ValidationResult> {
    if (amount < 10 || amount > 70000) {
        return { valid: false, message: 'Amount must be between KES 10 and KES 70,000' };
    }

    if (!isValidPhoneNumber(phoneNumber)) {
        return { valid: false, message: 'Invalid phone number format. Use 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX' };
    }

    const formattedPhone = getMpesaPhoneFormat(formatPhoneNumber(phoneNumber));

    await connectToDatabase();
    const user = await (Profile as any).findById(userId);
    if (!user) {
        return { valid: false, message: 'User not found' };
    }

    // Phone must match the user's registered number
    if (!phoneNumbersMatch(formattedPhone, user.phone_number)) {
        return {
            valid: false,
            message: 'Phone number does not match your registered phone number. Deposits can only be made from your registered phone number.',
        };
    }

    // Block if there is already an in-flight wallet deposit within the last 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const pending = await (MpesaTransaction as any).findOne({
        user_id: userId,
        status: { $in: ['initiated', 'pending'] },
        phone_number: formattedPhone,
        source: 'wallet',
        created_at: { $gte: threeMinutesAgo },
    });

    if (pending) {
        return {
            valid: false,
            message: 'You have a pending deposit in progress. Please wait for it to complete before starting another.',
        };
    }

    // Clean up old pending transactions (> 3 minutes old) - mark them as timeout/failed
    const stalePendingTransactions = await (MpesaTransaction as any).find({
        user_id: userId,
        status: { $in: ['initiated', 'pending'] },
        source: 'wallet',
        created_at: { $lt: threeMinutesAgo },
    });

    if (stalePendingTransactions.length > 0) {
        console.log(`[Deposit] Cleaning up ${stalePendingTransactions.length} stale pending transactions for user ${userId}`);
        // Mark them as timeout since they're older than 3 minutes
        await (MpesaTransaction as any).updateMany(
            {
                user_id: userId,
                status: { $in: ['initiated', 'pending'] },
                source: 'wallet',
                created_at: { $lt: threeMinutesAgo },
            },
            {
                status: 'timeout',
                result_desc: 'Transaction timed out - no user response within 3 minutes',
                failed_at: new Date(),
            }
        );
    }

    return { valid: true, message: 'Validation passed', data: { formattedPhone } };
}

// ---------------------------------------------------------------------------
// Transaction record sync (status only — no wallet credits here)
// ---------------------------------------------------------------------------

async function syncTransactionStatus(
    mpesaTransactionId: any,
    status: string,
    resultCode: number,
    resultDesc: string,
    receiptNumber?: string
): Promise<void> {
    try {
        const updateData: any = {
            status,
            metadata: {
                result_code: resultCode,
                result_desc: resultDesc,
                status_updated_at: new Date().toISOString(),
            },
        };

        if (status === 'completed' && receiptNumber) {
            updateData.metadata.receipt_number = receiptNumber;
            updateData.metadata.completed_at = new Date().toISOString();
        }

        if (['failed', 'cancelled', 'timeout'].includes(status)) {
            updateData.metadata.failed_at = new Date().toISOString();
        }

        await (Transaction as any).findOneAndUpdate(
            { mpesa_transaction_id: mpesaTransactionId },
            updateData
        );
    } catch (error) {
        console.error('[Deposit] Failed to sync Transaction status:', error);
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Main exported action: initiate a wallet deposit via Co-op Bank STK Push
// ---------------------------------------------------------------------------

/**
 * Process a wallet deposit by sending a Co-op Bank STK Push to the user's phone.
 * On success returns a messageReference that the client polls with
 * `checkCoopDepositStatus`.
 *
 * NOTE: wallet balance is credited ONLY in the Co-op Bank callback route
 * (/api/payments/coop-bank/callback) — never here.
 */
export async function processMpesaDeposit(depositData: {
    amount: number;
    phoneNumber: string;
}): Promise<ProcessDepositResponse> {
    try {
        // TEMPORARY: Block all payments - Co-op Bank is disabled
        return { 
            success: false, 
            message: 'DEBIT ACCOUNT AUTHORIZATION FAILURE',
            data: {
                error: 'Payment processing is temporarily unavailable. Please try again later.'
            }
        };
    } catch (error) {
        console.error('[Deposit] processMpesaDeposit blocked:', error);
        return { 
            success: false, 
            message: 'DEBIT ACCOUNT AUTHORIZATION FAILURE',
            data: { error: 'Payment processing is temporarily unavailable.' }
        };
    }
}

export async function processMpesaDeposit_OLD(depositData: {
    amount: number;
    phoneNumber: string;
}): Promise<ProcessDepositResponse> {
    try {
        const session = await auth();

        if (!isValidSession(session)) {
            return { success: false, message: 'User not authenticated' };
        }

        await connectToDatabase();
        const currentUser = await (Profile as any).findOne({ email: session.user.email });

        if (!currentUser) {
            return { success: false, message: 'User profile not found' };
        }

        const validation = await validateDeposit(
            currentUser._id.toString(),
            depositData.amount,
            depositData.phoneNumber
        );

        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        const formattedPhone = validation.data!.formattedPhone;
        const amountCents = Math.round(depositData.amount * 100);

        // Generate a unique message reference
        const messageReference = `SANDY${Date.now()}${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

        const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

        // Create the MpesaTransaction record BEFORE calling the API so the
        // callback always finds a matching record even if the API response is slow.
        const mpesaTransaction = await (MpesaTransaction as any).create({
            user_id: currentUser._id,
            amount_cents: amountCents,
            phone_number: formattedPhone,
            account_reference: `DEPOSIT-${currentUser._id.toString().slice(-8).toUpperCase()}`,
            transaction_desc: `Wallet deposit - ${currentUser.username}`,
            checkout_request_id: messageReference, // used as the lookup key in the callback
            status: 'initiated',
            source: 'wallet',
            metadata: {
                user_username: currentUser.username,
                deposit_type: 'wallet',
                payment_method: 'coop_bank_stk_push',
                initiated_at: new Date().toISOString(),
                callback_url: callbackUrl,
            },
        });

        // Create a pending Transaction record so the wallet history is visible immediately
        const transaction = await (Transaction as any).create({
            user_id: currentUser._id,
            amount_cents: amountCents,
            type: 'DEPOSIT',
            description: `Co-op Bank deposit from ${formattedPhone}`,
            status: 'pending',
            mpesa_transaction_id: mpesaTransaction._id,
            target_type: 'user',
            target_id: currentUser._id.toString(),
            metadata: {
                phoneNumber: formattedPhone,
                provider: 'coop_bank',
                messageReference,
                initiated_at: new Date().toISOString(),
            },
        });

        // Now call the Co-op Bank STK Push API
        const coopBank = createCoopBankService();

        const stkResponse = await coopBank.initiateSTKPush(
            formattedPhone,
            depositData.amount,
            `Wallet deposit - ${currentUser.username}`,
            callbackUrl,
            messageReference
        );

        // Non-'0' ResponseCode means the bank rejected the initiation
        if (stkResponse.ResponseCode !== '0') {
            // Mark the pre-created records as failed
            await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
                status: 'failed',
                result_desc: stkResponse.ResponseDescription || 'STK Push rejected by bank',
            });
            await (Transaction as any).findByIdAndUpdate(transaction._id, { status: 'failed' });

            return {
                success: false,
                message: stkResponse.ResponseDescription || 'Failed to initiate payment. Please try again.',
            };
        }

        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');

        return {
            success: true,
            data: {
                messageReference,
                ResponseDescription: stkResponse.ResponseDescription,
                Amount: depositData.amount,
                PhoneNumber: formattedPhone,
                transactionId: transaction._id.toString(),
                mpesaTransactionId: mpesaTransaction._id.toString(),
            },
            message:
                stkResponse.ResponseDescription ||
                'Payment prompt sent. Please check your phone to complete the payment.',
        };

    } catch (error) {
        console.error('[Deposit] processCoopDeposit error:', error);
        return {
            success: false,
            message: 'An error occurred while processing your deposit. Please try again.',
        };
    }
}

// ---------------------------------------------------------------------------
// Poll deposit status via Co-op Bank Enquiry API
// ---------------------------------------------------------------------------

/**
 * Check the status of a Co-op Bank wallet deposit.
 * Wallet crediting is NEVER done here — only in the callback route.
 */
export async function checkMpesaPaymentStatus(messageReference: string): Promise<PaymentStatusResponse> {
    try {
        const session = await auth();

        if (!isValidSession(session)) {
            return { success: false, message: 'User not authenticated' };
        }

        await connectToDatabase();

        const mpesaTransaction = await (MpesaTransaction as any).findOne({
            checkout_request_id: messageReference,
        });

        if (!mpesaTransaction) {
            return { success: false, message: 'Transaction not found' };
        }

        // Terminal state — return immediately without hitting the API
        const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
        if (terminalStatuses.includes(mpesaTransaction.status)) {
            return {
                success: true,
                data: {
                    status: mpesaTransaction.status,
                    receiptNumber: mpesaTransaction.mpesa_receipt_number,
                    amount: mpesaTransaction.amount_cents,
                    completedAt: mpesaTransaction.completed_at,
                    failedAt: mpesaTransaction.failed_at,
                    source: 'database',
                },
                message: `Payment status: ${mpesaTransaction.status}`,
            };
        }

        // Callback already processed — sync status only
        if (mpesaTransaction.metadata?.callback_processed) {
            return {
                success: true,
                data: {
                    status: mpesaTransaction.status,
                    amount: mpesaTransaction.amount_cents,
                    source: 'callback_processed',
                },
                message: `Payment ${mpesaTransaction.status}`,
            };
        }

        // Query Co-op Bank Enquiry API
        const coopBank = createCoopBankService();
        const statusResponse = await coopBank.getTransactionStatus(messageReference);

        const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

        console.log('[Deposit] Payment status check:', {
          messageReference,
          responseCode: statusResponse.ResponseCode,
          mappedStatus,
          description: statusResponse.ResponseDescription,
        });

        if (terminalStatuses.includes(mappedStatus)) {
            // Safe parse result code - avoid NaN
            const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
            const safeResultCode = isNaN(resultCode) ? 1 : resultCode;
            
            // Update the MpesaTransaction record status (wallet credit still via callback)
            await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
                status: mappedStatus,
                result_code: safeResultCode,
                result_desc: statusResponse.ResponseDescription || '',
                ...(mappedStatus === 'completed' ? { completed_at: new Date() } : { failed_at: new Date() }),
            });

            await syncTransactionStatus(
                mpesaTransaction._id,
                mappedStatus,
                safeResultCode,
                statusResponse.ResponseDescription || '',
                undefined
            );
        }

        return {
            success: true,
            data: {
                status: mappedStatus,
                resultCode: statusResponse.ResponseCode,
                resultDesc: statusResponse.ResponseDescription || '',
                amount: mpesaTransaction.amount_cents,
                source: 'api',
                responseCode: statusResponse.ResponseCode,
                responseDescription: statusResponse.ResponseDescription,
            },
            message: getDepositUserMessage(mappedStatus, statusResponse.ResponseDescription),
        };

    } catch (error) {
        console.error('[Deposit] checkCoopDepositStatus error:', error);
        return { success: false, message: 'Failed to check payment status. Please try again.' };
    }
}

// ---------------------------------------------------------------------------
// Sync transaction status helper (called by admin/debug tooling)
// ---------------------------------------------------------------------------

export async function syncTransactionStatusAction(transactionId: string): Promise<PaymentStatusResponse> {
    try {
        await connectToDatabase();

        const transaction = await (Transaction as any).findById(transactionId);
        if (!transaction || !transaction.mpesa_transaction_id) {
            return { success: false, message: 'Transaction not found or not linked to a payment' };
        }

        const mpesaTransaction = await (MpesaTransaction as any).findById(transaction.mpesa_transaction_id);
        if (!mpesaTransaction) {
            return { success: false, message: 'Payment transaction not found' };
        }

        const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
        if (
            transaction.status !== mpesaTransaction.status &&
            terminalStatuses.includes(mpesaTransaction.status)
        ) {
            await syncTransactionStatus(
                mpesaTransaction._id,
                mpesaTransaction.status,
                mpesaTransaction.result_code,
                mpesaTransaction.result_desc,
                mpesaTransaction.mpesa_receipt_number
            );
        }

        return {
            success: true,
            data: {
                transactionStatus: transaction.status,
                paymentStatus: mpesaTransaction.status,
                synced: transaction.status === mpesaTransaction.status,
            },
            message: `Transaction status: ${transaction.status}`,
        };

    } catch (error) {
        console.error('[Deposit] syncTransactionStatusAction error:', error);
        return { success: false, message: 'Failed to sync transaction status' };
    }
}

// ---------------------------------------------------------------------------
// Deposit history
// ---------------------------------------------------------------------------

export async function getDepositHistory(limit: number = 20, page: number = 1): Promise<DepositHistoryResponse> {
    try {
        const session = await auth();

        if (!isValidSession(session)) {
            return { success: false, message: 'User not authenticated' };
        }

        await connectToDatabase();
        const currentUser = await (Profile as any).findOne({ email: session.user.email });

        if (!currentUser) {
            return { success: false, message: 'User not found' };
        }

        const skip = (page - 1) * limit;

        const [deposits, total] = await Promise.all([
            (Transaction as any).find({ user_id: currentUser._id })
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            (Transaction as any).countDocuments({ user_id: currentUser._id }),
        ]);

        const transformed: DepositHistoryItem[] = deposits.map((d: any) => ({
            id: d._id?.toString(),
            type: d.type,
            amount: d.amount_cents / 100,
            description: d.description,
            date: d.created_at?.toISOString() || new Date().toISOString(),
            status: d.status,
            transaction_code: d.transaction_code,
            receiptNumber:
                d.metadata?.receipt_number ||
                d.metadata?.mpesa_receipt_number ||
                d.metadata?.receiptNumber,
        }));

        return {
            success: true,
            data: transformed,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            message: 'Deposit history fetched successfully',
        };

    } catch (error) {
        console.error('[Deposit] getDepositHistory error:', error);
        return { success: false, message: 'Failed to fetch deposit history', data: [] };
    }
}

// ---------------------------------------------------------------------------
// User balance
// ---------------------------------------------------------------------------

export async function getUserBalance(): Promise<BalanceResponse> {
    try {
        const session = await auth();

        if (!isValidSession(session)) {
            return { success: false, message: 'User not authenticated' };
        }

        await connectToDatabase();
        const currentUser = await (Profile as any).findOne({ email: session.user.email });

        if (!currentUser) {
            return { success: false, message: 'User not found' };
        }

        const balanceCents = currentUser.balance_cents || 0;

        return {
            success: true,
            data: {
                balance: balanceCents / 100,
                balance_cents: balanceCents,
            },
            message: 'Balance fetched successfully',
        };

    } catch (error) {
        console.error('[Deposit] getUserBalance error:', error);
        return { success: false, message: 'Failed to fetch user balance', data: { balance: 0, balance_cents: 0 } };
    }
}

// ---------------------------------------------------------------------------
// Validate deposit amount
// ---------------------------------------------------------------------------

export async function validateDepositAmount(amount: number): Promise<{ valid: boolean; message: string }> {
    if (amount < 10 || amount > 70000) {
        return { valid: false, message: 'Amount must be between KES 10 and KES 70,000' };
    }
    return { valid: true, message: 'Amount is valid' };
}

/*
 * =============================================================================
 * FALLBACK: M-Pesa implementation (commented out — kept for quick rollback)
 * =============================================================================
 *
 * To revert to M-Pesa:
 *   1. Uncomment the functions below.
 *   2. In processMpesaDeposit, replace the CoopBankService call with initiateStkPush.
 *   3. In checkMpesaPaymentStatus, replace the CoopBankService call with queryStkPushStatus.
 *
 * const MPESA_CONFIG = {
 *   consumerKey: process.env.MPESA_CONSUMER_KEY!,
 *   consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
 *   shortCode: process.env.MPESA_SHORTCODE!,
 *   passkey: process.env.MPESA_PASSKEY!,
 *   callbackURL: process.env.MPESA_CALLBACK_URL!,
 *   environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
 * };
 *
 * async function getMpesaAccessToken(): Promise<string> { ... }
 * async function initiateMpesaSTKPush(amount, phone, ref, desc): Promise<...> { ... }
 * async function queryMpesaStatus(checkoutRequestId): Promise<...> { ... }
 *
 * =============================================================================
 */
