// This API Route handles user registration (POST /api/auth/register)
// It uses Mongoose models and connects to MongoDB.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// Import Mongoose models and the connection utility
import { Profile, Referral, DownlineUser, connectToDatabase } from '@/app/lib/models'; 
import { CommissionService } from '@/app/lib/services/commissionService';
import { formatPhoneNumber, isValidPhoneNumber } from '@/app/lib/utils/phoneFormatter';
import { rateLimit, API_RATE_LIMITS } from '@/app/lib/rate-limit';

// Configuration for generating new referral IDs
const REFERRAL_ID_LENGTH = 8;
const REFERRAL_ID_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Helper function to generate a unique referral ID.
 * In a real app, this would loop and check the DB for uniqueness until a match is not found.
 */
function generateReferralId(): string {
  let result = '';
  for (let i = 0; i < REFERRAL_ID_LENGTH; i++) {
    result += REFERRAL_ID_CHARACTERS.charAt(
      Math.floor(Math.random() * REFERRAL_ID_CHARACTERS.length)
    );
  }
  return result;
}

/**
 * POST handler for user registration.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 registration attempts per minute per IP (brute-force / spam protection)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { exceeded, resetTime } = rateLimit(`auth:register:${ip}`, API_RATE_LIMITS.auth.limit, API_RATE_LIMITS.auth.windowMs);
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many registration attempts. Please wait and try again.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)) },
      });
    }

    // 1. Establish MongoDB Connection
    await connectToDatabase();

    const body = await request.json();
    const { username, email: rawEmail, phone, password, referralId: rawReferralId } = body;

    // Normalize email to lowercase and trim whitespace for case-insensitive matching
    const email = rawEmail ? rawEmail.trim().toLowerCase() : '';

    console.log('Registration attempt for:', { username, email, phone });

    // Basic Input Validation
    if (!username || !email || !phone || !password) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
    }

    // Validate and format phone number
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { message: 'Invalid phone number format. Please use: 791406285, 0791406285, 254791406285, or +254791406285' }, 
        { status: 400 }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log('Formatted phone number:', formattedPhone);

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const referralId = rawReferralId ? rawReferralId.toUpperCase() : null;

    // REQUIREMENT: Referral ID is MANDATORY - no registration without a referrer
    if (!referralId) {
      return NextResponse.json(
        { message: 'Referral code is required. You must register using a valid referral link.' }, 
        { status: 400 }
      );
    }

    // 2. Check for existing users (Uniqueness check)
    const existingUser = await Profile.findOne({ $or: [{ username }, { email }, { phone_number: formattedPhone }] });

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json({ message: 'Username already taken.' }, { status: 409 });
      }
      if (existingUser.email === email) {
        return NextResponse.json({ message: 'Email already registered.' }, { status: 409 });
      }
      if (existingUser.phone_number === formattedPhone) {
        return NextResponse.json({ message: 'Phone number already registered.' }, { status: 409 });
      }
    }

    // 3. Validate Referral ID and lookup referrer
    const referrerProfile = await Profile.findOne({ referral_id: referralId });

    if (!referrerProfile) {
      return NextResponse.json({ message: 'Invalid referral code. Please check and try again.' }, { status: 400 });
    }

    // Check if referrer is approved and active
    if (referrerProfile.approval_status !== 'approved' || referrerProfile.status !== 'active') {
      return NextResponse.json({ 
        message: 'This referral code is no longer active. Please request a new one from the referrer.' 
      }, { status: 400 });
    }
    
    // Prevent self-referral
    if (referrerProfile.email === email) {
      return NextResponse.json({ 
        message: 'Self-referral is not allowed. Please use a different referral code.' 
      }, { status: 400 });
    }

    // 4. Create New User Profile
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = randomUUID();
    const newUserReferralId = await generateUniqueReferralId();

    const newProfileData = {
      _id: newUserId,
      username,
      email,
      phone_number: formattedPhone,
      password: hashedPassword, 
      referral_id: newUserReferralId,
      // CRITICAL FIX: Set referred_by to link the referrer
      referred_by: referrerProfile ? referrerProfile._id : null,
      // Set initial status as pending approval
      approval_status: 'pending',
      status: 'pending',
      is_approved: false,
      is_active: false,
      is_verified: false,
    };

    console.log('Creating user with data:', {
      email: newProfileData.email,
      username: newProfileData.username,
      referral_id: newUserReferralId,
      hasReferrer: !!referrerProfile,
      referrerId: referrerProfile?._id,
      referrerUsername: referrerProfile?.username
    });

    const newUser = await Profile.create(newProfileData);

    // Verify the user was created
    const createdUser = await Profile.findById(newUser._id);
    console.log('User created successfully:', {
      id: createdUser._id,
      username: createdUser.username,
      referral_id: createdUser.referral_id,
      referred_by: createdUser.referred_by,
      referrer_id: referrerProfile?._id
    });

    // 5. Generate verification token and send email
    // Email verification is no longer required - users proceed directly to login and activation

    // 6. Create Referral, Downline entries and build network structure if applicable
    if (referrerProfile) {
      try {
        // Create referral record
        const referralRecord = await Referral.create({
          referrer_id: referrerProfile._id,
          referred_id: newUser._id,
          earning_cents: 0 // Will be updated when user pays activation and gets approved
        });

        console.log('Referral record created:', referralRecord._id);

        // Build the complete downline structure for multi-level commissions
        await CommissionService.buildDownlineStructure(newUser._id, referrerProfile._id);

        console.log('Downline structure built for user:', newUser._id);
        console.log('Downline structure built successfully');

        // Send notification to referrer (you can implement this later)
        // await sendReferralNotification(referrerProfile, newUser);

      } catch (referralError) {
        console.error('Error creating referral structure:', referralError);
        // Don't fail registration if referral creation fails, just log it
        // The user should still be able to register
      }
    }

    // 7. Success Response - No email verification required, proceed directly to login/activation
    return NextResponse.json(
      {
        message: 'Registration successful! You can now log in and proceed to activation.', 
        user_id: newUser._id,
        referral_id: newUserReferralId,
        requires_approval: false,
        requires_activation_payment: true,
        next_steps: [
          'Log in to your account',
          'Pay KES 95 activation fee to activate your account',
          'Start earning from referrals'
        ]
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration API Error:', error);

    if (error instanceof Error && (error as any).code === 11000) {
      const key = Object.keys((error as any).keyValue)[0];
      return NextResponse.json(
        { message: `${key} is already registered.` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Internal Server Error during registration. Please check server logs.' },
      { status: 500 }
    );
  }
}

/**
 * Generate a unique referral ID with collision check
 */
async function generateUniqueReferralId(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const referralId = generateReferralId();
    const existingProfile = await Profile.findOne({ referral_id: referralId });
    
    if (!existingProfile) {
      return referralId;
    }
    
    attempts++;
    console.log(`Referral ID collision detected, generating new one. Attempt: ${attempts}`);
  }

  // If we still have collisions after max attempts, use a different approach
  const fallbackId = `U${Date.now().toString().slice(-7)}`;
  console.log(`Using fallback referral ID: ${fallbackId}`);
  return fallbackId;
}
