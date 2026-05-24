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

    // Apply rate limiting (lenient for bulk operations)
    const rateLimitKey = `notifications:mark-all-read:${session.user.id}`
    const { exceeded, remaining, resetTime } = rateLimit(
      rateLimitKey,
      100, // 100 requests per minute
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

    await connectToDatabase()

    const result = await (Notification as any).updateMany(
      {
        user_id: session.user.id,
        read: false
      },
      {
        read: true,
        read_at: new Date()
      }
    )

    const response = NextResponse.json({ 
      success: true,
      modifiedCount: result.modifiedCount
    })
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())

    return response
  } catch (error) {
    console.error('[Mark All Read API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}
