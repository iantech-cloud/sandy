import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { connectToDatabase } from '@/app/lib/mongoose'
import { EarningPayout, EarningWallet, EarningLedger } from '@/app/lib/models'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 })
  const body = await request.json() as { walletType: string; amountCents: number; phone: string }
  if (!['deals', 'gigs', 'cashback', 'analyzer', 'resources'].includes(body.walletType) || !Number.isInteger(body.amountCents) || body.amountCents < 10000 || !/^2547\d{8}$/.test(body.phone)) return NextResponse.json({ success: false, message: 'Invalid payout request.' }, { status: 400 })
  await connectToDatabase()
  const wallet = await EarningWallet.findOne({ user_id: userId, wallet_type: body.walletType })
  if (!wallet || wallet.available_cents < body.amountCents) return NextResponse.json({ success: false, message: 'Insufficient available balance.' }, { status: 409 })
  const requestId = crypto.randomUUID()
  wallet.available_cents -= body.amountCents
  wallet.lifetime_withdrawn_cents += body.amountCents
  await wallet.save()
  const payout = await EarningPayout.create({ user_id: userId, wallet_type: body.walletType, amount_cents: body.amountCents, phone: body.phone, request_id: requestId })
  await EarningLedger.create({ user_id: userId, wallet_type: body.walletType, type: 'withdrawal', amount_cents: body.amountCents, status: 'pending', idempotency_key: `payout:${requestId}`, reference_type: 'payout', reference_id: String(payout._id) })
  return NextResponse.json({ success: true, requestId, status: payout.status }, { status: 201 })
}
