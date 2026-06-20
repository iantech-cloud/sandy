'use server';

import { revalidatePath } from 'next/cache';
import { 
  connectToDatabase, 
  Profile, 
  Withdrawal, 
  Transaction, 
  Company,
  Referral,
  AdminAuditLog,
  SpinSettings,
  Earning,
} from '../lib/models';
import { auth } from '@/auth'; 

// Updated interface with comprehensive financial metrics
interface AdminStats {
  // User Metrics
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  todayRegistrations: number;
  
  // Transaction Metrics
  totalUserTransactions: number;
  totalCompanyTransactions: number;
  
  // Financial Metrics - COMPANY
  companyWalletBalance: number;
  totalCompanyRevenue: number;
  totalCompanyExpenses: number;
  netProfit: number;
  
  // Financial Metrics - LIABILITIES
  totalUserBalances: number;
  pendingWithdrawalsAmount: number;
  pendingWithdrawalsCount: number;
  
  // Revenue Breakdown
  revenueBreakdown: {
    activationFees: number;
    unclaimedReferrals: number;
    spinCosts: number;
    contentPayments: number;
    otherRevenue: number;
  };
  
  // Expense Breakdown
  expenseBreakdown: {
    userPayouts: number;
    bonuses: number;
    referralCommissions: number;
    spinPrizes: number;
    taskPayments: number;
    surveyPayments: number;
    otherExpenses: number;
  };
  
  // Other Metrics
  totalReferrals: number;
  spinWheelActive: boolean;
  spinWheelMode: 'manual' | 'scheduled';
}

// Cache for admin stats with 60-second TTL
const statsCache: { data: AdminStats; timestamp: number } | null = null;

