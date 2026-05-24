'use server'

import { auth } from '@/auth'
import {
  connectToDatabase,
  Profile,
  SpinWallet,
  Transaction,
  AdminAuditLog,
  MpesaTransaction,
} from '@/app/lib/models'
import { queryStkPushStatus, initiateStkPush } from '@/app/lib/mpesa'

// ─── Helper: extract checkoutRequestId from any M-Pesa response shape ──────
// Safaris returns inconsistent casing across environments. Check all variants.
function extractCheckoutId(response: any): string | undefined {
  return (
    response?.checkoutRequestID      ||   // your mpesa.ts wrapper (confirmed)
    response?.checkoutRequestId      ||   // camelCase
    response?.CheckoutRequestID      ||   // PascalCase
    response?.checkout_request_id    ||   // snake_case
    response?.data?.checkoutRequestID||   // nested variants
    response?.data?.CheckoutRequestID||
    response?.data?.checkoutRequestId||
    undefined
  )
}

function extractMerchantId(response: any): string | undefined {
  return (
    response?.merchantRequestID      ||   // your mpesa.ts wrapper (confirmed)
    response?.merchantRequestId      ||
    response?.MerchantRequestID      ||
    response?.merchant_request_id    ||
    response?.data?.merchantRequestID||
    response?.data?.MerchantRequestID||
    response?.data?.merchantRequestId||
    undefined
  )
}

export async function initiatSpinDeposit(phoneNumber: string, amount: number = 30) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const user = await (Profile as any).findById(session.user.id).lean()
    if (!user) {
      return { success: false, message: 'User not found' }
    }

    if (amount !== 30) {
      return { success: false, message: 'Spin deposits must be KES 30 only' }
    }

    // Get or create spin wallet
    let spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: session.user.id,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
      })
    }

    // Normalise phone number → 254XXXXXXXXX (12 digits)
    let clean = phoneNumber.replace(/\D/g, '')
    if (clean.startsWith('0'))   clean = clean.slice(1)       // 0712… → 712…
    if (clean.startsWith('254')) clean = clean.slice(3)       // 254712… → 712…
    if (clean.length < 9) {
      return { success: false, message: 'Invalid phone number format' }
    }
    const formattedPhone = `254${clean.slice(-9)}`

    console.log(`[SpinWallet] STK push → ${formattedPhone}, amount: KES ${amount}`)

    // ======================================================================
    // CRITICAL: We create an MpesaTransaction record FIRST with 'initiated'
    // status. This is the ONLY place we will create this transaction.
    // The M-Pesa callback will find this record and update it.
    // ======================================================================
    let mpesaTransaction = await (MpesaTransaction as any).create({
      user_id: session.user.id,
      amount_cents: amount * 100,
      phone_number: formattedPhone,
      source: 'spin_wallet',
      is_activation_payment: false,
      status: 'initiated',
      metadata: {
        deposit_type: 'spin_wallet',
        initiated_at: new Date().toISOString(),
      },
    })

    console.log(`[SpinWallet] MpesaTransaction created: ${mpesaTransaction._id}`)

    const stkResponse = await initiateStkPush({
      amount,
      phoneNumber: formattedPhone,
      accountReference: `SPIN_${session.user.id.slice(-8)}`,
      transactionDesc: `Spin Wallet Deposit - KES ${amount}`,
    })

    // ── Debug: log the full STK response so we can see exact field names ──
    console.log('[SpinWallet] Raw STK response:', JSON.stringify(stkResponse, null, 2))

    if (!stkResponse.success) {
      // Mark transaction as failed since STK push failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_code: 1,
        result_desc: 'Failed to initiate STK push'
      })
      return {
        success: false,
        message: stkResponse.message || 'Failed to initiate payment',
      }
    }

    const checkoutRequestId = extractCheckoutId(stkResponse)
    const merchantRequestId = extractMerchantId(stkResponse)

    // ── Guard: if we still can't find the ID something is very wrong ──────
    if (!checkoutRequestId) {
      console.error('[SpinWallet] Could not extract CheckoutRequestID from STK response:', stkResponse)
      // Mark transaction as failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_code: 11,
        result_desc: 'Could not extract CheckoutRequestID'
      })
      return {
        success: false,
        message: 'Payment initiated but tracking ID was missing. Please contact support if you were charged.',
      }
    }

    // ======================================================================
    // Update MpesaTransaction with checkout IDs - callback will use these
    // ======================================================================
    await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
    })

    // ======================================================================
    // IMPORTANT: We do NOT credit the SpinWallet balance here.
    // We ONLY create a 'pending' deposit record.
    // The M-Pesa callback is the ONLY place where balance gets credited.
    // ======================================================================
    spinWallet.deposits.push({
      amount_cents: amount * 100,
      mpesa_checkout_request_id: checkoutRequestId,
      mpesa_merchant_request_id: merchantRequestId,
      mpesa_transaction_id: mpesaTransaction._id,
      mpesa_status: 'initiated',
      overall_status: 'pending',
      status: 'pending',
      phone_number: formattedPhone,
      created_at: new Date(),
    })

    await spinWallet.save()

    console.log(`[SpinWallet] Deposit initiated — user: ${session.user.id}, checkoutRequestId: ${checkoutRequestId}`)

    return {
      success: true,
      checkoutRequestId,          // always present now
      merchantRequestId,
      message: 'M-Pesa prompt sent. Please complete the payment on your phone.',
    }
  } catch (error) {
    console.error('[SpinWallet] Error initiating spin deposit:', error)
    return {
      success: false,
      message: 'An error occurred while initiating payment',
    }
  }
}

