import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkSpinDepositMpesaStatus } from '@/app/actions/spin'

/**
 * Unified spin-wallet payment status checker.
 *
 * Polls the M-Pesa transaction status via the canonical
 * `checkSpinDepositMpesaStatus` action, which respects the idempotency
 * flag set by the callback router to avoid double-crediting.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    // Support both session.user.id and session.user.email for auth check
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const checkoutRequestId = searchParams.get('checkoutRequestId')

    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, message: 'checkoutRequestId is required' },
        { status: 400 }
      )
    }

    const result = await checkSpinDepositMpesaStatus(checkoutRequestId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[SpinWallet] Error checking deposit status:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred while checking payment status' },
      { status: 500 }
    )
  }
}
