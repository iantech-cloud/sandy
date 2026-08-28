import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { connectToDatabase } from '@/app/lib/mongoose'
import { CashbackEvent, EarningLedger } from '@/app/lib/models'

export async function POST(request: NextRequest) {
  const secret = process.env.CASHBACK_WEBHOOK_SECRET
  const signature = request.headers.get('x-cashback-signature')
  const raw = await request.text()
  if (!secret || !signature) return NextResponse.json({ success: false, message: 'Webhook not configured.' }, { status: 503 })
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const provided = Buffer.from(signature)
  const computed = Buffer.from(expected)
  if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) return NextResponse.json({ success: false }, { status: 401 })
  const body = JSON.parse(raw) as { clickId: string; orderId?: string; commissionCents: number; orderAmountCents?: number }
  await connectToDatabase()
  const event = await CashbackEvent.findOneAndUpdate({ click_id: body.clickId }, { $set: { order_id: body.orderId, commission_cents: body.commissionCents, order_amount_cents: body.orderAmountCents, cashback_cents: Math.floor(body.commissionCents * 0.5), platform_cents: Math.ceil(body.commissionCents * 0.5), status: 'confirmed' } }, { new: true })
  if (!event) return NextResponse.json({ success: false, message: 'Unknown click.' }, { status: 404 })
  await EarningLedger.create({ user_id: event.user_id, wallet_type: 'cashback', type: 'cashback', amount_cents: event.cashback_cents, status: 'pending', idempotency_key: `cashback:${body.clickId}` , reference_type: 'cashback', reference_id: String(event._id) })
  return NextResponse.json({ success: true })
}
