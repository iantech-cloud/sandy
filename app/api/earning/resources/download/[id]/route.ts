import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { connectToDatabase } from '@/app/lib/mongoose'
import { ResourcePurchase } from '@/app/lib/models'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get('x-user-id')
  const token = request.nextUrl.searchParams.get('token')
  if (!userId || !token) return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 })
  await connectToDatabase()
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const purchase = await ResourcePurchase.findOneAndUpdate({ _id: (await params).id, user_id: userId, entitlement_token_hash: hash, status: 'paid' }, { $set: { downloaded_at: new Date() } }, { new: true }).lean()
  if (!purchase) return NextResponse.json({ success: false, message: 'Download entitlement not found.' }, { status: 404 })
  return NextResponse.json({ success: true, resourceId: String(purchase.resource_id), message: 'Entitlement verified. Generate a short-lived signed file URL here.' })
}
