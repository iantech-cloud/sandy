import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkSpinDepositStatus } from '@/app/actions/spin-wallet'

// Frontend polls: GET /api/spin-wallet/check_status?checkoutRequestId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
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

    const result = await checkSpinDepositStatus(checkoutRequestId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[SpinWallet] Error checking deposit status:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred while checking payment status' },
      { status: 500 }
    )
  }
}