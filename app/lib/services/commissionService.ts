import { connectToDatabase, Profile, Referral, DownlineUser, Transaction, ActivationPayment } from '@/app/lib/models';

// Commission configuration - Fixed to proper values
// KES amounts are converted to cents (multiply by 100)
// Commission configuration - Fixed to proper values
// KES amounts are converted to cents (multiply by 100)
export const COMMISSION_CONFIG = {
  // Activation fee: KES 95 total
  activationFee: 9500,        // KES 95  — total collected from user
  level1: 6500,               // KES 65  — credited to direct referrer (L1)
  level2: 1000,               // KES 10  — credited to grandparent referrer (L2)
  companyFee: 2000,           // KES 20  — kept by platform (95 - 65 - 10 = 20)
  unclaimedReferral: 6500,    // KES 65  — goes to company if L1 not present

  // Chat foreigners unlock fee: KES 100 total
  chatUnlockFee: 10000,       // KES 100 — total collected from user
  chatLevel1: 7000,           // KES 70  — credited to direct referrer (L1)
  chatLevel2: 1000,           // KES 10  — credited to grandparent referrer (L2)
  chatCompanyFee: 2000,       // KES 20  — kept by platform (100 - 70 - 10 = 20)
};

export class CommissionService {
  /**
   * Process referral commissions when a user gets approved
   */
  static async processReferralCommissions(approvedUserId: string) {
    await connectToDatabase();

    try {
      const approvedUser = await Profile.findById(approvedUserId);
      if (!approvedUser) {
        throw new Error('Approved user not found');
      }

      // Check if user paid activation fee
      const activationPayment = await ActivationPayment.findOne({
        user_id: approvedUserId,
        status: 'completed'
      });

      if (!activationPayment) {
        console.log(`User ${approvedUserId} hasn't paid activation fee, skipping commissions`);
        return;
      }

      // Find the direct referral record
      const directReferral = await Referral.findOne({
        referred_id: approvedUserId
      }).populate('referrer_id');

      if (!directReferral || !directReferral.referrer_id) {
        console.log(`No direct referrer found for user ${approvedUserId}`);
        return;
      }

      const directReferrer = directReferral.referrer_id;
      
      // Process direct referral commission only (single level system)
      const directCommission = await this.processDirectReferralCommission(
        directReferrer, 
        approvedUser,
        directReferral
      );

      console.log(`Successfully processed commissions for approved user: ${approvedUserId}`);
      
      return {
        success: true,
        directCommission,
        message: 'Commissions processed successfully'
      };
      
    } catch (error) {
      console.error('Error processing referral commissions:', error);
      throw error;
    }
  }

  /**
   * Process direct referral commission (Level 1)
   * KES 70 per direct referral
   */
  private static async processDirectReferralCommission(
    referrer: any, 
    referredUser: any,
    referralRecord: any
  ) {
    const commissionAmount = COMMISSION_CONFIG.level1;

    // Update referral record
    await Referral.findByIdAndUpdate(referralRecord._id, {
      earning_cents: commissionAmount,
      referral_bonus_paid: true,
      referral_bonus_amount_cents: commissionAmount,
      bonus_paid_at: new Date(),
      status: 'bonus_paid',
      referred_user_activated: true,
      referred_user_activated_at: new Date(),
      metadata: {
        level: 1,
        commission_amount: commissionAmount
      }
    });

    // Create transaction for referrer
    const transaction = await Transaction.create({
      target_type: 'user',
      target_id: referrer._id.toString(),
      user_id: referrer._id,
      amount_cents: commissionAmount,
      type: 'REFERRAL',
      description: `Direct referral commission for ${referredUser.username}'s activation (KES 70)`,
      status: 'completed',
      source: 'activation',
      balance_before_cents: referrer.balance_cents,
      balance_after_cents: referrer.balance_cents + commissionAmount,
      metadata: {
        referredUser: referredUser._id.toString(),
        referred_username: referredUser.username,
        level: 1
      }
    });

    // Update referrer's balance and total earnings
    await Profile.findByIdAndUpdate(referrer._id, {
      $inc: {
        balance_cents: commissionAmount,
        total_earnings_cents: commissionAmount
      }
    });

    // Update user activation status
    await Profile.findByIdAndUpdate(referredUser._id, {
      activation_status: 'activated'
    });

    console.log(`[v0] Direct referral commission processed: ${referrer.username} earned KES 70`);

    return {
      referrer_id: referrer._id,
      referrer_username: referrer.username,
      amount_cents: commissionAmount,
      transaction_id: transaction._id,
      level: 1
    };
  }

