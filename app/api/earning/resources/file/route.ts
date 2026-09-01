import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/auth'
import { connectToDatabase, DigitalResource, ResourcePurchase } from '@/app/lib/models'
export async function GET(request: NextRequest) {
  const session = await auth(); if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Missing resource' }, { status: 400 })
  await connectToDatabase(); const resource = await DigitalResource.findById(id).lean(); if (!resource) return new NextResponse('Not found', { status: 404 })
  const entitled = await ResourcePurchase.exists({ user_id: session.user.email, resource_id: id, status: 'paid' }); if (!entitled) return new NextResponse('Forbidden', { status: 403 })
  const result = await get(resource.blob_pathname, { access: 'private' }); if (!result) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(result.stream, { headers: { 'Content-Type': resource.content_type, 'Content-Disposition': `attachment; filename="${resource.title.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'private, no-store' } })
}
