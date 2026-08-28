import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/app/lib/mongoose'
import { EarningLedger, GigOrder } from '@/app/lib/models'

export async function POST(request: NextRequest) {
  const buyerId = request.headers.get('x-user-id')
  if (!buyerId) return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 })
  const body = await request.json() as { sellerId: string; serviceId: string; amountCents: number; paymentReference: string }
  if (!body.sellerId || !body.serviceId || !Number.isInteger(body.amountCents) || body.amountCents < 100 || !body.paymentReference) return NextResponse.json({ success: false, message: 'Invalid order.' }, { status: 400 })
  const fee = Math.floor(body.amountCents * 0.1)
  await connectToDatabase()
  const order = await GigOrder.create({ buyer_id: buyerId, seller_id: body.sellerId, service_id: body.serviceId, amount_cents: body.amountCents, platform_fee_cents: fee, seller_amount_cents: body.amountCents - fee, status: 'in_escrow', payment_reference: body.paymentReference })
  await EarningLedger.create({ user_id: body.sellerId, wallet_type: 'gigs', type: 'hold', amount_cents: body.amountCents - fee, status: 'pending', idempotency_key: `gig:${order._id}:hold`, reference_type: 'gig_order', reference_id: String(order._id) })
  return NextResponse.json({ success: true, order }, { status: 201 })
}