export async function getAdminStats(): Promise<{ 
  success: boolean; 
  data?: AdminStats; 
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    // Check cache first (60-second TTL)
    if (statsCache && Date.now() - statsCache.timestamp < 60000) {
      console.log('[v0] Admin stats loaded from cache');
      return { success: true, data: statsCache.data, message: 'Loaded from cache' };
    }

    const cacheStartTime = Date.now();
    await connectToDatabase();
    
    const adminUser = await (Profile as any).findOne({ email: session.user.email }).select('role').lean();
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));

    // Get or create company record
    let company = await (Company as any).findOne({});
    if (!company) {
      company = await (Company as any).create({
        name: 'HustleHub Africa Ltd',
        email: 'company@hustlehubafrica.com',
        wallet_balance_cents: 0,
        total_revenue_cents: 0,
        total_expenses_cents: 0
      });
    }

    // Execute all queries in parallel
    const [
      totalUsers,
      pendingApprovals,
      activeUsers,
      todayRegistrations,
      pendingWithdrawals,
      totalReferrals,
      spinSettings,
      userTransactionCount,
      companyTransactionCount,
      
      // Company Revenue Queries (completed transactions with target_type: 'company')
      companyRevenueTransactions,
      
      // Company Expense Queries (completed transactions from company to users)
      companyExpenseTransactions,
      
      // User Balance Aggregation (total liability)
      userBalancesAgg,
      
      // Pending Withdrawals Amount
      pendingWithdrawalsAgg
      
    ] = await Promise.all([
      // User counts
      (Profile as any).countDocuments(),
      (Profile as any).countDocuments({ approval_status: 'pending' }),
      (Profile as any).countDocuments({ 
        approval_status: 'approved', 
        status: 'active',
        is_active: true 
      }),
      (Profile as any).countDocuments({
        created_at: { $gte: startOfToday }
      }),
      (Withdrawal as any).countDocuments({ status: 'pending' }),
      (Referral as any).countDocuments(),
      (SpinSettings as any).findOne({}),
      
      // Transaction counts by target type
      (Transaction as any).countDocuments({ 
        $or: [
          { target_type: 'user' },
          { target_type: { $exists: false } } // Old transactions without target_type
        ]
      }),
      (Transaction as any).countDocuments({ target_type: 'company' }),
      
      // Company Revenue: All completed transactions TO company
      (Transaction as any).find({
        target_type: 'company',
        status: 'completed'
      }).lean(),
      
      // Company Expenses: All completed payout transactions FROM company TO users
      (Transaction as any).find({
        target_type: 'user',
        status: 'completed',
        type: { 
          $in: [
            'BONUS', 
            'TASK_PAYMENT', 
            'SPIN_WIN', 
            'REFERRAL', 
            'SURVEY',
            'WITHDRAWAL'
          ] 
        }
      }).lean(),
      
      // Total user balances (company liability)
      (Profile as any).aggregate([
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$balance_cents' } 
          } 
        }
      ]),
      
      // Pending withdrawals amount
      (Withdrawal as any).aggregate([
        { 
          $match: { status: 'pending' } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$amount_cents' } 
          } 
        }
      ])
    ]);

    // Calculate Revenue Breakdown
    let activationFees = 0;
    let unclaimedReferrals = 0;
    let spinCosts = 0;
    let contentPayments = 0;
    let otherRevenue = 0;

    for (const txn of companyRevenueTransactions) {
      const amount = txn.amount_cents;
      
      switch (txn.type) {
        case 'ACTIVATION_FEE':
        case 'ACCOUNT_ACTIVATION':
        case 'COMPANY_REVENUE':
          // Check metadata to determine subcategory
          if (txn.metadata?.source === 'unclaimed_referral') {
            unclaimedReferrals += amount;
          } else if (txn.metadata?.source === 'activation') {
            activationFees += amount;
          } else {
            activationFees += amount; // Default to activation fees
          }
          break;
        
        case 'SPIN_COST':
          spinCosts += amount;
          break;
        
        default:
          // Check description for content-related revenue
          if (txn.description?.toLowerCase().includes('content')) {
            contentPayments += amount;
          } else {
            otherRevenue += amount;
          }
      }
    }

    const totalCompanyRevenue = activationFees + unclaimedReferrals + spinCosts + contentPayments + otherRevenue;

    // Calculate Expense Breakdown
    let userPayouts = 0;
    let bonuses = 0;
    let referralCommissions = 0;
    let spinPrizes = 0;
    let taskPayments = 0;
    let surveyPayments = 0;
    let otherExpenses = 0;

    for (const txn of companyExpenseTransactions) {
      const amount = txn.amount_cents;
      
      switch (txn.type) {
        case 'WITHDRAWAL':
          userPayouts += amount;
          break;
        case 'BONUS':
          bonuses += amount;
          break;
        case 'REFERRAL':
          referralCommissions += amount;
          break;
        case 'SPIN_WIN':
        case 'SPIN_PRIZE':
          spinPrizes += amount;
          break;
        case 'TASK_PAYMENT':
          taskPayments += amount;
          break;
        case 'SURVEY':
          surveyPayments += amount;
          break;
        default:
          otherExpenses += amount;
      }
    }

    const totalCompanyExpenses = userPayouts + bonuses + referralCommissions + 
                                  spinPrizes + taskPayments + surveyPayments + otherExpenses;

    // Calculate net profit
    const netProfit = totalCompanyRevenue - totalCompanyExpenses;

    // Get total user balances and pending withdrawals
    const totalUserBalances = userBalancesAgg[0]?.total || 0;
    const pendingWithdrawalsAmount = pendingWithdrawalsAgg[0]?.total || 0;

    // Construct comprehensive stats
    const stats: AdminStats = {
      // User Metrics
      totalUsers,
      activeUsers,
      pendingApprovals,
      todayRegistrations,
      
      // Transaction Metrics
      totalUserTransactions: userTransactionCount,
      totalCompanyTransactions: companyTransactionCount,
      
      // Financial Metrics - COMPANY
      companyWalletBalance: company.wallet_balance_cents,
      totalCompanyRevenue: totalCompanyRevenue,
      totalCompanyExpenses: totalCompanyExpenses,
      netProfit: netProfit,
      
      // Financial Metrics - LIABILITIES
      totalUserBalances: totalUserBalances,
      pendingWithdrawalsAmount: pendingWithdrawalsAmount,
      pendingWithdrawalsCount: pendingWithdrawals,
      
      // Revenue Breakdown
      revenueBreakdown: {
        activationFees,
        unclaimedReferrals,
        spinCosts,
        contentPayments,
        otherRevenue
      },
      
      // Expense Breakdown
      expenseBreakdown: {
        userPayouts,
        bonuses,
        referralCommissions,
        spinPrizes,
        taskPayments,
        surveyPayments,
        otherExpenses
      },
      
      // Other Metrics
      totalReferrals,
      spinWheelActive: spinSettings?.is_active || false,
      spinWheelMode: spinSettings?.activation_mode || 'scheduled'
    };

    // Update cache
    const queryDuration = Date.now() - cacheStartTime;
    console.log(`[v0] Admin stats query completed in ${queryDuration}ms`);
    
    // Cache would be updated here in production (use Redis or in-memory store)
    // For now, returning stats with performance info
    
    return { success: true, data: stats, message: `Stats fetched successfully (${queryDuration}ms)` };

  } catch (error) {
    console.error('Admin stats error:', error);
    return { success: false, message: 'Failed to fetch admin statistics' };
  }
}

