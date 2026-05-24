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

    const { notificationId } = await request.json()

    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: 'Missing notificationId' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const result = await (Notification as any).findByIdAndUpdate(
      notificationId,
      {
        read: true,
        read_at: new Date()
      },
      { new: true }
    )

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Notification not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Mark Read API] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}
