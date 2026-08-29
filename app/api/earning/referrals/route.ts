import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Referral } from '@/app/lib/models'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectToDatabase()
  const referrals = await Referral.find({ referrer_id: session.user.email }).sort({ createdAt: -1 }).limit(100).lean()
  return NextResponse.json({ referrals })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const referredId = typeof body.referred_id === 'string' ? body.referred_id.trim() : ''
  if (!referredId || referredId === session.user.email || referredId.length > 254) return NextResponse.json({ error: 'Invalid referral' }, { status: 400 })
  await connectToDatabase()
  const referral = await Referral.findOneAndUpdate({ referred_id: referredId }, { $setOnInsert: { referrer_id: session.user.email, referred_id: referredId, status: 'pending' } }, { upsert: true, new: true })
  return NextResponse.json({ referral }, { status: 201 })
}