export async function toggleSpinWheel(activate: boolean): Promise<{ 
  success: boolean; 
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    let spinSettings = await (SpinSettings as any).findOne({});
    
    if (!spinSettings) {
      spinSettings = new (SpinSettings as any)({
        is_active: activate,
        activation_mode: activate ? 'manual' : 'scheduled',
        scheduled_days: ['wednesday', 'friday'],
        start_time: '19:00',
        end_time: '22:00',
        spins_per_session: 3,
        spins_cost_per_spin: 100,
        last_activated_by: adminUser._id,
        last_activated_at: new Date()
      });
    } else {
      spinSettings.is_active = activate;
      spinSettings.activation_mode = activate ? 'manual' : 'scheduled';
      spinSettings.last_activated_by = adminUser._id;
      spinSettings.last_activated_at = new Date();
    }

    await spinSettings.save();

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: activate ? 'ACTIVATE_SPIN_WHEEL' : 'DEACTIVATE_SPIN_WHEEL',
      action_type: activate ? 'spin_wheel_activated' : 'spin_wheel_deactivated',
      target_type: 'SpinSettings',
      target_id: spinSettings._id.toString(),
      resource_type: 'spin_settings',
      resource_id: spinSettings._id.toString(),
      changes: { 
        is_active: activate,
        activation_mode: activate ? 'manual' : 'scheduled'
      },
      metadata: {
        previous_state: !activate,
        new_state: activate
      },
      ip_address: 'server-action',
      user_agent: 'server-action',
      spin_related: {
        activation_mode: activate ? 'manual' : 'scheduled'
      }
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');

    return { 
      success: true, 
      message: activate 
        ? 'Spin wheel activated manually' 
        : 'Spin wheel deactivated. Will follow schedule.'
    };

  } catch (error) {
    console.error('Toggle spin wheel error:', error);
    return { 
      success: false, 
      message: 'Failed to update spin wheel settings' 
    };
  }
}

export async function getSpinWheelStatus(): Promise<{ 
  success: boolean; 
  data?: {
    is_active: boolean;
    activation_mode: 'manual' | 'scheduled';
    scheduled_days: string[];
    start_time: string;
    end_time: string;
    last_activated_at?: Date;
    last_activated_by?: string;
  };
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const spinSettings = await (SpinSettings as any).findOne({});
    
    if (!spinSettings) {
      return {
        success: true,
        data: {
          is_active: false,
          activation_mode: 'scheduled',
          scheduled_days: ['wednesday', 'friday'],
          start_time: '19:00',
          end_time: '22:00'
        },
        message: 'Spin wheel status fetched successfully'
      };
    }

    return {
      success: true,
      data: {
        is_active: spinSettings.is_active,
        activation_mode: spinSettings.activation_mode,
        scheduled_days: spinSettings.scheduled_days,
        start_time: spinSettings.start_time,
        end_time: spinSettings.end_time,
        last_activated_at: spinSettings.last_activated_at,
        last_activated_by: spinSettings.last_activated_by?.toString()
      },
      message: 'Spin wheel status fetched successfully'
    };

  } catch (error) {
    console.error('Get spin wheel status error:', error);
    return { success: false, message: 'Failed to get spin wheel status' };
  }
}

