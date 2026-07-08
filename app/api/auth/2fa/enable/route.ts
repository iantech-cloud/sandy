// app/api/auth/2fa/enable/route.ts
import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/app/lib/mongoose';
import { Profile } from '@/app/lib/models/Profile';
import { auth } from '@/auth';
import { rateLimit } from '@/app/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Connect to database
    await connectToDatabase();

    // Find the user's profile
    const profile = await Profile.findOne({ email: userEmail });

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    console.log('=== 2FA ENABLE DEBUG ===');
    console.log('User:', userEmail);
    console.log('Current twoFAEnabled:', profile.twoFAEnabled);
    console.log('Current twoFASecret exists:', !!profile.twoFASecret);

    // Check if 2FA is already enabled
    if (profile.twoFAEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled for this account.' },
        { status: 400 }
      );
    }

    // Check if 2FA setup is already in progress
    if (profile.twoFASecret && !profile.twoFAEnabled) {
      console.log('2FA setup already in progress, generating QR from existing secret');
      
      // Generate QR code from existing secret
      const otpauthUrl = speakeasy.otpauthURL({
        secret: profile.twoFASecret,
        label: encodeURIComponent(userEmail),
        issuer: 'HustleHub Africa',
        encoding: 'base32',
      });

      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      return NextResponse.json(
        {
          success: true,
          qrCode: qrCodeDataUrl,
          message: '2FA setup is already in progress. Scan the QR code with Google Authenticator and verify the code to enable 2FA.',
          setupInProgress: true,
        },
        { status: 200 }
      );
    }

    // Generate a unique secret for this user
    const secret = speakeasy.generateSecret({
      name: `HustleHub Africa (${userEmail})`,
      issuer: 'HustleHub Africa',
      length: 32,
    });

    console.log('Generated new secret for user');

    // Generate the OTPAuth URL for QR code
    const otpauthUrl = secret.otpauth_url;

    if (!otpauthUrl) {
      return NextResponse.json(
        { error: 'Failed to generate OTPAuth URL.' },
        { status: 500 }
      );
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Save the secret to the profile
    profile.twoFASecret = secret.base32;
    profile.twoFAEnabled = false; // Not enabled until verified
    await profile.save();

    console.log('Secret saved successfully to profile');

    // Verify the secret was saved
    const updatedProfile = await Profile.findOne({ email: userEmail });
    console.log('After save - twoFASecret exists:', !!updatedProfile?.twoFASecret);

    // Return the QR code to the frontend
    return NextResponse.json(
      {
        success: true,
        qrCode: qrCodeDataUrl,
        message: 'Scan the QR code with Google Authenticator and verify the code to enable 2FA.',
        setupInProgress: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return NextResponse.json(
      { error: 'An error occurred while enabling 2FA.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's session
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Connect to database
    await connectToDatabase();

    // Find the user's profile
    const profile = await Profile.findOne({ email: userEmail });

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    // Return current 2FA status
    return NextResponse.json(
      {
        twoFAEnabled: profile.twoFAEnabled || false,
        hasSecret: !!profile.twoFASecret,
        setupInProgress: !profile.twoFAEnabled && !!profile.twoFASecret,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching 2FA status.' },
      { status: 500 }
    );
  }
}

// DELETE method to disable 2FA or reset setup
// SECURITY: Requires password re-confirmation to prevent session hijack from disabling 2FA
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    
    // Parse request body to get password
    let password: string;
    try {
      const body = await request.json();
      password = body.password;
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request format. Password is required.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to disable 2FA for security reasons.' },
        { status: 400 }
      );
    }

    // SECURITY: Rate limit 2FA disable attempts to prevent brute-force attacks
    const { exceeded: disableRateLimitExceeded } = rateLimit(
      `2fa:disable:${userEmail}`,
      5,  // Max 5 attempts
      60 * 60_000  // Per hour
    );
    if (disableRateLimitExceeded) {
      return NextResponse.json(
        { error: 'Too many 2FA disable attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find and verify the profile
    const profile = await Profile.findOne({ email: userEmail }).select('+password');
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    // SECURITY: Verify password before allowing 2FA to be disabled
    if (!profile.password) {
      return NextResponse.json(
        { error: 'Password verification failed.' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, profile.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Password is incorrect. 2FA was not disabled.' },
        { status: 401 }
      );
    }

    // Reset 2FA settings
    profile.twoFASecret = null;
    profile.twoFAEnabled = false;
    profile.twoFASetupDate = null;
    profile.twoFABackupCodes = [];
    await profile.save();

    console.log('2FA disabled successfully for user:', userEmail);

    return NextResponse.json(
      {
        success: true,
        message: '2FA has been disabled for your account. You will need to enter only your password on next login.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json(
      { error: 'An error occurred while disabling 2FA.' },
      { status: 500 }
    );
  }
}