export async function checkSpinDepositStatus(checkoutRequestId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    if (!checkoutRequestId) {
      return { success: false, message: 'Missing checkoutRequestId' }
    }

    await connectToDatabase()

    const spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
    if (!spinWallet) {
      return { success: false, message: 'Spin wallet not found' }
    }

    const deposit = spinWallet.deposits.find(
      (d: any) => d.mpesa_checkout_request_id === checkoutRequestId
    )

    if (!deposit) {
      return { success: false, message: 'Deposit record not found' }
    }

    // Already completed — return immediately, skip M-Pesa query
    if (deposit.status === 'completed') {
      return {
        success: true,
        status: 'completed',
        message: 'Payment already confirmed.',
        balance: spinWallet.balance_cents,
      }
    }

    // ========================================================================
    // 🔒 IDEMPOTENCY CHECK: Check if M-Pesa callback has already processed this
    // The callback sets metadata.callback_processed = true when it updates status.
    // If already processed, just return the status - no polling, no writes.
    // ========================================================================
    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: checkoutRequestId
    })

    if (mpesaTransaction?.metadata?.callback_processed === true) {
      // Callback already processed - read the status from MpesaTransaction and sync to UI
      // But do NOT write to database in this function
      return {
        success: mpesaTransaction.status === 'completed',
        status: mpesaTransaction.status,
        message: mpesaTransaction.status === 'completed'
          ? `Deposit successful! KES ${deposit.amount_cents / 100} added to your spin wallet.`
          : `Payment ${mpesaTransaction.status}.`,
        balance: spinWallet.balance_cents,
      }
    }

    // ========================================================================
    // Callback hasn't processed yet — query M-Pesa API for status
    // NOTE: We only READ status here. We do NOT update SpinWallet or
    // MpesaTransaction. The M-Pesa callback is the ONLY source of truth for updating.
    // ========================================================================
    const queryResult = await queryStkPushStatus(checkoutRequestId)
    console.log(`[SpinWallet] STK status for ${checkoutRequestId}:`, queryResult)

    // Query M-Pesa API for status, but DO NOT write to any database
    // The callback is the sole writer — polling is read-only
    if (queryResult.success && queryResult.status === 'completed') {
      // Payment completed according to M-Pesa, but callback hasn't processed yet
      // Return 'processing' to UI — the callback will credit and complete
      return {
        success: true,
        status: 'processing',
        message: 'Payment received! Processing your deposit...',
        balance: spinWallet.balance_cents,
      }
    } else if (queryResult.status === 'pending') {
      return {
        success: true,
        status: 'pending',
        message: 'Payment still processing…',
        balance: spinWallet.balance_cents,
      }
    } else {
      // Handle failed, cancelled, or timeout statuses
      return {
        success: false,
        status: queryResult.status || 'failed',
        message: queryResult.resultDesc || 'Payment failed or was cancelled.',
        balance: spinWallet.balance_cents,
      }
    }
  } catch (error) {
    console.error('[SpinWallet] Error checking deposit status:', error)
    return {
      success: false,
      message: 'An error occurred while checking payment status',
    }
  }
}

export async function getSpinWalletBalance() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    let spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id }).lean()

    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: session.user.id,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
      })
    }

    return {
      success: true,
      balance_cents: spinWallet.balance_cents,
      balance_kes: (spinWallet.balance_cents / 100).toFixed(2),
      total_deposited: spinWallet.total_deposited_cents,
      total_used: spinWallet.total_used_cents,
      total_spins: spinWallet.total_spins,
    }
  } catch (error) {
    console.error('[SpinWallet] Error getting balance:', error)
    return { success: false, message: 'An error occurred' }
  }
}

