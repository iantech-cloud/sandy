import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Notification } from '@/app/lib/models'
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Apply rate limiting
    const rateLimitKey = `notifications:unread:${session.user.id}`
    const { exceeded, remaining, resetTime } = rateLimit(
      rateLimitKey,
      API_RATE_LIMITS.notifications.limit,
      API_RATE_LIMITS.notifications.windowMs
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

    const notifications = await (Notification as any)
      .find({
        user_id: session.user.id,
        read: false
      })
      .select('_id type title message read referral_user_name action_url created_at')
      .sort({ created_at: -1 })
      .limit(10)
      .lean()

    const unreadCount = await (Notification as any).countDocuments({
      user_id: session.user.id,
      read: false
    })

    const response = NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount
    })

    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())

    return response
  } catch (error) {
    console.error('[Notifications API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
