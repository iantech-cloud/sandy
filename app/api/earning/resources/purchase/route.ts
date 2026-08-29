import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase, DigitalResource, ResourcePurchase } from '@/app/lib/models'
import { createMpesaDarajaService } from '@/app/lib/services/mpesa-daraja'

const schema = z.object({ resourceId: z.string().min(1), phone: z.string().regex(/^254\d{9}$/) })
export async function POST(request: NextRequest) {
  const session = await auth(); if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Invalid purchase request' }, { status: 400 })
  await connectToDatabase(); const resource = await DigitalResource.findOne({ _id: parsed.data.resourceId, status: 'published' }).lean()
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  const key = `resource:${session.user.email}:${resource._id}`
  const existing = await ResourcePurchase.findOne({ user_id: session.user.email, resource_id: resource._id, status: { $in: ['pending', 'paid'] } }).lean()
  if (existing) return NextResponse.json({ purchase: existing })
  const purchase = await ResourcePurchase.create({ user_id: session.user.email, resource_id: resource._id, amount_cents: resource.price_cents, payment_reference: key, entitlement_token_hash: crypto.createHash('sha256').update(`${key}:${Date.now()}`).digest('hex'), status: 'pending' })
  const callbackUrl = `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/api/webhooks/mpesa/resource`
  const result = await createMpesaDarajaService().initiateSTKPush(parsed.data.phone, Math.ceil(resource.price_cents / 100), 'HustleHub resource', callbackUrl, `RES-${purchase._id}`)
  if (result.ResponseCode !== '0') { await ResourcePurchase.deleteOne({ _id: purchase._id }); return NextResponse.json({ error: result.ResponseDescription || 'Payment initiation failed' }, { status: 502 }) }
  return NextResponse.json({ purchaseId: purchase._id, checkoutRequestId: result.CheckoutRequestID, message: 'Payment prompt sent' }, { status: 202 })
}
