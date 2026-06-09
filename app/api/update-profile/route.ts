import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';

/**
 * GET /api/update-profile
 * Fetch current user profile
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const user = await Profile.findOne(
      { email: session.user.email },
      {
        password: 0,
        oauth_id: 0,
        oauth_provider: 0,
      }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        username: user.username,
        phone: user.phone_number,
        phone_number: user.phone_number,
        name: user.name,
        bio: user.bio,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('[API] GET /update-profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/update-profile
 * Update user profile (username, bio, phone, name, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { username, bio, phone_number, phone, name } = body;

    await connectToDatabase();

    // Validate input
    if (username && username.trim().length < 3) {
      return NextResponse.json(
        { success: false, message: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Check if username is already taken (if updating)
    if (username) {
      const existingUser = await Profile.findOne({ 
        username: username.toLowerCase().trim(),
        email: { $ne: session.user.email }
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, message: 'Username already taken' },
          { status: 400 }
        );
      }
    }

    // Build update object - accept both phone and phone_number
    const updateData: any = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (username && username.trim()) updateData.username = username.toLowerCase().trim();
    if (bio !== undefined && bio !== null) updateData.bio = bio.trim();
    if (phone_number && phone_number.trim()) updateData.phone_number = phone_number.trim();
    if (phone && phone.trim() && !phone_number) updateData.phone_number = phone.trim();

    // Update user
    const updatedUser = await Profile.findOneAndUpdate(
      { email: session.user.email },
      { $set: updateData },
      { new: true, select: '-password -oauth_id -oauth_provider' }
    );

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        email: updatedUser.email,
        username: updatedUser.username,
        phone: updatedUser.phone_number,
        phone_number: updatedUser.phone_number,
        name: updatedUser.name,
        bio: updatedUser.bio,
        avatar_url: updatedUser.avatar_url,
      },
    });
  } catch (error) {
    console.error('[API] POST /update-profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
