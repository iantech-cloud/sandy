import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase, ProductAnalysis } from '@/app/lib/models'

const schema = z.object({ url: z.string().url().max(2048) })
const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']

function isSafeUrl(value: string) {
  const parsed = new URL(value)
  return parsed.protocol === 'https:' && !blockedHosts.includes(parsed.hostname) && !parsed.hostname.endsWith('.local')
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectToDatabase()
  const analyses = await ProductAnalysis.find({ user_id: session.user.email }).sort({ createdAt: -1 }).limit(20).lean()
  return NextResponse.json({ analyses })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success || !isSafeUrl(parsed.data.url)) return NextResponse.json({ error: 'Only public HTTPS product URLs are allowed' }, { status: 400 })
  await connectToDatabase()
  const analysis = await ProductAnalysis.create({ user_id: session.user.email, url: parsed.data.url, normalized_url: new URL(parsed.data.url).toString(), provider: 'existing-project-ai', status: 'queued' })
  return NextResponse.json({ analysis }, { status: 202 })
}
