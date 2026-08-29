import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase, GigService } from '@/app/lib/models'

const serviceSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(4000),
  category: z.string().trim().min(2).max(60),
  price_cents: z.number().int().min(100).max(10_000_000),
  delivery_days: z.number().int().min(1).max(90),
})

export async function GET(request: NextRequest) {
  await connectToDatabase()
  const category = request.nextUrl.searchParams.get('category')
  const query = { status: 'published', ...(category ? { category } : {}) }
  const services = await GigService.find(query).sort({ rating: -1, createdAt: -1 }).limit(50).lean()
  return NextResponse.json({ services })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = serviceSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid listing details' }, { status: 400 })
  await connectToDatabase()
  const service = await GigService.create({ seller_id: session.user.email, ...parsed.data, status: 'published' })
  return NextResponse.json({ service }, { status: 201 })
}
