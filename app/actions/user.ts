'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase, Profile, Transaction } from '../lib/models';
// Removed: import { getServerSession } from 'next-auth';
// Updated to import the unified 'auth' function from the configuration file
import { auth } from '@/auth';

// --- USER PROFILE FETCHING ---

export async function getUserProfile(): Promise<{ 
  success: boolean; 
  data?: any; 
  message: string 
}> {
  try {
    // NextAuth v5 (Auth.js) way to get the session in Server Actions
    const session = await auth();
    
    const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;
    if (!session?.user || (!sessionId && !session.user.email)) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();

    // Look up by _id first (string type in this schema — use findOne not findById
    // to avoid Mongoose's ObjectId cast), then fall back to case-insensitive email.
    let user: any = null;
    if (sessionId) {
      user = await Profile.findOne({ _id: sessionId }).lean();
    }
    if (!user && session.user.email) {
      const emailPattern = new RegExp(
        `^${session.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      user = await Profile.findOne({ email: { $regex: emailPattern } }).lean();
    }

    if (!user) {
      console.error('[getUserProfile] User not found. sessionId:', sessionId, 'email:', session.user.email);
      return { success: false, message: 'User not found' };
    }

    // Transform user data
    const userData = {
      id: user._id.toString(),
      name: user.username,
      email: user.email,
      phone: user.phone_number,
      balance: user.balance_cents / 100,
      referralCode: user.referral_id,
      totalEarnings: user.total_earnings_cents / 100,
      tasksCompleted: user.tasks_completed,
      isVerified: user.is_verified,
      isActive: user.is_active,
      isApproved: user.is_approved,
      role: user.role,
      status: user.status,
      level: user.level,
      rank: user.rank,
      availableSpins: user.available_spins,
    };

    return { success: true, data: userData, message: 'Profile fetched successfully' };

  } catch (error) {
    console.error('Get user profile error:', error);
    return { success: false, message: 'Failed to fetch user profile' };
  }
}

// --- USER PROFILE UPDATING ---

export async function updateUserProfile(updates: {
  username?: string;
  phone_number?: string;
}): Promise<{ 
  success: boolean; 
  message: string 
}> {
  try {
    // NextAuth v5 (Auth.js) way to get the session in Server Actions
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    
    // Use findOne({ _id }) instead of findById to respect the string _id type.
    const sessionId = (session.user as any).id || (session.user as any).userId;
    const emailPattern = session.user.email
      ? new RegExp(`^${session.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      : null;

    const filter = sessionId
      ? { _id: sessionId }
      : emailPattern
        ? { email: { $regex: emailPattern } }
        : null;

    if (!filter) {
      return { success: false, message: 'Cannot identify user' };
    }

    const user = await Profile.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    revalidatePath('/dashboard/profile');
    
    return { success: true, message: 'Profile updated successfully' };

  } catch (error) {
    console.error('Update user profile error:', error);
    return { success: false, message: 'Failed to update profile' };
  }
}