  /**
   * Process Level 2 downline commission (KES 10 for indirect referrals)
   * Only processes if the direct referrer also has a referrer
   */
  private static async processLevel1Commission(
    directReferrer: any,
    newUser: any
  ) {
    // Check if the direct referrer has a referrer (level 2 upline)
    if (!directReferrer.referred_by) {
      console.log('[v0] No level 2 upline found, skipping level 2 commission');
      return null;
    }

    try {
      const level2Referrer = await Profile.findById(directReferrer.referred_by);
      
      if (!level2Referrer) {
        console.log('[v0] Level 2 referrer not found');
        return null;
      }

      const commissionAmount = COMMISSION_CONFIG.level2;

      // Create transaction for level 2 referrer
      const transaction = await Transaction.create({
        target_type: 'user',
        target_id: level2Referrer._id.toString(),
        user_id: level2Referrer._id,
        amount_cents: commissionAmount,
        type: 'REFERRAL',
        description: `Level 2 indirect referral commission for ${newUser.username}'s activation (via ${directReferrer.username})`,
        status: 'completed',
        source: 'activation',
        balance_before_cents: level2Referrer.balance_cents,
        balance_after_cents: level2Referrer.balance_cents + commissionAmount,
        metadata: {
          referredUser: newUser._id.toString(),
          referred_username: newUser.username,
          direct_referrer_id: directReferrer._id.toString(),
          direct_referrer_username: directReferrer.username,
          level: 2
        }
      });

      // Update level 2 referrer's balance and total earnings
      await Profile.findByIdAndUpdate(level2Referrer._id, {
        $inc: {
          balance_cents: commissionAmount,
          total_earnings_cents: commissionAmount
        }
      });

      console.log(`[v0] Level 2 indirect referral commission processed: ${level2Referrer.username} earned KES 10`);

      return {
        referrer_id: level2Referrer._id,
        referrer_username: level2Referrer.username,
        amount_cents: commissionAmount,
        transaction_id: transaction._id,
        level: 2
      };

    } catch (error) {
      console.error('[v0] Error processing level 2 commission:', error);
      return null;
    }
  }

  /**
   * Get upline chain up to specified depth
   * Note: Only used for level 1 now, but kept for potential future use
   */
  private static async getUplineChain(userId: string, maxDepth: number = 1): Promise<any[]> {
    const uplineChain: any[] = [];
    let currentUserId = userId;
    let depth = 0;

    while (depth < maxDepth) {
      const user = await Profile.findById(currentUserId);
      
      if (!user || !user.referred_by) {
        break;
      }

      const uplineUser = await Profile.findById(user.referred_by);
      
      if (!uplineUser) {
        break;
      }

      uplineChain.push(uplineUser);
      currentUserId = uplineUser._id;
      depth++;
    }

    return uplineChain;
  }

  /**
   * Build downline structure when a new user is referred
   * Now only builds Level 1 relationships
   */
  static async buildDownlineStructure(referredUserId: string, referrerId: string) {
    await connectToDatabase();

    try {
      // Create direct downline relationship (Level 1)
      await DownlineUser.create({
        main_user_id: referrerId,
        downline_user_id: referredUserId,
        level: 1
      });

      // Get level 1 upline (referrer's referrer) for indirect downline
      const referrerProfile = await Profile.findById(referrerId);
      
      if (referrerProfile && referrerProfile.referred_by) {
        // Create level 2 downline relationship
        await DownlineUser.create({
          main_user_id: referrerProfile.referred_by,
          downline_user_id: referredUserId,
          level: 2
        });
      }

      console.log(`✅ Downline structure built for user: ${referredUserId}`);
      
      return {
        success: true,
        message: 'Downline structure created successfully'
      };
      
    } catch (error) {
      console.error('Error building downline structure:', error);
      throw error;
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId: string) {
    await connectToDatabase();

    try {
      // Count activated direct referrals
      const activatedDirectReferrals = await Referral.countDocuments({
        referrer_id: userId,
        referral_bonus_paid: true,
        'metadata.level': 0
      });

      // Count total direct referrals
      const totalDirectReferrals = await Referral.countDocuments({
        referrer_id: userId
      });

      // Calculate earnings by tier
      const first2Referrals = Math.min(activatedDirectReferrals, 2);
      const subsequentReferrals = Math.max(0, activatedDirectReferrals - 2);

      const first2Earnings = first2Referrals * COMMISSION_CONFIG.directReferralFirst2;
      const subsequentEarnings = subsequentReferrals * COMMISSION_CONFIG.directReferralSubsequent;

      // Get level 1 earnings
      const level1Transactions = await Transaction.find({
        user_id: userId,
        type: 'REFERRAL',
        'metadata.level': 1
      });

      const level1Earnings = level1Transactions.reduce(
        (sum, tx) => sum + tx.amount_cents, 
        0
      );

      return {
        success: true,
        data: {
          totalDirectReferrals,
          activatedDirectReferrals,
          first2Referrals,
          subsequentReferrals,
          first2Earnings,
          subsequentEarnings,
          level1Earnings,
          totalEarnings: first2Earnings + subsequentEarnings + level1Earnings
        }
      };

    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        success: false,
        message: 'Failed to get referral statistics'
      };
    }
  }

  /**
   * Calculate potential company revenue from activation
   */
  static calculateCompanyRevenue(hasReferrer: boolean, isFirst2: boolean): number {
    if (!hasReferrer) {
      return COMMISSION_CONFIG.activationFee; // Full amount
    }

    const directBonus = isFirst2 
      ? COMMISSION_CONFIG.directReferralFirst2 
      : COMMISSION_CONFIG.directReferralSubsequent;
    
    const level1Bonus = COMMISSION_CONFIG.level1;

    return COMMISSION_CONFIG.activationFee - directBonus - level1Bonus;
  }
}