export async function updateSpinSchedule(settings: {
  scheduled_days: string[];
  start_time: string;
  end_time: string;
}): Promise<{ 
  success: boolean; 
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    let spinSettings = await (SpinSettings as any).findOne({});
    
    if (!spinSettings) {
      spinSettings = new (SpinSettings as any)({
        ...settings,
        is_active: false,
        activation_mode: 'scheduled',
        spins_per_session: 3,
        spins_cost_per_spin: 100
      });
    } else {
      spinSettings.scheduled_days = settings.scheduled_days;
      spinSettings.start_time = settings.start_time;
      spinSettings.end_time = settings.end_time;
    }

    spinSettings.last_activated_by = adminUser._id;
    spinSettings.last_activated_at = new Date();

    await spinSettings.save();

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'UPDATE_SPIN_SCHEDULE',
      action_type: 'spin_settings_update',
      target_type: 'SpinSettings',
      target_id: spinSettings._id.toString(),
      resource_type: 'spin_settings',
      resource_id: spinSettings._id.toString(),
      changes: settings,
      metadata: {
        scheduled_days: settings.scheduled_days,
        time_range: `${settings.start_time} - ${settings.end_time}`
      },
      ip_address: 'server-action',
      user_agent: 'server-action',
      spin_related: {
        scheduled_days: settings.scheduled_days as any
      }
    });

    revalidatePath('/admin');

    return { success: true, message: 'Spin schedule updated successfully' };

  } catch (error) {
    console.error('Update spin schedule error:', error);
    return { success: false, message: 'Failed to update spin schedule' };
  }
}

export async function getAdminUsers(filters?: {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  search?: string;
}): Promise<{ 
  success: boolean; 
  data?: any[]; 
  pagination?: any;
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters?.status && filters.status !== 'all') query.status = filters.status;
    if (filters?.role && filters.role !== 'all') query.role = filters.role;
    if (filters?.search) {
      query.$or = [
        { username: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { phone_number: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const users = await (Profile as any).find(query)
      .select('-password')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await (Profile as any).countDocuments(query);

    return {
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Users fetched successfully'
    };

  } catch (error) {
    console.error('Admin users error:', error);
    return { success: false, message: 'Failed to fetch users' };
  }
}

export async function approveUser(userId: string, approvalNotes?: string): Promise<{ 
  success: boolean; 
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    console.log(`[v0] Admin approval starting for user: ${userId}`);

    // Get the user first
    const userProfile = await (Profile as any).findById(userId);
    if (!userProfile) {
      return { success: false, message: 'User not found' };
    }

    // Update user status
    const user = await (Profile as any).findByIdAndUpdate(
      userId,
      {
        approval_status: 'approved',
        is_approved: true,
        status: 'active',
        approval_by: adminUser._id,
        approval_at: new Date(),
        approval_notes: approvalNotes
      },
      { new: true }
    );

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    console.log(`[v0] User profile updated: ${user.username}, now processing referral bonus...`);

    // CRITICAL FIX: Process referral bonus if user has a referrer
    if (userProfile.referred_by) {
      try {
        console.log(`[v0] User has referrer: ${userProfile.referred_by}`);
        
        const referrer = await (Profile as any).findById(userProfile.referred_by);
        
        if (referrer) {
          const referralRecord = await (Referral as any).findOne({
            referrer_id: referrer._id,
            referred_id: userProfile._id
          });

          console.log(`[v0] Referral record found: ${!!referralRecord}, bonus_paid: ${referralRecord?.referral_bonus_paid}`);

          if (referralRecord && !referralRecord.referral_bonus_paid) {
            // Award KES 70 referral bonus
            const REFERRAL_BONUS_CENTS = 7000; // KES 70

            // Create transaction
            const referralTransaction = new (Transaction as any)({
              target_type: 'user',
              target_id: referrer._id.toString(),
              user_id: referrer._id,
              amount_cents: REFERRAL_BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${userProfile.username}'s activation (Admin Approved)`,
              status: 'completed',
              source: 'admin_approval',
              balance_before_cents: referrer.balance_cents,
              balance_after_cents: referrer.balance_cents + REFERRAL_BONUS_CENTS,
              metadata: {
                referred_user_id: userProfile._id.toString(),
                referred_username: userProfile.username,
                level: 1,
                approved_by_admin: adminUser._id.toString()
              }
            });
            await referralTransaction.save();

            // Create earning record
            const earning = new Earning({
              user_id: referrer._id,
              amount_cents: REFERRAL_BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${userProfile.username}'s activation (Admin Approved)`,
              source_id: referralRecord._id,
              source_type: 'referral',
              transaction_id: referralTransaction._id,
              processed: true,
              processed_at: new Date(),
              metadata: {
                level: 1,
                referred_user_id: userProfile._id.toString(),
                bonus_amount: REFERRAL_BONUS_CENTS,
                approved_by_admin: adminUser._id.toString()
              }
            });
            await earning.save();

            // Update referrer balance
            referrer.balance_cents += REFERRAL_BONUS_CENTS;
            referrer.total_earnings_cents += REFERRAL_BONUS_CENTS;
            await referrer.save();

            // Update referral record
            referralRecord.referral_bonus_paid = true;
            referralRecord.referral_bonus_amount_cents = REFERRAL_BONUS_CENTS;
            referralRecord.bonus_paid_at = new Date();
            referralRecord.status = 'bonus_paid';
            referralRecord.referred_user_activated = true;
            referralRecord.referred_user_activated_at = new Date();
            referralRecord.metadata = {
              level: 1,
              bonus_amount: REFERRAL_BONUS_CENTS,
              activated_via: 'admin_approval',
              admin_id: adminUser._id.toString()
            };
            await referralRecord.save();

            console.log(`✅ Referral bonus awarded: ${referrer.username} earned KES 70`);
          }
        }
      } catch (referralError) {
        console.error('⚠️ Error processing referral bonus during admin approval:', referralError);
        // Don't fail the whole approval if referral bonus fails
      }
    }

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'APPROVE_USER',
      action_type: 'approve',
      target_type: 'Profile',
      target_id: userId,
      resource_type: 'user',
      resource_id: userId,
      changes: { 
        approval_status: 'approved', 
        status: 'active',
        is_approved: true
      },
      metadata: {
        approval_notes: approvalNotes
      },
      ip_address: 'server-action',
      user_agent: 'server-action'
    });

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/users');

    return { success: true, message: 'User approved successfully' };

  } catch (error) {
    console.error('Approve user error:', error);
    return { success: false, message: 'Failed to approve user' };
  }
}

