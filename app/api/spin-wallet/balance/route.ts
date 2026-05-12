import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSpinWalletBalance } from '@/app/actions/spin-wallet'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const result = await getSpinWalletBalance()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error fetching spin wallet balance:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred' },
      { status: 500 }
    )
  }
}
