import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Using NextAuth v5 auth function
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { sendVerificationCodeEmail } from '@/app/actions/email';
import { connectToDatabase } from '@/app/lib/mongoose';
import { Profile, VerificationToken } from '@/app/lib/models';
import { rateLimit } from '@/app/lib/rate-limit';

// Generate 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send success confirmation email (without verification code)
async function sendPasswordSuccessEmail(email: string, username: string, type: 'reset' | 'forgot') {
  const subject = type === 'forgot' 
    ? 'Password Reset Successful' 
    : 'Password Changed Successfully';
  
  // Use a special code value that indicates this is a success confirmation
  const emailResult = await sendVerificationCodeEmail(
    email,
    'SUCCESS_CONFIRMATION', // Special value to indicate success email
    subject,
    true // This indicates it's a confirmation email
  );

  return emailResult;
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      currentPassword, 
      newPassword, 
      verificationCode, 
      verificationMethod,
      email, // For forgot password flow
      type = 'reset' // 'reset' or 'forgot'
    } = body;

    // FORGOT PASSWORD FLOW (no session required)
    if (type === 'forgot') {
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required for password reset' },
          { status: 400 }
        );
      }

      // SECURITY: Rate limit forgot password requests to prevent user enumeration and spam
      const { exceeded: forgotRateLimitExceeded } = rateLimit(
        `pwreset:forgot:${email}`,
        3,  // Max 3 forgot password attempts
        30 * 60_000  // Per 30 minutes
      );
      if (forgotRateLimitExceeded) {
        // Return generic message to prevent user enumeration
        return NextResponse.json({
          success: true,
          needsVerification: true,
          verificationMethod: 'email',
          message: 'If this email exists, a verification code has been sent.'
        });
      }

      // Check if user exists
      const user = await Profile.findOne({ email }).select('+password +twoFASecret');

      if (!user) {
        // Don't reveal if email exists or not (security best practice)
        return NextResponse.json({
          success: true,
          needsVerification: true,
          verificationMethod: 'email',
          message: 'If this email exists, a verification code has been sent.'
        });
      }

      // First request - no verification code provided
      if (!verificationCode) {
        if (!newPassword) {
          return NextResponse.json(
            { error: 'New password is required' },
            { status: 400 }
          );
        }

        if (newPassword.length < 8) {
          return NextResponse.json(
            { error: 'Password must be at least 8 characters long' },
            { status: 400 }
          );
        }

        // Determine verification method
        const method = user.twoFAEnabled ? '2fa' : 'email';
        const code = generateVerificationCode();

        // Delete any existing password reset tokens for this user
        await VerificationToken.deleteMany({
          user_id: user._id,
          purpose: 'password_reset'
        });

        // Store in database
        // SECURITY: Do NOT store plaintext password in metadata.
        // We'll re-request and hash it after verification succeeds.
        const token = new VerificationToken({
          token: code,
          user_id: user._id,
          purpose: 'password_reset',
          expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          metadata: {
            email,
            verification_method: method,
            type: 'forgot'
          }
        });

        await token.save();

        // Send email code if not using 2FA
        if (method === 'email') {
          const emailResult = await sendVerificationCodeEmail(
            email, 
            code, 
            'Password Reset Verification'
          );

          if (!emailResult.success) {
            return NextResponse.json(
              { error: 'Failed to send verification email. Please try again.' },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({
          success: true,
          needsVerification: true,
          verificationMethod: method,
          message: method === '2fa' 
            ? 'Please enter your Google Authenticator code to complete password reset.'
            : 'A verification code has been sent to your email.'
        });
      }

      // Second request - verify code and reset password
      // SECURITY: Rate limit code verification attempts to prevent brute-force
      const { exceeded: codeVerifyRateLimitExceeded } = rateLimit(
        `pwreset:code:${email}`,
        3,  // Max 3 verification attempts
        10 * 60_000  // Per 10 minutes
      );
      if (codeVerifyRateLimitExceeded) {
        return NextResponse.json(
          { error: 'Too many verification attempts. Please try again later.' },
          { status: 429 }
        );
      }

      if (!newPassword) {
        return NextResponse.json(
          { error: 'New password is required to complete password reset' },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Get the most recent valid token
      const storedToken = await VerificationToken.findOne({
        user_id: user._id,
        purpose: 'password_reset',
        used: false,
        expires: { $gt: new Date() }
      }).sort({ created_at: -1 });

      if (!storedToken) {
        return NextResponse.json(
          { error: 'Verification code expired or invalid. Please request a new one.' },
          { status: 400 }
        );
      }

      // Verify the code
      let isValid = false;
      if (user.twoFAEnabled && user.twoFASecret) {
        // Verify 2FA code using speakeasy
        isValid = speakeasy.totp.verify({
          secret: user.twoFASecret,
          encoding: 'base32',
          token: verificationCode,
          window: 2,
          step: 30,
        });
      } else {
        // Verify email code
        isValid = storedToken.token === verificationCode;
      }

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid verification code. Please try again.' },
          { status: 400 }
        );
      }

      // Hash new password and update (password is now provided in the verification request)
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      // Mark token as used
      storedToken.used = true;
      storedToken.used_at = new Date();
      await storedToken.save();

      // Send SUCCESS confirmation email for forgot password
      const successEmailResult = await sendPasswordSuccessEmail(
        email, 
        user.username || user.email, 
        'forgot'
      );

      if (!successEmailResult.success) {
        console.warn('Failed to send success email, but password was reset successfully');
      }

      return NextResponse.json({
        success: true,
        message: 'Password has been successfully reset. You can now log in with your new password.'
      });
    }

    // AUTHENTICATED RESET PASSWORD FLOW (logged-in user)
    const session = await auth(); // Using NextAuth v5 session retrieval
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Get user from database
    const user = await Profile.findOne({ email: userEmail }).select('+password +twoFASecret');

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // First request - no verification code provided
    if (!verificationCode) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: 'Current password and new password are required' },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Check if new password is same as current
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return NextResponse.json(
          { error: 'New password must be different from current password' },
          { status: 400 }
        );
      }

      // Determine verification method
      const method = user.twoFAEnabled ? '2fa' : 'email';
      const code = generateVerificationCode();

      // Delete any existing password reset tokens for this user
      await VerificationToken.deleteMany({
        user_id: user._id,
        purpose: 'password_reset'
      });

      // Store in database
      // SECURITY: Do NOT store plaintext passwords in metadata.
      // We verify currentPassword now, and will re-request newPassword after verification.
      const token = new VerificationToken({
        token: code,
        user_id: user._id,
        purpose: 'password_reset',
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        metadata: {
          email: userEmail,
          verification_method: method,
          type: 'reset'
        }
      });

      await token.save();

      // Send email code if not using 2FA
      if (method === 'email') {
        const emailResult = await sendVerificationCodeEmail(
          userEmail,
          code,
          'Password Change Verification'
        );

        if (!emailResult.success) {
          return NextResponse.json(
            { error: 'Failed to send verification email. Please try again.' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        needsVerification: true,
        verificationMethod: method,
        message: method === '2fa' 
          ? 'Please enter your Google Authenticator code to confirm password change.'
          : 'A verification code has been sent to your email.'
      });
    }

    // Second request - verify code and change password
    // SECURITY: Rate limit code verification attempts to prevent brute-force
    const { exceeded: authenticatedCodeRateLimitExceeded } = rateLimit(
      `pwreset:code:${userEmail}`,
      3,  // Max 3 verification attempts
      10 * 60_000  // Per 10 minutes
    );
    if (authenticatedCodeRateLimitExceeded) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required to complete password change' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Get the most recent valid token
    const storedToken = await VerificationToken.findOne({
      user_id: user._id,
      purpose: 'password_reset',
      used: false,
      expires: { $gt: new Date() }
    }).sort({ created_at: -1 });

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Verification code expired or invalid. Please try again.' },
        { status: 400 }
      );
    }

    // Verify the code
    let isValid = false;
    if (user.twoFAEnabled && user.twoFASecret) {
      // Verify 2FA code using speakeasy
      isValid = speakeasy.totp.verify({
        secret: user.twoFASecret,
        encoding: 'base32',
        token: verificationCode,
        window: 2,
        step: 30,
      });
    } else {
      // Verify email code
      isValid = storedToken.token === verificationCode;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Hash new password and update (password is now provided in the verification request)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    storedToken.used = true;
    storedToken.used_at = new Date();
    await storedToken.save();

    // Send SUCCESS confirmation email for password change
    const successEmailResult = await sendPasswordSuccessEmail(
      userEmail,
      user.username || user.email,
      'reset'
    );

    if (!successEmailResult.success) {
      console.warn('Failed to send success email, but password was changed successfully');
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully changed.'
    });

  } catch (error) {
    console.error('Error in reset-password:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

