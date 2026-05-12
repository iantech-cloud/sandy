import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkSpinDepositStatus } from '@/app/actions/spin-wallet'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { checkoutRequestId } = body

    if (!checkoutRequestId) {
      return NextResponse.json(
        { success: false, message: 'Checkout request ID is required' },
        { status: 400 }
      )
    }

    const result = await checkSpinDepositStatus(checkoutRequestId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error checking deposit status:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred' },
      { status: 500 }
    )
  }
}
