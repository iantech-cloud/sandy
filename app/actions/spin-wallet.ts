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
import { createCoopBankService, CoopBankService } from '@/app/lib/services/coop-bank'

// ---------------------------------------------------------------------------
// initiatSpinDeposit
// ---------------------------------------------------------------------------
// IMPORTANT ACCOUNTING RULE:
//   When a user pays KES 30 to spin via Co-op Bank deposit:
//   1. The payment is recorded in MpesaTransaction with deposit_type='spin_wallet'
//   2. Callback credits the amount to SpinWallet.balance_cents (user's spendable balance)
//   3. NO company revenue is recorded on deposit
//   4. When user actually spins, balance_cents is deducted AND company revenue (SPIN_COST) is recorded
//
//   The SpinWallet.balance_cents field now holds deposited amounts that the user
//   can spend on spins. Company revenue is only recorded when spins are performed.
// ---------------------------------------------------------------------------

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
        spin_credits: 0,
      })
    }

    // Normalise phone → 254XXXXXXXXX
    const formattedPhone = CoopBankService.normalisePhone(phoneNumber)
    if (!formattedPhone || formattedPhone.length < 12) {
      return { success: false, message: 'Invalid phone number format' }
    }

    // Unique message reference used as the idempotency key in the callback
    const messageReference = `SPIN${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`

    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`

    // ======================================================================
    // Create MpesaTransaction FIRST so the callback can always find it.
    // deposit_type = 'spin_wallet' tells the callback to credit user's
    // spin wallet balance (balance_cents). Company revenue is recorded
    // only when the user actually spins.
    // ======================================================================
    const mpesaTransaction = await (MpesaTransaction as any).create({
      user_id: session.user.id,
      amount_cents: amount * 100,
      phone_number: formattedPhone,
      source: 'spin_wallet',
      is_activation_payment: false,
      status: 'initiated',
      checkout_request_id: messageReference,
      metadata: {
        deposit_type: 'spin_wallet',
        payment_method: 'coop_bank_stk_push',
        initiated_at: new Date().toISOString(),
        callback_url: callbackUrl,
        // Money credits user's spin wallet; company revenue recorded on spin
        revenue_target: 'user_spin_wallet',
      },
    })

    // Record the pending deposit in the SpinWallet history (for transparency)
    spinWallet.deposits.push({
      amount_cents: amount * 100,
      mpesa_checkout_request_id: messageReference,
      mpesa_transaction_id: mpesaTransaction._id,
      mpesa_status: 'initiated',
      overall_status: 'pending',
      status: 'pending',
      phone_number: formattedPhone,
      created_at: new Date(),
    })
    await spinWallet.save()

    // Initiate Co-op Bank STK Push
    const coopBank = createCoopBankService()
    const stkResponse = await coopBank.initiateSTKPush(
      formattedPhone,
      amount,
      `Spin - KES ${amount}`,
      callbackUrl,
      messageReference
    )

    if (stkResponse.ResponseCode !== '0') {
      // Mark as failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: stkResponse.ResponseDescription || 'STK Push rejected',
      })

      // Mark embedded deposit as failed
      const wallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
      if (wallet) {
        const dep = wallet.deposits.find(
          (d: any) => d.mpesa_checkout_request_id === messageReference
        )
        if (dep) {
          dep.status = 'failed'
          dep.overall_status = 'failed'
          dep.mpesa_status = 'failed'
          await wallet.save()
        }
      }

      return {
        success: false,
        message: stkResponse.ResponseDescription || 'Failed to initiate payment',
      }
    }

    return {
      success: true,
      messageReference,
      message: 'Co-op Bank payment prompt sent. Please complete the payment on your phone.',
    }
  } catch (error) {
    console.error('[SpinWallet] Error initiating spin deposit:', error)
    return {
      success: false,
      message: 'An error occurred while initiating payment',
    }
  }
}

// ---------------------------------------------------------------------------
// checkSpinDepositStatus
// ---------------------------------------------------------------------------

export async function checkSpinDepositStatus(messageReference: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    if (!messageReference) {
      return { success: false, message: 'Missing messageReference' }
    }

    await connectToDatabase()

    const spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
    if (!spinWallet) {
      return { success: false, message: 'Spin wallet not found' }
    }

    const deposit = spinWallet.deposits.find(
      (d: any) => d.mpesa_checkout_request_id === messageReference
    )

    if (!deposit) {
      return { success: false, message: 'Deposit record not found' }
    }

    // Already completed — return immediately
    if (deposit.status === 'completed') {
      return {
        success: true,
        status: 'completed',
        message: 'Payment confirmed. Your spin credit has been added.',
        spin_credits: spinWallet.spin_credits || 0,
      }
    }

    // Check if the callback has already processed this transaction
    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: messageReference,
    })

    if (mpesaTransaction?.metadata?.callback_processed === true) {
      return {
        success: mpesaTransaction.status === 'completed',
        status: mpesaTransaction.status,
        message:
          mpesaTransaction.status === 'completed'
            ? 'Payment confirmed. Your spin credit has been added.'
            : `Payment ${mpesaTransaction.status}.`,
        spin_credits: spinWallet.spin_credits || 0,
      }
    }

    // Callback not received yet — query Co-op Bank API
    const coopBank = createCoopBankService()
    const statusResponse = await coopBank.getTransactionStatus(messageReference)
    const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode)

    console.log('[SpinWallet] Payment status check:', {
      messageReference,
      responseCode: statusResponse.ResponseCode,
      mappedStatus,
      description: statusResponse.ResponseDescription,
    });

    if (mappedStatus === 'completed') {
      console.log('[SpinWallet] ✅ Payment completed - processing spin credit');
      return {
        success: true,
        status: 'processing',
        message: 'Payment received! Processing your spin credit...',
        spin_credits: spinWallet.spin_credits || 0,
      }
    }

    if (mappedStatus === 'pending') {
      console.log('[SpinWallet] ⏳ Payment still pending - continue polling');
      return {
        success: true,
        status: 'pending',
        message: 'Payment still processing...',
        spin_credits: spinWallet.spin_credits || 0,
      }
    }

    console.log('[SpinWallet] ❌ Payment failed with status:', mappedStatus);
    return {
      success: false,
      status: mappedStatus,
      message: statusResponse.ResponseDescription || 'Payment failed or was cancelled.',
      spin_credits: spinWallet.spin_credits || 0,
    }
  } catch (error) {
    console.error('[SpinWallet] Error checking deposit status:', error)
    return {
      success: false,
      message: 'An error occurred while checking payment status',
    }
  }
}

// ---------------------------------------------------------------------------
// getSpinWalletBalance
// ---------------------------------------------------------------------------

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
        spin_credits: 0,
      })
    }

    return {
      success: true,
      // balance_cents = winnings/prizes owed to user
      balance_cents: spinWallet.balance_cents,
      balance_kes: (spinWallet.balance_cents / 100).toFixed(2),
      // spin_credits = number of spins the user has purchased but not yet used
      spin_credits: spinWallet.spin_credits || 0,
      total_deposited: spinWallet.total_deposited_cents,
      total_used: spinWallet.total_used_cents,
      total_spins: spinWallet.total_spins,
    }
  } catch (error) {
    console.error('[SpinWallet] Error getting balance:', error)
    return { success: false, message: 'An error occurred' }
  }
}

// ---------------------------------------------------------------------------
// getSpinWalletHistory
// ---------------------------------------------------------------------------

export async function getSpinWalletHistory(limit: number = 20) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id }).lean()

    if (!spinWallet) {
      return { success: true, deposits: [] }
    }

    const deposits = [...(spinWallet.deposits as any[])]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, limit)
      .map((d) => ({
        amount_kes: (d.amount_cents / 100).toFixed(2),
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

// ---------------------------------------------------------------------------
// transferMainToSpinWallet
// ---------------------------------------------------------------------------
// Transfer from user's main wallet to spin wallet balance (internal — no payment).
// The KES is moved from Profile.balance_cents to SpinWallet.balance_cents.
// Company revenue (SPIN_COST) is recorded when the user actually spins.
// ---------------------------------------------------------------------------

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
      return {
        success: false,
        message: `Transfer amount must be between KES ${MIN_TRANSFER} and KES ${MAX_TRANSFER}`,
      }
    }

    // Spin must be paid in multiples of 30
    if (amountKes % 30 !== 0) {
      return { success: false, message: 'Transfer amount must be a multiple of KES 30' }
    }

    await connectToDatabase()

    const user = await (Profile as any).findById(session.user.id).lean()
    if (!user) {
      return { success: false, message: 'User not found' }
    }

    const amountCents = Math.round(amountKes * 100)
    if ((user as any).balance_cents < amountCents) {
      return {
        success: false,
        message: `Insufficient main wallet balance. You have KES ${(
          (user as any).balance_cents / 100
        ).toFixed(2)} but need KES ${amountKes.toFixed(2)}`,
      }
    }

    const spinCreditsToAdd = Math.floor(amountKes / 30)

    // Get or create spin wallet
    let spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: session.user.id,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
        spin_credits: 0,
      })
    }

    // Deduct from user's main wallet
    await (Profile as any).findByIdAndUpdate(session.user.id, {
      $inc: { balance_cents: -amountCents },
    })

    // Add to spin wallet balance (will be used for spins)
    spinWallet.balance_cents = (spinWallet.balance_cents || 0) + amountCents
    spinWallet.total_deposited_cents += amountCents
    spinWallet.deposits.push({
      amount_cents: amountCents,
      status: 'completed',
      mpesa_status: 'main_wallet_transfer',
      overall_status: 'completed',
      deposited_at: new Date(),
      created_at: new Date(),
    })
    await spinWallet.save()

    // NO company revenue recorded here - only when user spins
    // Record the transfer for audit trail
    await (Transaction as any).create({
      user_id: session.user.id,
      target_type: 'spin_wallet',
      type: 'TRANSFER',
      amount_cents: amountCents,
      status: 'completed',
      source: 'main_wallet_transfer',
      description: `Transferred KES ${amountKes.toFixed(2)} to spin wallet`,
      metadata: {
        transfer_type: 'main_to_spin',
        source_balance: 'main_wallet',
        destination_balance: 'spin_wallet',
      },
    })

    return {
      success: true,
      message: `Successfully transferred KES ${amountKes.toFixed(2)} — ${spinCreditsToAdd} spin credit(s) added`,
      spin_credits: spinWallet.spin_credits,
      main_balance: (user as any).balance_cents - amountCents,
    }
  } catch (error) {
    console.error('[SpinWallet] Error transferring to spin wallet:', error)
    return { success: false, message: 'An error occurred during transfer' }
  }
}

// ---------------------------------------------------------------------------
// adminAddSpinBalance (admin credits user with spin credits — no payment)
// ---------------------------------------------------------------------------

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

    // Must be a multiple of 30
    if (amountKes % 30 !== 0) {
      return { success: false, message: 'Amount must be a multiple of KES 30' }
    }

    const spinCreditsToAdd = Math.floor(amountKes / 30)

    let spinWallet = await (SpinWallet as any).findOne({ user_id: userId })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: userId,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
        spin_credits: 0,
      })
    }

    spinWallet.spin_credits = (spinWallet.spin_credits || 0) + spinCreditsToAdd
    spinWallet.deposits.push({
      amount_cents: amountKes * 100,
      status: 'completed',
      mpesa_status: 'admin_credit',
      overall_status: 'completed',
      deposited_at: new Date(),
      created_at: new Date(),
    })
    await spinWallet.save()

    await (AdminAuditLog as any).create({
      admin_id: session.user.id,
      action: 'SPIN_WALLET_ADD',
      resource_type: 'spin_wallet',
      target_user_id: userId,
      changes: { amount_kes: amountKes, spin_credits_added: spinCreditsToAdd, reason },
      ip_address: '',
    })

    return {
      success: true,
      message: `Added ${spinCreditsToAdd} spin credit(s) to user's wallet`,
      spin_credits: spinWallet.spin_credits,
    }
  } catch (error) {
    console.error('[SpinWallet] Error adding admin balance:', error)
    return { success: false, message: 'An error occurred' }
  }
}

/*
 * =============================================================================
 * FALLBACK: M-Pesa spin deposit (commented out — kept for quick rollback)
 * =============================================================================
 *
 * To revert to M-Pesa, uncomment and replace the CoopBankService calls above
 * with initiateStkPush / queryStkPushStatus from '@/app/lib/mpesa'.
 *
 * =============================================================================
 */