export async function getSpinWalletHistory(limit: number = 20) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    // Sort in MongoDB query instead of JS
    const spinWallet = await (SpinWallet as any)
      .findOne({ user_id: session.user.id })
      .lean()

    if (!spinWallet) {
      return { success: true, deposits: [] }
    }

    const deposits = [...spinWallet.deposits]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map((d: any) => ({
        amount_kes: (d.amount_cents / 100).toFixed(2),
        // Use overall_status if available (from callback), fallback to status for backward compatibility
        status: d.overall_status || d.status,
        date: d.created_at,
        receipt: d.mpesa_receipt_number,
      }))

    return { success: true, deposits }
  } catch (error) {
    console.error('[SpinWallet] Error getting history:', error)
    return { success: false, message: 'An error occurred' }
  }
}

export async function transferMainToSpinWallet(amountKes: number) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    if (amountKes <= 0) {
      return { success: false, message: 'Amount must be greater than zero' }
    }

    const MIN_TRANSFER = 30
    const MAX_TRANSFER = 70000
    if (amountKes < MIN_TRANSFER || amountKes > MAX_TRANSFER) {
      return { success: false, message: `Transfer amount must be between KES ${MIN_TRANSFER} and KES ${MAX_TRANSFER}` }
    }

    await connectToDatabase()

    // Get user's main wallet balance
    const user = await (Profile as any).findById(session.user.id).lean()
    if (!user) {
      return { success: false, message: 'User not found' }
    }

    const amountCents = Math.round(amountKes * 100)
    if ((user as any).balance_cents < amountCents) {
      return {
        success: false,
        message: `Insufficient main wallet balance. You have KES ${((user as any).balance_cents / 100).toFixed(2)} but need KES ${amountKes.toFixed(2)}`,
      }
    }

    // Get or create spin wallet
    let spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: session.user.id,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
      })
    }

    // Deduct from main wallet
    await (Profile as any).findByIdAndUpdate(session.user.id, {
      $inc: { balance_cents: -amountCents },
    })

    // Add to spin wallet
    spinWallet.balance_cents += amountCents
    spinWallet.total_deposited_cents += amountCents
    spinWallet.deposits.push({
      amount_cents: amountCents,
      status: 'completed',
      mpesa_status: 'main_wallet_transfer',
      deposited_at: new Date(),
      created_at: new Date(),
    })
    await spinWallet.save()

    // Create transaction record
    await (Transaction as any).create({
      user_id: session.user.id,
      type: 'SPIN_DEPOSIT',
      amount_cents: amountCents,
      status: 'completed',
      source: 'main_wallet_transfer',
      description: `Transfer to spin wallet - KES ${amountKes.toFixed(2)}`,
      metadata: {
        transfer_type: 'main_to_spin',
      },
    })

    console.log(`[SpinWallet] Transfer completed — user: ${session.user.id}, amount: KES ${amountKes}`)

    return {
      success: true,
      message: `Successfully transferred KES ${amountKes.toFixed(2)} to your spin wallet`,
      spin_balance: spinWallet.balance_cents,
      main_balance: (user as any).balance_cents - amountCents,
    }
  } catch (error) {
    console.error('[SpinWallet] Error transferring to spin wallet:', error)
    return { success: false, message: 'An error occurred during transfer' }
  }
}

export async function adminAddSpinBalance(userId: string, amountKes: number, reason: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    if (amountKes <= 0) {
      return { success: false, message: 'Amount must be greater than zero' }
    }

    await connectToDatabase()

    const admin = await (Profile as any).findById(session.user.id).lean()
    if ((admin as any)?.role !== 'admin') {
      return { success: false, message: 'Admin access required' }
    }

    let spinWallet = await (SpinWallet as any).findOne({ user_id: userId })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: userId,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
      })
    }

    const amountCents = amountKes * 100
    spinWallet.balance_cents += amountCents
    spinWallet.total_deposited_cents += amountCents
    spinWallet.deposits.push({
      amount_cents: amountCents,
      status: 'completed',
      mpesa_status: 'admin_credit',
      deposited_at: new Date(),
      created_at: new Date(),
    })

    await spinWallet.save()

    await (AdminAuditLog as any).create({
      admin_id: session.user.id,
      action: 'SPIN_WALLET_ADD',
      resource_type: 'spin_wallet',
      target_user_id: userId,
      changes: { amount_kes: amountKes, reason },
      ip_address: '',
    })

    return {
      success: true,
      message: `Added KES ${amountKes} to user's spin wallet`,
      new_balance: spinWallet.balance_cents,
    }
  } catch (error) {
    console.error('[SpinWallet] Error adding admin balance:', error)
    return { success: false, message: 'An error occurred' }
  }
}
