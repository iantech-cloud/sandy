'use server'

import { auth } from '@/auth'
import {
  connectToDatabase,
  Profile,
  SpinWallet,
  Transaction,
  AdminAuditLog,
} from '../lib/models'
import { queryStkPushStatus } from '@/app/lib/mpesa'

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

    // Initiate M-Pesa STK push
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('254') ? cleanPhone : `254${cleanPhone.slice(-9)}`

    const stkResponse = await initiateSTKPush(formattedPhone, amount * 100)

    if (!stkResponse.success) {
      return {
        success: false,
        message: stkResponse.message || 'Failed to initiate payment',
      }
    }

    // Add deposit record
    spinWallet.deposits.push({
      amount_cents: amount * 100,
      mpesa_checkout_request_id: stkResponse.CheckoutRequestID,
      mpesa_merchant_request_id: stkResponse.MerchantRequestID,
      mpesa_status: 'initiated',
      status: 'pending',
      phone_number: formattedPhone,
      created_at: new Date(),
    })

    await spinWallet.save()

    console.log(`[v0] Spin deposit initiated for user ${session.user.id}, amount: KES ${amount}`)

    return {
      success: true,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      message: 'M-Pesa prompt sent. Please complete the payment on your phone.',
    }
  } catch (error) {
    console.error('[v0] Error initiating spin deposit:', error)
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

    // Query M-Pesa
    const status = await queryStkPushStatus(checkoutRequestId)

    if (status.success && status.status === 'completed') {
      // Update deposit
      deposit.mpesa_status = 'completed'
      deposit.status = 'completed'
      deposit.mpesa_receipt_number = status.mpesaReceiptNumber
      deposit.deposited_at = new Date()

      // Update wallet balance
      spinWallet.balance_cents += deposit.amount_cents
      spinWallet.total_deposited_cents += deposit.amount_cents

      await spinWallet.save()

      // Log transaction
      await (Transaction as any).create({
        user_id: session.user.id,
        type: 'SPIN_DEPOSIT',
        amount_cents: deposit.amount_cents,
        status: 'completed',
        source: 'mpesa',
        description: `Spin wallet deposit - KES ${deposit.amount_cents / 100}`,
        metadata: {
          mpesa_receipt: status.mpesaReceiptNumber,
          checkout_request_id: checkoutRequestId,
        },
      })

      console.log(`[v0] Spin deposit completed for user ${session.user.id}`)

      return {
        success: true,
        message: `Deposit successful! KES ${deposit.amount_cents / 100} added to your spin wallet.`,
        balance: spinWallet.balance_cents,
      }
    } else if (status.status === 'pending') {
      return {
        success: true,
        message: 'Payment still processing. Please wait...',
        status: 'pending',
        balance: spinWallet.balance_cents,
      }
    } else {
      deposit.mpesa_status = status.status || 'failed'
      deposit.status = 'failed'
      await spinWallet.save()

      return {
        success: false,
        message: 'Payment failed or was cancelled',
        balance: spinWallet.balance_cents,
      }
    }
  } catch (error) {
    console.error('[v0] Error checking deposit status:', error)
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
      // Create if doesn't exist
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
    console.error('[v0] Error getting spin wallet balance:', error)
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

    const spinWallet = await (SpinWallet as any).findOne({ user_id: session.user.id }).lean()
    if (!spinWallet) {
      return { success: true, deposits: [], message: 'No deposit history' }
    }

    const deposits = spinWallet.deposits
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)

    return {
      success: true,
      deposits: deposits.map((d: any) => ({
        amount_kes: (d.amount_cents / 100).toFixed(2),
        status: d.status,
        date: d.created_at,
        receipt: d.mpesa_receipt_number,
      })),
    }
  } catch (error) {
    console.error('[v0] Error getting spin wallet history:', error)
    return { success: false, message: 'An error occurred' }
  }
}

// Admin function to manually add spin wallet balance (for testing/support)
export async function adminAddSpinBalance(userId: string, amountKes: number, reason: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const admin = await (Profile as any).findById(session.user.id).lean()
    if (admin?.role !== 'admin') {
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
      mpesa_status: 'completed',
      deposited_at: new Date(),
      created_at: new Date(),
    })

    await spinWallet.save()

    // Log audit
    await (AdminAuditLog as any).create({
      admin_id: session.user.id,
      action: 'SPIN_WALLET_ADD',
      resource_type: 'spin_wallet',
      target_user_id: userId,
      changes: {
        amount_kes: amountKes,
        reason,
      },
      ip_address: '',
    })

    console.log(`[v0] Admin added KES ${amountKes} to spin wallet for user ${userId}`)

    return {
      success: true,
      message: `Added KES ${amountKes} to user's spin wallet`,
      new_balance: spinWallet.balance_cents,
    }
  } catch (error) {
    console.error('[v0] Error adding spin balance:', error)
    return { success: false, message: 'An error occurred' }
  }
}

// Helper function to initiate STK push (from mpesa.ts)
async function initiateSTKPush(phoneNumber: string, amountCents: number) {
  try {
    // This would use the M-Pesa library similar to activation.ts
    // For now, returning a mock response format
    console.log('[v0] Initiating STK push for spin deposit')

    // TODO: Implement actual M-Pesa STK push using the same pattern as activation.ts
    return {
      success: true,
      CheckoutRequestID: `SPIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      MerchantRequestID: `SPIN_MERCHANT_${Date.now()}`,
      ResponseCode: '0',
      ResponseDescription: 'Success',
    }
  } catch (error) {
    console.error('[v0] Error initiating STK push:', error)
    return {
      success: false,
      message: 'Failed to initiate M-Pesa payment',
    }
  }
}
