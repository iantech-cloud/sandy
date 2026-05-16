import { NextRequest, NextResponse } from 'next/server';
import { Profile, connectToDatabase } from '@/app/lib/models';

/**
 * GET /api/referrer/[referralId]
 * Fetches the username of a user by their referral ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { referralId: string } }
) {
  try {
    await connectToDatabase();

    const { referralId } = params;

    if (!referralId) {
      return NextResponse.json(
        { message: 'Referral ID is required' },
        { status: 400 }
      );
    }

    const formattedRefId = referralId.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Find the referrer by their referral ID
    const referrer = await Profile.findOne({ 
      referral_id: formattedRefId,
      status: 'active',
      approval_status: 'approved'
    }).select('username');

    if (!referrer) {
      return NextResponse.json(
        { message: 'Referrer not found or inactive' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      username: referrer.username,
      referral_id: formattedRefId
    });

  } catch (error) {
    console.error('Error fetching referrer:', error);
    return NextResponse.json(
      { message: 'Error fetching referrer information' },
      { status: 500 }
    );
  }
}
