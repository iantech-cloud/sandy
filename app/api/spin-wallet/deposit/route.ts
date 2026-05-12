import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initiatSpinDeposit } from '@/app/actions/spin-wallet'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { phoneNumber, amount_cents } = body

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Convert cents to KES amount
    const amountKes = amount_cents ? amount_cents / 100 : 30
    const result = await initiatSpinDeposit(phoneNumber.trim(), amountKes)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Error initiating spin deposit:', error)
    return NextResponse.json(
      { success: false, message: 'An error occurred while initiating deposit' },
      { status: 500 }
    )
  }
}
