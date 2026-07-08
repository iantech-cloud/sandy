// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Profile, VerificationToken } from '@/app/lib/models';
import { sendVerificationEmail } from '@/app/actions/email';
import { randomUUID } from 'crypto';
import { rateLimit } from '@/app/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { email: rawEmail } = body;

    if (!rawEmail) {
      // SECURITY: Return generic message to prevent user enumeration
      return NextResponse.json({ 
        message: 'If this email is registered, a verification link will be sent.' 
      });
    }

    const email = rawEmail.trim().toLowerCase();

    // SECURITY: Rate limit resend-verification requests to prevent spam/brute-force
    const { exceeded: resendRateLimitExceeded } = rateLimit(
      `auth:resend:${email}`,
      3,  // Max 3 resend attempts
      30 * 60_000  // Per 30 minutes
    );
    if (resendRateLimitExceeded) {
      // Return generic message even on rate limit to prevent enumeration
      return NextResponse.json({ 
        message: 'If this email is registered, a verification link will be sent.' 
      });
    }

    // SECURITY: Use case-insensitive query to match Mongoose schema
    const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const user = await Profile.findOne({ email: { $regex: emailRegex } });
    
    // SECURITY: Do NOT differentiate response based on whether user exists or is already verified
    // Return same generic message in all cases to prevent user enumeration
    if (!user) {
      return NextResponse.json({ 
        message: 'If this email is registered, a verification link will be sent.' 
      });
    }

    if (user.is_verified) {
      // Return same generic message even though email is already verified
      return NextResponse.json({ 
        message: 'If this email is registered, a verification link will be sent.' 
      });
    }

    // Delete any existing verification tokens
    await VerificationToken.deleteMany({ user_id: user._id });

    // Create new verification token
    const verificationToken = randomUUID();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await VerificationToken.create({
      token: verificationToken,
      user_id: user._id,
      expires: tokenExpiry,
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationToken);

    // SECURITY: Don't reveal whether email send succeeded; always return same generic message
    return NextResponse.json({ 
      message: 'If this email is registered, a verification link will be sent.' 
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    // SECURITY: Return generic message on error to prevent information leakage
    return NextResponse.json(
      { message: 'If this email is registered, a verification link will be sent.' },
      { status: 200 }  // Return 200 even on error to prevent enumeration
    );
  }
}
