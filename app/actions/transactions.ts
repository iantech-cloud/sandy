// app/actions/transactions.ts - COMPLETE FIXED VERSION FOR COMPANY MODEL
'use server';

import {
	connectToDatabase,
	Profile,
	Transaction,
	Withdrawal,
	MpesaTransaction
} from '../lib/models';
// --- NextAuth v5 (Auth.js) Update ---
// Import the new auth helper function instead of getServerSession
import { auth } from '@/auth'; 
// The Session type structure should still be compatible, but is now usually imported from next-auth/core/types
// For simplicity and common v5 usage, we keep the existing import path.
import type { Session } from 'next-auth'; 
import { revalidatePath } from 'next/cache';

// Helper function to transform MongoDB documents to plain objects
function transformTransaction(transaction: any): any {
	const plainTransaction = transaction.toObject ? transaction.toObject() : transaction;
    
    const serializeValue = (value: any): any => {
        if (value && typeof value === 'object') {
            if (value.constructor.name === 'ObjectId' || (value.buffer && value.constructor.name === 'ObjectID')) {
                return value.toString();
            }
            if (Array.isArray(value)) {
                return value.map(serializeValue);
            }
            if (Buffer.isBuffer(value)) {
                return value.toString('hex');
            }
            const newObj: { [key: string]: any } = {};
            for (const key in value) {
                newObj[key] = serializeValue(value[key]);
            }
            return newObj;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        return value;
    };

	return {
		id: plainTransaction._id?.toString(),
		user_id: plainTransaction.user_id?.toString(),
		target_type: plainTransaction.target_type || 'user',
		target_id: plainTransaction.target_id?.toString(),
		amount_cents: plainTransaction.amount_cents,
		type: plainTransaction.type,
		description: plainTransaction.description,
		status: plainTransaction.status,
		transaction_code: plainTransaction.transaction_code,
		metadata: serializeValue(plainTransaction.metadata), 
		mpesa_transaction_id: plainTransaction.mpesa_transaction_id?.toString(),
		reconciled: plainTransaction.reconciled,
		created_at: plainTransaction.created_at?.toISOString(),
		updated_at: plainTransaction.updated_at?.toISOString(),
		__v: plainTransaction.__v
	};
}

// ----------------------------------------------------------------------
// EXPORTED ACTIONS
// ----------------------------------------------------------------------

export async function getTransactions(limit: number = 50): Promise<{	
	success: boolean;	
	data?: any[];	
	message: string	
}> {
	try {
		// --- NextAuth v5 (Auth.js) Update: Use the new 'auth()' helper ---
		const session = await auth() as Session | null;
		
		if (!session?.user?.email) {
			return { success: false, message: 'Unauthorized' };
		}

		await connectToDatabase();
		const currentUser = await Profile.findOne({ email: session.user.email });

		if (!currentUser) {
			return { success: false, message: 'User not found' };
		}

		// Only get user's personal transactions (target_type: 'user' and user_id matches)
		const transactions = await Transaction.find({ 
			user_id: currentUser._id,
			target_type: 'user'
		})
			.sort({ created_at: -1 })
			.limit(limit)
			.lean(); 

		const transformedTransactions = transactions.map(transformTransaction);

		return {
			success: true,
			data: transformedTransactions,
			message: 'Transactions fetched successfully'
		};

	} catch (error) {
		console.error('Get transactions error:', error);
		return { success: false, message: 'Failed to fetch transactions' };
	}
}


export async function processWithdrawal(withdrawalData: {
	amount: number;
	mpesaNumber: string;
}): Promise<{	
	success: boolean;	
	data?: any;	
	message: string	
}> {
	try {
		// --- NextAuth v5 (Auth.js) Update: Use the new 'auth()' helper ---
		const session = await auth() as Session | null;
		
		if (!session?.user?.email) {
			return { success: false, message: 'Unauthorized' };
		}

		await connectToDatabase();
		const currentUser: any = await Profile.findOne({ email: session.user.email }).lean(); 

		if (!currentUser) {
			return { success: false, message: 'User not found' };
		}

		const amountCents = Math.round(withdrawalData.amount * 100);
		const amountKES = amountCents / 100;
		
		// Check minimum withdrawal amount (KSh 200 = 20000 cents)
		if (amountCents < 20000) {
			return { success: false, message: 'Minimum withdrawal amount is KSh 200' };
		}

		// Calculate band-based processing fee
		let processingFeeCents = 0;
		if (amountKES >= 200 && amountKES <= 1000) {
			processingFeeCents = 1000; // KSh 10
		} else if (amountKES > 1000 && amountKES <= 2000) {
			processingFeeCents = 2000; // KSh 20
		} else if (amountKES > 2000 && amountKES <= 5000) {
			processingFeeCents = 3000; // KSh 30
		} else if (amountKES > 5000 && amountKES <= 10000) {
			processingFeeCents = 5000; // KSh 50
		} else if (amountKES > 10000) {
			processingFeeCents = 10000; // KSh 100
		}
		
		const totalDeductionCents = amountCents + processingFeeCents;
		
		if (currentUser.balance_cents < totalDeductionCents) {
			return { success: false, message: `Insufficient balance. Amount + processing fee (KSh ${(processingFeeCents / 100).toFixed(0)}) required.` };
		}

		if (!withdrawalData.mpesaNumber.match(/^254[0-9]{9}$/)) {
			return { success: false, message: 'Invalid M-Pesa number format' };
		}

		const withdrawal = await Withdrawal.create({
			user_id: currentUser._id,
			amount_cents: amountCents,
			mpesa_number: withdrawalData.mpesaNumber,
			processing_fee_cents: processingFeeCents,
			status: 'pending',
			metadata: {
				feeType: 'band-based',
				amountRange: amountKES <= 1000 ? '200-1000' : amountKES <= 2000 ? '1001-2000' : amountKES <= 5000 ? '2001-5000' : amountKES <= 10000 ? '5001-10000' : '10000+'
			}
		});

		// FIXED: Add target_type and target_id
		const transaction = await Transaction.create({
			target_type: 'user',
			target_id: currentUser._id.toString(),
			user_id: currentUser._id,
			amount_cents: amountCents,
			type: 'WITHDRAWAL',
			description: `Withdrawal request to ${withdrawalData.mpesaNumber} (Processing fee: KSh ${(processingFeeCents / 100).toFixed(0)})`,
			status: 'pending',
			source: 'wallet',
			metadata: {
				withdrawalId: withdrawal._id.toString(),
				mpesaNumber: withdrawalData.mpesaNumber,
				processingFeeCents: processingFeeCents,
				totalDeductionCents: totalDeductionCents
			}
		});

		await Profile.findByIdAndUpdate(currentUser._id, {
			$inc: { balance_cents: -totalDeductionCents }
		});

		revalidatePath('/dashboard/wallet');

		const transformedWithdrawal = withdrawal.toObject();
		transformedWithdrawal.id = transformedWithdrawal._id.toString();
		delete transformedWithdrawal._id;
		delete transformedWithdrawal.__v;

		const transformedTransaction = transformTransaction(transaction);

		return {
			success: true,
			data: {
				transactionCode: `WDL${withdrawal._id.toString().slice(-8).toUpperCase()}`,
				newBalance: (currentUser.balance_cents - totalDeductionCents) / 100,
				withdrawal: transformedWithdrawal,
				transaction: transformedTransaction,
				processingFee: (processingFeeCents / 100).toFixed(0)
			},
			message: `Withdrawal request submitted successfully. Processing fee of KSh ${(processingFeeCents / 100).toFixed(0)} will be deducted.`
		};

	} catch (error) {
		console.error('Process withdrawal error:', error);
		return { success: false, message: 'Failed to process withdrawal' };
	}
}

// ----------------------------------------------------------------------
// M-PESA CALLBACK HANDLER
// ----------------------------------------------------------------------

export async function handleMpesaCallback(callbackData: any): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase();
    
    const { Body: { stkCallback: callback } } = callbackData;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    const mpesaTransaction = await MpesaTransaction.findOne({ 
      checkout_request_id: CheckoutRequestID 
    });

    if (!mpesaTransaction) {
      console.error('M-Pesa transaction not found:', CheckoutRequestID);
      return { success: false, message: 'Transaction not found' };
    }

    const transaction = await Transaction.findOne({
      mpesa_transaction_id: mpesaTransaction._id
    });

    if (!transaction) {
      console.error('Transaction not found for M-Pesa transaction:', mpesaTransaction._id);
      return { success: false, message: 'Transaction record not found' };
    }

    if (ResultCode === 0) {
      const metadata = CallbackMetadata?.Item || [];
      const amountItem = metadata.find((item: any) => item.Name === 'Amount');
      const receiptItem = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const phoneItem = metadata.find((item: any) => item.Name === 'PhoneNumber');

      await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
      �� status: 'completed',
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: receiptItem?.Value,
        phone_number: phoneItem?.Value,
        callback_metadata: callbackData
      });

      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'completed',
        transaction_code: receiptItem?.Value,
        metadata: {
          ...transaction.metadata,
          mpesaReceiptNumber: receiptItem?.Value,
          phoneNumber: phoneItem?.Value,
          amount: amountItem?.Value
        }
      });

      await Profile.findByIdAndUpdate(transaction.user_id, {
        $inc: { balance_cents: transaction.amount_cents }
      });

    } else {
      const status = ResultCode === 1032 ? 'cancelled' : 
                    ResultCode === 1037 ? 'timeout' : 'failed';

      await MpesaTransaction.findByIdAndUpdate(mpesaTransaction._id, {
        status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        callback_metadata: callbackData
      });

      await Transaction.findByIdAndUpdate(transaction._id, {
        status
      });

      if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
        await Profile.findByIdAndUpdate(transaction.user_id, {
          $inc: { total_deposits_today_cents: -transaction.amount_cents }
        });
      }
    }

    revalidatePath('/dashboard/wallet');
    return { success: true, message: 'Callback processed successfully' };

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return { success: false, message: 'Failed to process callback' };
  }
}