export async function rejectUser(userId: string, rejectionReason: string): Promise<{ 
  success: boolean; 
  message: string 
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const user = await (Profile as any).findByIdAndUpdate(
      userId,
      {
        approval_status: 'rejected',
        is_approved: false,
        status: 'inactive',
        approval_by: adminUser._id,
        approval_at: new Date(),
        approval_notes: rejectionReason
      },
      { new: true }
    );

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'REJECT_USER',
      action_type: 'reject',
      target_type: 'Profile',
      target_id: userId,
      resource_type: 'user',
      resource_id: userId,
      changes: { 
        approval_status: 'rejected', 
        status: 'inactive',
        is_approved: false
      },
      metadata: {
        rejection_reason: rejectionReason
      },
      ip_address: 'server-action',
      user_agent: 'server-action'
    });

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/users');

    return { success: true, message: 'User rejected successfully' };

  } catch (error) {
    console.error('Reject user error:', error);
    return { success: false, message: 'Failed to reject user' };
  }
}

/**
 * Fix referral bonuses - Corrects KES amounts and ensures proper accounting
 * Fixes: Referrer gets KES 70 (7,000 cents), Company gets KES 20 (2,000 cents)
 */
export async function fixReferralBonuses(): Promise<{ success: boolean; message: string; data?: { fixed: number; skipped: number; created: number } }> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Not authenticated' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    console.log(`[v0] Starting referral bonus fix from admin: ${adminUser.username}`);

    // Get all referrals with bonuses paid but incorrect amounts
    const incorrectBonuses = await (Referral as any).find({
      referral_bonus_paid: true,
      referral_bonus_amount_cents: { $ne: 7000 } // Not KES 70
    }).lean();

    let fixedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    console.log(`[v0] Found ${incorrectBonuses.length} referrals with incorrect bonus amounts`);

    for (const referral of incorrectBonuses) {
      try {
        const referrer = await (Profile as any).findById(referral.referrer_id);
        const referred = await (Profile as any).findById(referral.referred_id);

        if (!referrer || !referred) {
          console.log(`[v0] Skipping referral - users not found`);
          skippedCount++;
          continue;
        }

        const oldAmount = referral.referral_bonus_amount_cents || 0;
        const newAmount = 7000; // KES 70
        const difference = newAmount - oldAmount;

        console.log(`[v0] Fixing: ${referrer.username} ← ${referred.username}, diff: KES ${difference / 100}`);

        // Update referral record
        await (Referral as any).findByIdAndUpdate(referral._id, {
          referral_bonus_amount_cents: newAmount,
          metadata: {
            ...referral.metadata,
            corrected_at: new Date().toISOString(),
            original_amount: oldAmount,
            correction_admin: adminUser._id.toString()
          }
        });

        // Find or create transaction
        const existingTransaction = await (Transaction as any).findOne({
          user_id: referrer._id,
          type: 'REFERRAL',
          'metadata.referral_id': referral._id.toString()
        });

        if (existingTransaction && difference !== 0) {
          // Update existing transaction
          existingTransaction.amount_cents = newAmount;
          existingTransaction.balance_after_cents = existingTransaction.balance_before_cents + newAmount;
          existingTransaction.metadata = {
            ...existingTransaction.metadata,
            corrected_at: new Date().toISOString(),
            original_amount: oldAmount
          };
          await existingTransaction.save();

          // Adjust referrer balance
          await (Profile as any).findByIdAndUpdate(referrer._id, {
            $inc: {
              balance_cents: difference,
              total_earnings_cents: difference
            }
          });

          fixedCount++;
        } else if (!existingTransaction) {
          // Create missing transaction
          await (Transaction as any).create({
            target_type: 'user',
            target_id: referrer._id.toString(),
            user_id: referrer._id,
            amount_cents: newAmount,
            type: 'REFERRAL',
            description: `Referral bonus for ${referred.username}'s activation [CORRECTED]`,
            status: 'completed',
            source: 'activation',
            balance_before_cents: referrer.balance_cents,
            balance_after_cents: referrer.balance_cents + newAmount,
            metadata: {
              referred_user_id: referred._id.toString(),
              referred_username: referred.username,
              referral_id: referral._id.toString(),
              level: 1,
              corrected: true,
              correction_admin: adminUser._id.toString()
            }
          });

          // Update referrer balance
          await (Profile as any).findByIdAndUpdate(referrer._id, {
            $inc: {
              balance_cents: newAmount,
              total_earnings_cents: newAmount
            }
          });

          createdCount++;
        }

      } catch (error) {
        console.error(`[v0] Error fixing referral:`, error);
        skippedCount++;
      }
    }

    // Create audit log
    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'FIX_REFERRAL_BONUSES',
      action_type: 'update',
      target_type: 'referral',
      resource_type: 'referral',
      changes: {
        fixed_count: fixedCount,
        created_count: createdCount,
        skipped_count: skippedCount,
        correct_amount: 7000
      },
      metadata: {
        bonus_amount_ksh: 70,
        company_fee_ksh: 20
      },
      ip_address: 'server-action',
      user_agent: 'server-action'
    });

    revalidatePath('/admin/referrals');
    revalidatePath('/admin/users');

    return {
      success: true,
      message: `Fixed ${fixedCount} bonuses, created ${createdCount} transactions, skipped ${skippedCount}`,
      data: {
        fixed: fixedCount,
        skipped: skippedCount,
        created: createdCount
      }
    };

  } catch (error) {
    console.error('Fix referral bonuses error:', error);
    return { success: false, message: 'Failed to fix referral bonuses' };
  }
}

