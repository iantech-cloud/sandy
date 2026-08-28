import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/app/lib/mongoose'
import { EarningLedger, EarningPayout } from '@/app/lib/models'

export async function POST(request: NextRequest) {
  const callback = await request.json() as { requestId?: string; resultCode?: number; receipt?: string; failureReason?: string }
  if (!callback.requestId) return NextResponse.json({ success: false }, { status: 400 })
  await connectToDatabase()
  const payout = await EarningPayout.findOne({ request_id: callback.requestId })
  if (!payout) return NextResponse.json({ success: false, message: 'Payout not found.' }, { status: 404 })
  const completed = callback.resultCode === 0
  payout.status = completed ? 'completed' : 'failed'
  payout.mpesa_receipt = callback.receipt
  payout.failure_reason = callback.failureReason
  await payout.save()
  await EarningLedger.updateOne({ idempotency_key: `payout:${payout.request_id}` }, { $set: { status: completed ? 'settled' : 'reversed' } })
  return NextResponse.json({ success: true })
}
