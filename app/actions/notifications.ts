'use server'

import { auth } from '@/auth'
import { connectToDatabase, Notification, Profile } from '@/app/lib/models'

/**
 * Fetch unread notifications for the current user
 */
export async function getUnreadNotifications() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
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

    return {
      success: true,
      notifications: notifications || [],
      unreadCount
    }
  } catch (error) {
    console.error('[Notifications] Error fetching unread:', error)
    return { success: false, message: 'Failed to fetch notifications' }
  }
}

/**
 * Fetch all notifications for the current user with pagination
 */
export async function getAllNotifications(limit: number = 20, skip: number = 0) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const notifications = await (Notification as any)
      .find({ user_id: session.user.id })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean()

    const total = await (Notification as any).countDocuments({
      user_id: session.user.id
    })

    return {
      success: true,
      notifications: notifications || [],
      total,
      hasMore: skip + limit < total
    }
  } catch (error) {
    console.error('[Notifications] Error fetching all:', error)
    return { success: false, message: 'Failed to fetch notifications' }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const notification = await (Notification as any).findOneAndUpdate(
      {
        _id: notificationId,
        user_id: session.user.id
      },
      {
        read: true,
        read_at: new Date()
      },
      { new: true }
    )

    if (!notification) {
      return { success: false, message: 'Notification not found' }
    }

    return { success: true, notification }
  } catch (error) {
    console.error('[Notifications] Error marking as read:', error)
    return { success: false, message: 'Failed to mark notification as read' }
  }
}

/**
 * Mark all notifications as read for the current user
 */
export async function markAllNotificationsAsRead() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
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

    return {
      success: true,
      modifiedCount: result.modifiedCount
    }
  } catch (error) {
    console.error('[Notifications] Error marking all as read:', error)
    return { success: false, message: 'Failed to mark notifications as read' }
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized' }
    }

    await connectToDatabase()

    const result = await (Notification as any).deleteOne({
      _id: notificationId,
      user_id: session.user.id
    })

    if (result.deletedCount === 0) {
      return { success: false, message: 'Notification not found' }
    }

    return { success: true, message: 'Notification deleted' }
  } catch (error) {
    console.error('[Notifications] Error deleting:', error)
    return { success: false, message: 'Failed to delete notification' }
  }
}

/**
 * Create a referral activation notification
 * Called internally when a user's downline activates
 * @param referrer_id - User who made the referral
 * @param referee_id - User who activated
 */
export async function createReferralActivationNotification(
  referrer_id: string,
  referee_id: string
) {
  try {
    await connectToDatabase()

    // Fetch referee details
    const referee = await (Profile as any).findById(referee_id).lean()
    if (!referee) {
      console.warn(`[Notifications] Referee not found: ${referee_id}`)
      return { success: false, message: 'Referee not found' }
    }

    // Create notification for referrer
    const notification = await (Notification as any).create({
      user_id: referrer_id,
      type: 'referral_activated',
      title: 'Referral Activated',
      message: `${referee.username || 'Unknown user'} has activated their account from your referral link.`,
      referral_user_id: referee_id,
      referral_user_name: referee.username || 'Unknown user',
      referral_user_phone: referee.phoneNumber,
      related_resource_type: 'referral',
      related_resource_id: referee_id,
      action_url: `/dashboard/referrals`,
      metadata: {
        referee_email: referee.email,
        referee_phone: referee.phoneNumber,
        activation_time: new Date().toISOString()
      },
      created_at: new Date()
    })

    // Invalidate unread count cache for this user
    const { appCache, cacheKeys } = await import('@/app/lib/cache')
    appCache.delete(cacheKeys.unreadCount(referrer_id.toString()))

    console.log(`[Notifications] Created referral activation notification for ${referrer_id}`)
    return { success: true, notification }
  } catch (error) {
    console.error('[Notifications] Error creating referral notification:', error)
    return { success: false, message: 'Failed to create notification' }
  }
}

/**
 * Get unread count for a specific user (for real-time updates)
 * Now with caching to reduce database hits
 */
export async function getUnreadCount() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: 'Unauthorized', count: 0 }
    }

    // Check cache first
    const { appCache, cacheKeys, cacheTTL } = await import('@/app/lib/cache')
    const cacheKey = cacheKeys.unreadCount(session.user.id)
    const cachedCount = appCache.get<number>(cacheKey)
    
    if (cachedCount !== null) {
      return { success: true, count: cachedCount }
    }

    await connectToDatabase()

    const count = await (Notification as any).countDocuments({
      user_id: session.user.id,
      read: false
    })

    // Cache for 30 seconds
    appCache.set(cacheKey, count, cacheTTL.SHORT)

    return { success: true, count }
  } catch (error) {
    console.error('[Notifications] Error getting unread count:', error)
    return { success: false, count: 0 }
  }
}