/**
 * Fix missing referred_by field for a specific user
 * This restores the link between a referred user and their referrer
 */
export async function fixUserReferredBy(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Not authenticated' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    console.log(`[v0] Admin fixing referred_by for user: ${userId}`);

    // Get the user
    const user = await (Profile as any).findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Find referral record for this user
    const referralRecord = await (Referral as any).findOne({ referred_id: userId });
    if (!referralRecord) {
      return { success: false, message: `No referral record found for ${user.username}` };
    }

    // Check referrer exists
    const referrer = await (Profile as any).findById(referralRecord.referrer_id);
    if (!referrer) {
      return { success: false, message: 'Referrer not found' };
    }

    console.log(`[v0] Fixing ${user.username} - Setting referred_by to ${referrer.username}`);

    // Update user's referred_by field
    await (Profile as any).findByIdAndUpdate(userId, {
      referred_by: referrer._id
    });

    // If user is active and bonus not paid, award it now
    if (user.is_active && user.approval_status === 'approved' && !referralRecord.referral_bonus_paid) {
      console.log(`[v0] User is active but bonus not paid - awarding KES 70...`);

      const BONUS_CENTS = 7000;
      const Earning = require('@/app/lib/models').Earning;

      // Create transaction
      const transaction = new (Transaction as any)({
        target_type: 'user',
        target_id: referrer._id.toString(),
        user_id: referrer._id,
        amount_cents: BONUS_CENTS,
        type: 'REFERRAL',
        description: `Referral bonus for ${user.username}'s activation [Admin Fixed]`,
        status: 'completed',
        source: 'admin_fix',
        balance_before_cents: referrer.balance_cents,
        balance_after_cents: referrer.balance_cents + BONUS_CENTS,
        metadata: {
          referred_user_id: user._id.toString(),
          referred_username: user.username,
          level: 1,
          fixed_by_admin: adminUser._id.toString()
        }
      });
      await transaction.save();

      // Create earning record
      const earning = new (Earning as any)({
        user_id: referrer._id,
        amount_cents: BONUS_CENTS,
        type: 'REFERRAL',
        description: `Referral bonus for ${user.username} [Admin Fixed]`,
        source_id: referralRecord._id,
        source_type: 'referral',
        transaction_id: transaction._id,
        processed: true,
        processed_at: new Date(),
        metadata: {
          level: 1,
          referred_user_id: user._id.toString(),
          fixed_by_admin: adminUser._id.toString()
        }
      });
      await earning.save();

      // Update referrer balance
      referrer.balance_cents += BONUS_CENTS;
      referrer.total_earnings_cents += BONUS_CENTS;
      await referrer.save();

      // Update referral record
      referralRecord.referral_bonus_paid = true;
      referralRecord.referral_bonus_amount_cents = BONUS_CENTS;
      referralRecord.bonus_paid_at = new Date();
      referralRecord.status = 'bonus_paid';
      referralRecord.referred_user_activated = true;
      referralRecord.referred_user_activated_at = new Date();
      referralRecord.metadata = {
        level: 1,
        bonus_amount: BONUS_CENTS,
        activated_via: 'admin_fix',
        admin_id: adminUser._id.toString()
      };
      await referralRecord.save();

      console.log(`[v0] Bonus awarded: ${referrer.username} earned KES 70`);
    }

    revalidatePath('/admin/users');
    revalidatePath('/dashboard');

    return { success: true, message: `Fixed ${user.username} - referred_by restored to ${referrer.username}` };

  } catch (error) {
    console.error('Fix user referred_by error:', error);
    return { success: false, message: 'Failed to fix user' };
  }
}

