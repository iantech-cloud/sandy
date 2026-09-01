import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { z } from 'zod'
import { auth } from '@/auth'
import { connectToDatabase, DigitalResource } from '@/app/lib/models'

const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'application/zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
const schema = z.object({ title: z.string().trim().min(5).max(160), description: z.string().trim().min(20).max(5000), category: z.string().trim().min(2).max(60), price_cents: z.number().int().min(1).max(5_000_000) })

export async function GET() {
  await connectToDatabase()
  const resources = await DigitalResource.find({ status: 'published' }).select('-blob_pathname').sort({ createdAt: -1 }).limit(50).lean()
  return NextResponse.json({ resources })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData()
  const file = form.get('file')
  const parsed = schema.safeParse({ title: form.get('title'), description: form.get('description'), category: form.get('category'), price_cents: Number(form.get('price_cents')) })
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type) || !parsed.success) return NextResponse.json({ error: 'Invalid resource or file' }, { status: 400 })
  await connectToDatabase()
  const blob = await put(`resources/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, file, { access: 'private', addRandomSuffix: false })
  const resource = await DigitalResource.create({ seller_id: session.user.email, ...parsed.data, blob_pathname: blob.pathname, content_type: file.type || 'application/octet-stream', file_size: file.size, status: 'published' })
  return NextResponse.json({ resource: { id: resource._id, title: resource.title, price_cents: resource.price_cents } }, { status: 201 })
}
