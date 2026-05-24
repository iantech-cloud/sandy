import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Notification } from '@/app/lib/models'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const notifications = await (Notification as any)
      .find({
        user_id: session.user.id,
        read: false
      })
      .sort({ created_at: -1 })
      .limit(10)
      .lean()

    const unreadCount = await (Notification as any).countDocuments({
      user_id: session.user.id,
      read: false
    })

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount
    })
  } catch (error) {
    console.error('[Notifications API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