/**
 * Update a single transaction status
 * Handles balance reversal if marking a completed transaction as failed
 */
export async function updateTransactionStatus(
  transactionId: string,
  newStatus: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout',
  reason?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const transaction = await (Transaction as any).findById(transactionId);
    if (!transaction) {
      return { success: false, message: 'Transaction not found' };
    }

    const oldStatus = transaction.status;

    // If marking a completed transaction as failed, reverse the balance
    if (oldStatus === 'completed' && newStatus === 'failed' && transaction.user_id) {
      try {
        const user = await (Profile as any).findById(transaction.user_id);
        if (user) {
          // Deduct the amount from user balance
          user.balance_cents = Math.max(0, user.balance_cents - transaction.amount_cents);
          await user.save();

          // Log the reversal
          transaction.balance_reversal_log = transaction.balance_reversal_log || [];
          transaction.balance_reversal_log.push({
            reversed_at: new Date(),
            reversed_by: adminUser._id,
            amount_reversed_cents: transaction.amount_cents,
            reason: reason || 'Manual reversal by admin'
          });

          console.log(`[v0] Reversed KES ${transaction.amount_cents / 100} from user ${user.username}`);
        }
      } catch (reversalError) {
        console.error('[v0] Error reversing balance:', reversalError);
        return { success: false, message: 'Failed to reverse user balance' };
      }
    }

    // Update transaction
    transaction.status = newStatus;
    transaction.balance_updated = true;
    transaction.admin_last_updated_by = adminUser._id;
    transaction.admin_last_updated_at = new Date();
    
    await transaction.save();

    // Log audit
    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'UPDATE_TRANSACTION',
      action_type: 'update',
      target_type: 'transaction',
      target_id: transactionId,
      resource_type: 'transaction',
      resource_id: transactionId,
      changes: { 
        status: { from: oldStatus, to: newStatus },
        reason: reason
      },
      metadata: {
        transaction_type: transaction.type,
        transaction_amount: transaction.amount_cents,
        user_id: transaction.user_id,
        balance_reversed: oldStatus === 'completed' && newStatus === 'failed'
      },
      ip_address: 'server-action',
      user_agent: 'server-action'
    });

    revalidatePath('/admin/transactions');

    return { 
      success: true, 
      message: `Transaction status updated from ${oldStatus} to ${newStatus}`,
      data: {
        transactionId,
        oldStatus,
        newStatus,
        balanceReversed: oldStatus === 'completed' && newStatus === 'failed'
      }
    };

  } catch (error) {
    console.error('Update transaction error:', error);
    return { success: false, message: 'Failed to update transaction' };
  }
}

