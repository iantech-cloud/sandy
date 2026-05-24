import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Notification } from '@/app/lib/models'
import { rateLimit } from '@/app/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Apply rate limiting
    const rateLimitKey = `notifications:delete:${session.user.id}`
    const { exceeded, remaining, resetTime } = rateLimit(
      rateLimitKey,
      150, // 150 requests per minute
      60 * 1000
    )

    if (exceeded) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      )
    }

    const { notificationId } = await request.json()

    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: 'Missing notificationId' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const result = await (Notification as any).findOneAndDelete({
      _id: notificationId,
      user_id: session.user.id
    })

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json({ success: true })
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())

    return response
  } catch (error) {
    console.error('[Delete Notification API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
