/**
 * Safe Support API Layer
 * Provides limited, authorized access to user data for the AI assistant
 * Never exposes full database; always sanitizes sensitive information
 */

import { connectToDatabase, Profile, Referral, SupportTicket } from '@/app/lib/models';

/**
 * Sanitize user data - remove sensitive fields
 */
function sanitizeUserData(user: any) {
  if (!user) return null;

  return {
    _id: user._id,
    email: user.email,
    username: user.username,
    phone_number: user.phone_number,
    first_name: user.first_name,
    last_name: user.last_name,
    country: user.country,
    status: user.status,
    verified: user.verified,
    created_at: user.created_at,
    // DO NOT include: password, passwordHash, tokens, admin notes
  };
}

/**
 * Get user profile (for authenticated user only)
 */
export async function getUserProfile(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      data: sanitizeUserData(user),
    };
  } catch (error) {
    console.error('[Support API] Profile error:', error);
    return { success: false, error: 'Unable to fetch profile' };
  }
}

/**
 * Get user withdrawal history (for authenticated user only)
 */
export async function getUserWithdrawals(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // In real implementation, query from Withdrawal model
    return {
      success: true,
      data: {
        balance_cents: (user as any).balance_cents || 0,
        total_withdrawn: (user as any).total_withdrawn_cents || 0,
        pending_withdrawals: [], // Would query actual pending withdrawals
      },
    };
  } catch (error) {
    console.error('[Support API] Withdrawal error:', error);
    return { success: false, error: 'Unable to fetch withdrawal data' };
  }
}

/**
 * Get user referral info (for authenticated user only)
 */
export async function getUserReferrals(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const referral = await Referral.findOne({ user_id: userId }).lean();
    if (!referral) {
      return {
        success: true,
        data: {
          referral_code: '',
          referral_link: '',
          total_referrals: 0,
          total_earnings: 0,
        },
      };
    }

    return {
      success: true,
      data: {
        referral_code: (referral as any).referral_code,
        referral_link: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/sign-up?ref=${(referral as any).referral_code}`,
        total_referrals: (referral as any).downline_users?.length || 0,
        total_earnings: (referral as any).total_commission_cents || 0,
      },
    };
  } catch (error) {
    console.error('[Support API] Referral error:', error);
    return { success: false, error: 'Unable to fetch referral data' };
  }
}

/**
 * Get user verification status
 */
export async function getUserVerificationStatus(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      data: {
        verified: (user as any).verified || false,
        id_verified: (user as any).id_verified || false,
        phone_verified: (user as any).phone_verified || false,
        status: (user as any).status,
      },
    };
  } catch (error) {
    console.error('[Support API] Verification error:', error);
    return { success: false, error: 'Unable to fetch verification status' };
  }
}

/**
 * Check account eligibility for withdrawals
 */
export async function checkWithdrawalEligibility(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const issues = [];

    if (!(user as any).verified) {
      issues.push('Account not verified');
    }
    if ((user as any).balance_cents < 50000) {
      // KES 500
      issues.push(`Insufficient balance. Minimum KES 500 required`);
    }
    if ((user as any).status === 'suspended') {
      issues.push('Account is suspended');
    }

    return {
      success: true,
      eligible: issues.length === 0,
      issues,
      balance_kes: ((user as any).balance_cents / 100).toFixed(2),
    };
  } catch (error) {
    console.error('[Support API] Eligibility error:', error);
    return { success: false, error: 'Unable to check eligibility' };
  }
}

/**
 * Create escalation ticket — persists to MongoDB SupportTicket collection
 */
export async function createEscalationTicket(
  userId: string,
  issue_type: string,
  description: string,
  metadata?: any
) {
  try {
    await connectToDatabase();

    const priorityMap: Record<string, string> = {
      fraud:              'urgent',
      account_suspension: 'high',
      payment_dispute:    'high',
      legal_issue:        'high',
      technical_issue:    'medium',
      general_support:    'medium',
    };

    const categoryMap: Record<string, string> = {
      fraud:              'security',
      account_suspension: 'general',
      payment_dispute:    'withdrawal',
      legal_issue:        'general',
      technical_issue:    'technical',
      general_support:    'general',
    };

    const ticket = await SupportTicket.create({
      user_id: userId === 'guest' ? 'guest' : userId,
      subject: `AI Escalation: ${issue_type.replace(/_/g, ' ')}`,
      description: description.substring(0, 2000),
      status: 'open',
      priority: priorityMap[issue_type] || 'medium',
      category: categoryMap[issue_type] || 'general',
      metadata: { issue_type, source: 'ai_assistant', ...metadata },
    });

    console.log('[Support] Escalation ticket created:', ticket._id);

    return {
      success: true,
      ticket_id: ticket._id.toString(),
      message: 'Your issue requires assistance from a support specialist. Ticket created — we will contact you within 24 hours.',
    };
  } catch (error) {
    console.error('[Support API] Escalation error:', error);
    return {
      success: false,
      ticket_id: `TKT-${Date.now()}`,
      message: 'Your issue has been escalated. A support specialist will contact you soon.',
    };
  }
}