/**
 * Bulk update multiple transactions
 */
export async function bulkUpdateTransactionStatus(
  transactionIds: string[],
  newStatus: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout',
  reason?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  data?: {
    updated: number;
    failed: number;
    results: any[];
  }
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, message: 'Unauthorized' };
    }

    await connectToDatabase();
    const adminUser = await (Profile as any).findOne({ email: session.user.email });
    
    if (adminUser?.role !== 'admin') {
      return { success: false, message: 'Admin access required' };
    }

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const transactionId of transactionIds) {
      try {
        const transaction = await (Transaction as any).findById(transactionId);
        if (!transaction) {
          results.push({ transactionId, success: false, message: 'Not found' });
          failCount++;
          continue;
        }

        const oldStatus = transaction.status;

        // Reverse balance if needed
        if (oldStatus === 'completed' && newStatus === 'failed' && transaction.user_id) {
          try {
            const user = await (Profile as any).findById(transaction.user_id);
            if (user) {
              user.balance_cents = Math.max(0, user.balance_cents - transaction.amount_cents);
              await user.save();

              transaction.balance_reversal_log = transaction.balance_reversal_log || [];
              transaction.balance_reversal_log.push({
                reversed_at: new Date(),
                reversed_by: adminUser._id,
                amount_reversed_cents: transaction.amount_cents,
                reason: reason || 'Bulk reversal by admin'
              });
            }
          } catch (reversalError) {
            console.error('[v0] Bulk reversal error for transaction:', transactionId, reversalError);
            results.push({ transactionId, success: false, message: 'Failed to reverse balance' });
            failCount++;
            continue;
          }
        }

        // Update transaction
        transaction.status = newStatus;
        transaction.balance_updated = true;
        transaction.admin_last_updated_by = adminUser._id;
        transaction.admin_last_updated_at = new Date();
        await transaction.save();

        results.push({ 
          transactionId, 
          success: true, 
          oldStatus, 
          newStatus,
          balanceReversed: oldStatus === 'completed' && newStatus === 'failed'
        });
        successCount++;

      } catch (itemError) {
        console.error('[v0] Error updating transaction:', transactionId, itemError);
        results.push({ transactionId, success: false, message: 'Update failed' });
        failCount++;
      }
    }

    // Log bulk operation
    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: 'UPDATE_TRANSACTION',
      action_type: 'update',
      target_type: 'transaction',
      target_id: `bulk_${Date.now()}`,
      resource_type: 'transaction',
      resource_id: `bulk_${Date.now()}`,
      changes: { 
        count: transactionIds.length,
        newStatus,
        reason
      },
      metadata: {
        bulk_operation: true,
        updated_count: successCount,
        failed_count: failCount,
        total_count: transactionIds.length
      },
      ip_address: 'server-action',
      user_agent: 'server-action'
    });

    revalidatePath('/admin/transactions');

    return {
      success: successCount > 0,
      message: `Updated ${successCount} transaction(s), ${failCount} failed`,
      data: {
        updated: successCount,
        failed: failCount,
        results
      }
    };

  } catch (error) {
    console.error('Bulk update transactions error:', error);
    return { success: false, message: 'Bulk update failed' };
  }
}
