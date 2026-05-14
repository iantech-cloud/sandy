import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { depositSpinWalletViaMpesa } from '@/app/actions/spin'

/**
 * Unified spin-wallet deposit endpoint.
 *
 * Routes to the canonical `depositSpinWalletViaMpesa` action which:
 *   - Initiates a single STK Push
 *   - Persists an MpesaTransaction with metadata.deposit_type = 'spin_wallet'
 *   - Creates a Transaction record with target_type = 'spin_wallet'
 *
 * The unified `/api/mpesa/callback` route then credits the SpinWallet
 * (not Profile.balance_cents) based on the deposit_type metadata.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    // Support both session.user.id and session.user.email for auth check
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { phoneNumber, amount_cents, amount } = body

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Accept either `amount` (KES) or `amount_cents` (cents).
    // KES is the canonical unit at the API boundary.
    let amountKes: number
    if (typeof amount === 'number' && amount > 0) {
      amountKes = amount
    } else if (typeof amount_cents === 'number' && amount_cents > 0) {
      amountKes = amount_cents / 100
    } else {
      amountKes = 30 // Default spin cost
    }

    const result = await depositSpinWalletViaMpesa({
      amount: amountKes,
      phoneNumber: phoneNumber.trim(),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error initiating spin deposit:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred while initiating deposit' },
      { status: 500 }
    )
  }
}