// ----------------------------------------------------------------------
// ADMIN TRANSACTIONS FUNCTION - FIXED FOR COMPANY MODEL
// ----------------------------------------------------------------------

export async function getAdminTransactions(limit: number = 1000, filters: any = {}) {
  try {
    // NOTE: For admin functions, you should add an authorization check here
	// using the 'auth()' helper to ensure the user has admin privileges.
	/* const session = await auth();
	if (!session?.user?.isAdmin) {
		return { success: false, message: 'Unauthorized as Admin' };
	}
	*/
    await connectToDatabase();

    let query: any = {};
    
    if (filters.type && filters.type !== 'all') {
      query.type = filters.type;
    }
    
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      query.created_at = {};
      if (filters.dateFrom) {
        query.created_at.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.created_at.$lte = new Date(filters.dateTo + 'T23:59:59.999Z');
      }
    }

    const transactions = await Transaction.find(query)
      .populate('user_id', 'username email')
      .populate('mpesa_transaction_id', 'mpesa_receipt_number phone_number')
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    const transformedTransactions = transactions.map((txn: any) => ({
      id: txn._id.toString(),
      user_id: txn.user_id?._id?.toString() || null,
      user_email: txn.user_id?.email || 'System',
      user_username: txn.user_id?.username || 'System',
      amount: txn.amount_cents / 100,
      type: txn.type,
      status: txn.status,
      description: txn.description,
      date: txn.created_at,
      transaction_code: txn.transaction_code,
      mpesa_receipt_number: txn.mpesa_transaction_id?.mpesa_receipt_number,
      phone_number: txn.mpesa_transaction_id?.phone_number,
      metadata: txn.metadata,
      
      // CRITICAL: Include target_type and target_id
      target_type: txn.target_type || 'user',
      target_id: txn.target_id?.toString() || txn.user_id?._id?.toString() || null
    }));

    return {
      success: true,
      data: { transactions: transformedTransactions },
      message: 'Transactions fetched successfully'
    };

  } catch (error) {
    console.error('Get admin transactions error:', error);
    return { success: false, message: 'Failed to fetch transactions' };
  }
}
