import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Notification } from '@/app/lib/models'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    await (Notification as any).updateMany(
      {
        user_id: session.user.id,
        read: false
      },
      {
        read: true,
        read_at: new Date()
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Mark All Read API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}
