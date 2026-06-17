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
 * Update user profile (bio, phone, name, etc.)
 * 
 * IMPORTANT: Username is auto-generated during registration and is immutable.
 * Users cannot change their username via this endpoint or the UI.
 * Only administrators can modify usernames via admin tools if absolutely necessary.
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
    // REMOVED: username parameter - usernames are now immutable and auto-generated
    const { bio, phone_number, phone, name } = body;

    await connectToDatabase();

    // Build update object - accept both phone and phone_number, but NOT username
    const updateData: any = {};
    if (name && name.trim()) updateData.name = name.trim();
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
