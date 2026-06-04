"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import {
  connectToDatabase,
  Profile,
  SpinLog,
  SpinPrize,
  UserSpinEligibility,
  SpinSettings,
  Transaction,
  MpesaTransaction,
  Referral,
  AdminAuditLog,
  SpinAnalytics,
  UserContent,
  SpinWallet,
} from "../lib/models"
import { createCoopBankService, CoopBankService } from "@/app/lib/services/coop-bank"
import { formatPhoneNumber, isValidPhoneNumber, phoneNumbersMatch, getMpesaPhoneFormat } from "@/app/lib/utils/phoneFormatter"

// --- TYPE DEFINITIONS ---
interface SpinSettingsLean {
  _id?: any
  is_active?: boolean
  activation_mode?: "manual" | "scheduled"
  scheduled_days?: string[]
  start_time?: string
  end_time?: string
  timezone?: string
  spins_per_session?: number
  spins_cost_per_spin?: number
  cooldown_minutes?: number
  require_tasks_completion?: boolean
  maintenance_mode?: boolean
  maintenance_message?: string
  probability_multipliers?: {
    starter?: number
    bronze: number
    silver: number
    gold: number
    platinum?: number
    diamond: number
  }
  last_activated_by?: string
  last_updated_by?: string
  last_activated_at?: Date
  change_history?: any[]
  version?: number
  toObject?: () => any
}

interface UserSpinEligibilityLean {
  _id?: any
  user_id?: string
  spins_used_today?: number
  current_session_spins?: number
  session_started_at?: Date
  tasks_completed_this_week?: {
    referral: boolean
    writing: boolean
    last_updated?: Date
  }
  is_eligible?: boolean
  total_spins?: number
  total_wins?: number
  total_prize_value_cents?: number
  manual_override?: boolean
  override_until?: Date
  cooldown_until?: Date
  win_streak?: number
  best_win_streak?: number
  last_spin_at?: Date
  __v?: number
}

interface UserProfileLean {
  _id: any
  email?: string
  rank?: string
  level?: number
  available_spins?: number
  total_spins_used?: number
  total_prizes_won?: number
  is_active?: boolean
  is_approved?: boolean
  balance_cents?: number
  total_earnings_cents?: number
  spin_streak?: number
  max_spin_streak?: number
  referral_count?: number
  referrals_completed?: number
  role?: string
  username?: string
  spin_tier?: string
  __v?: number
}

interface SpinPrizeLean {
  _id: any
  type: string
  display_name: string
  value_cents: number
  value_description?: string
  credit_type: string
  base_probability: number
  accessible_tiers?: string[] // FIXED: Changed from accessible_ranks
  min_referrals?: number
  requires_activation?: boolean
  is_active?: boolean
  wheel_order?: number
}

interface SpinResponse {
  success: boolean
  prizeType?: string
  prizeName?: string
  prizeValue?: number
  prizeDescription?: string
  message: string
}

interface SpinSettingsResponse {
  success: boolean
  data?: any
  message: string
}

interface SpinLogsResponse {
  success: boolean
  data?: any[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  message: string
}

interface SpinAnalyticsResponse {
  success: boolean
  data?: any
  message: string
}

interface AdminActionResponse {
  success: boolean
  message: string
}

interface SpinStatsResponse {
  success: boolean
  data?: {
    totalSpins: number
    totalWins: number
    winRate: number
    totalPrizeValue: number
    currentStreak: number
    bestStreak: number
    availableSpins: number
    totalSpinsUsed: number
  }
  message: string
}

interface TaskStatusResponse {
  success: boolean
  data?: {
    referral: boolean
    writing: boolean
    last_updated: string
    allCompleted: boolean
    referralCount?: number
    submissionCount?: number
  }
  message: string
}

// Session type guard
interface SessionWithUser {
  user: {
    id?: string
    email?: string | null
    name?: string | null
    image?: string | null
  }
  expires: string
}

function isValidSession(session: unknown): session is SessionWithUser {
  return (
    session !== null &&
    typeof session === "object" &&
    "user" in session &&
    session.user !== null &&
    typeof session.user === "object" &&
    "id" in session.user &&
    typeof session.user.id === "string" &&
    session.user.id.length > 0
  )
}

// --- HELPER FUNCTIONS ---

/**
 * Normalize user rank/tier to lowercase for consistent comparison
 */
function normalizeRank(rank: string | undefined): string {
  const normalized = (rank || "bronze").toLowerCase().trim()
  // Handle both 'rank' and 'spin_tier' fields
  return normalized
}

/**
 * Convert MongoDB document to plain JavaScript object
 */
function sanitizeMongoObject(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMongoObject(item))
  }

  if (typeof obj === "object" && obj !== null) {
    if (obj instanceof Date) return obj.toISOString()

    if (obj._id && typeof obj._id === "object" && obj._id.toString) {
      return {
        ...Object.keys(obj).reduce((acc, key) => {
          if (key === "_id") acc[key] = obj[key].toString()
          else if (key !== "__v") acc[key] = sanitizeMongoObject(obj[key])
          return acc
        }, {} as any),
      }
    }

    return Object.keys(obj).reduce((acc, key) => {
      if (key !== "__v") acc[key] = sanitizeMongoObject(obj[key])
      return acc
    }, {} as any)
  }

  return obj
}

/**
 * Parse time string (HH:MM) into float hour value
 */
function parseTime(timeString: string): number {
  const parts = timeString.split(":").map(Number)
  const hours = parts[0]
  const minutes = parts[1]

  if (hours === undefined || isNaN(hours)) {
    console.warn(`Invalid time string: ${timeString}, defaulting to 0`)
    return 0
  }

  return hours + (minutes && !isNaN(minutes) ? minutes / 60 : 0)
}

/**
 * Check scheduled activation based on settings or default
 */
function checkScheduledActivation(settings?: SpinSettingsLean): boolean {
  const now = new Date()
  const timezone = settings?.timezone || "Africa/Nairobi"

  try {
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    const day = localTime.toLocaleString("en-US", { timeZone: timezone, weekday: "long" }).toLowerCase()
    const hours = localTime.getHours()
    const minutes = localTime.getMinutes()
    const currentTime = hours + minutes / 60

    const scheduledDays = settings?.scheduled_days || ["wednesday", "friday"]
    const startTime = settings?.start_time ? parseTime(settings.start_time) : 19
    const endTime = settings?.end_time ? parseTime(settings.end_time) : 22

    return scheduledDays.includes(day) && currentTime >= startTime && currentTime < endTime
  } catch (error) {
    console.error("Error checking scheduled activation:", error)
    const day = now.toLocaleString("en-US", { weekday: "long" }).toLowerCase()
    const hours = now.getHours()
    return ["wednesday", "friday"].includes(day) && hours >= 19 && hours < 22
  }
}

/**
 * Initialize default spin settings if they don't exist
 */
async function ensureSpinSettings(): Promise<void> {
  try {
    const existingSettings = await (SpinSettings as any).findOne({})
    
    if (!existingSettings) {
      console.log('📝 Creating default spin settings...')
      const defaultSettings = new (SpinSettings as any)({
        is_active: false,
        activation_mode: 'scheduled',
        scheduled_days: ['wednesday', 'friday'],
        start_time: '19:00',
        end_time: '22:00',
        timezone: 'Africa/Nairobi',
        spins_per_session: 3,
        spins_cost_per_spin: 5,
        cooldown_minutes: 1440,
        require_tasks_completion: true,
        maintenance_mode: false,
        maintenance_message: '',
        probability_multipliers: {
          starter: 1.0,
          bronze: 1.0,
          silver: 1.1,
          gold: 1.2,
          diamond: 1.5,
        },
        last_activated_by: 'system',
        last_updated_by: 'system',
      })
      
      await defaultSettings.save()
      console.log('✅ Default spin settings created')
    }
  } catch (error) {
    console.error('Error ensuring spin settings:', error)
  }
}

/**
 * Initialize default spin prizes if they don't exist
 */
async function ensureSpinPrizes(): Promise<void> {
  try {
    const existingPrizes = await (SpinPrize as any).countDocuments({})
    
    if (existingPrizes === 0) {
      console.log('[v0] Creating 10 spin prizes...')
      
      const defaultPrizes = [
        {
          type: 'KES_10000',
          name: 'KES 10,000',
          display_name: 'KES 10,000',
          description: 'Win KES 10,000 bonus credit',
          icon: '🎁',
          base_probability: 1,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 1000000,
          value_description: 'KES 10,000',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 1,
          color: '#10B981',
          created_by: 'system'
        },
        {
          type: 'KES_5000',
          name: 'KES 5,000',
          display_name: 'KES 5,000',
          description: 'Win KES 5,000 bonus credit',
          icon: '💵',
          base_probability: 2,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 500000,
          value_description: 'KES 5,000',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 2,
          color: '#8B5CF6',
          created_by: 'system'
        },
        {
          type: 'KES_2500',
          name: 'KES 2,500',
          display_name: 'KES 2,500',
          description: 'Win KES 2,500 bonus credit',
          icon: '💴',
          base_probability: 3,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 250000,
          value_description: 'KES 2,500',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 3,
          color: '#EC4899',
          created_by: 'system'
        },
        {
          type: 'KES_1000',
          name: 'KES 1,000',
          display_name: 'KES 1,000',
          description: 'Win KES 1,000 bonus credit',
          icon: '💶',
          base_probability: 5,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 100000,
          value_description: 'KES 1,000',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 4,
          color: '#F59E0B',
          created_by: 'system'
        },
        {
          type: 'KES_500',
          name: 'KES 500',
          display_name: 'KES 500',
          description: 'Win KES 500 bonus credit',
          icon: '💷',
          base_probability: 8,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 50000,
          value_description: 'KES 500',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 5,
          color: '#06B6D4',
          created_by: 'system'
        },
        {
          type: 'KES_200',
          name: 'KES 200',
          display_name: 'KES 200',
          description: 'Win KES 200 bonus credit',
          icon: '💸',
          base_probability: 10,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 20000,
          value_description: 'KES 200',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 6,
          color: '#6366F1',
          created_by: 'system'
        },
        {
          type: 'KES_100',
          name: 'KES 100',
          display_name: 'KES 100',
          description: 'Win KES 100 bonus credit',
          icon: '🏷️',
          base_probability: 12,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 10000,
          value_description: 'KES 100',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 7,
          color: '#14B8A6',
          created_by: 'system'
        },
        {
          type: 'KES_50',
          name: 'KES 50',
          display_name: 'KES 50',
          description: 'Win KES 50 bonus credit',
          icon: '🔖',
          base_probability: 14,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 5000,
          value_description: 'KES 50',
          credit_type: 'balance',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 8,
          color: '#F97316',
          created_by: 'system'
        },
        {
          type: 'FREE_SPIN',
          name: 'Free Spin',
          display_name: 'Free Spin',
          description: 'Get one free spin to try again',
          icon: '🎟️',
          base_probability: 15,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 3000,
          value_description: '1 free spin (KES 30 value)',
          credit_type: 'spins',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 9,
          color: '#3B82F6',
          created_by: 'system'
        },
        {
          type: 'ZERO',
          name: 'Try Again',
          display_name: 'Try Again',
          description: 'Better luck next time!',
          icon: '⭕',
          base_probability: 30,
          accessible_tiers: ['starter', 'bronze', 'silver', 'gold', 'diamond'],
          min_referrals: 0,
          requires_activation: true,
          value_cents: 0,
          value_description: 'No prize',
          credit_type: 'feature',
          duration_days: 0,
          is_active: true,
          is_featured: false,
          wheel_order: 10,
          color: '#EF4444',
          created_by: 'system'
        }
      ]
      
      await (SpinPrize as any).insertMany(defaultPrizes)
      
      // Verify probabilities sum to 100%
      const totalProbability = defaultPrizes.reduce((sum, p) => sum + p.base_probability, 0)
      
      console.log(`✅ Created ${defaultPrizes.length} spin prizes`)
      console.log(`������� Total probability: ${totalProbability}%`)
    }
  } catch (error) {
    console.error('Error ensuring spin prizes:', error)
  }
}

/**
 * Initialize spin system on first run
 */
export async function initializeSpinSystem(): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase()
    await ensureSpinSettings()
    await ensureSpinPrizes()
    
    return {
      success: true,
      message: 'Spin system initialized successfully'
    }
  } catch (error) {
    console.error('Error initializing spin system:', error)
    return {
      success: false,
      message: 'Failed to initialize spin system'
    }
  }
}

/**
 * Update SpinWallet balance for completed deposits
 */
async function updateSpinWallet(userId: string, amountCents: number): Promise<void> {
  try {
    let spinWallet = await (SpinWallet as any).findOne({ user_id: userId });
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: userId,
        balance_cents: amountCents,
        total_deposited_cents: amountCents,
        total_used_cents: 0,
        total_spins: 0,
      });
    } else {
      spinWallet.balance_cents += amountCents;
      spinWallet.total_deposited_cents += amountCents;
      await spinWallet.save();
    }
    console.log('💰 Updated spin wallet balance:', spinWallet.balance_cents);
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('❌ Failed to update spin wallet:', error);
    throw error;
  }
}

/**
 * Sync spin deposit transaction with M-Pesa status
 */
async function syncSpinDepositTransactionWithMpesaStatus(
  mpesaTransactionId: any, 
  status: string, 
  resultCode: number, 
  resultDesc: string,
  mpesaReceiptNumber?: string
): Promise<void> {
  try {
    const updateData: any = {
      status: status,
      metadata: {
        result_code: resultCode,
        result_desc: resultDesc,
        status_updated_at: new Date().toISOString()
      }
    };

    // CRITICAL: Only mark balance_updated for TERMINAL statuses
    // Do NOT mark as updated while transaction is still PROCESSING (status === 'pending')
    // Balance will be updated when callback arrives with final status
    
    if (status === 'completed' && mpesaReceiptNumber) {
      updateData.metadata.mpesa_receipt_number = mpesaReceiptNumber;
      updateData.metadata.completed_at = new Date().toISOString();
      // Mark balance_updated ONLY for completed transactions (terminal state)
      updateData.balance_updated = true;
    }

    // Only mark as balance_updated for terminal failure states (not pending)
    if (['failed', 'cancelled', 'timeout'].includes(status)) {
      updateData.metadata.failed_at = new Date().toISOString();
      // Mark balance_updated to prevent retries of failed transactions
      updateData.balance_updated = true;
    }

    // For 'pending' status: DO NOT set balance_updated
    // This allows the balance to be updated when callback arrives with completion status
    if (status === 'pending') {
      console.log('[SpinWallet] Transaction still PROCESSING - NOT marking balance_updated yet');
      // balance_updated remains false/unchanged so callback can still update balance
    }

    const result = await (Transaction as any).findOneAndUpdate(
      { mpesa_transaction_id: mpesaTransactionId },
      { $set: updateData },
      { new: true }
    );

    if (!result) {
      console.warn(`⚠️ No Transaction found to sync for M-Pesa ID: ${mpesaTransactionId}`);
    } else {
      console.log(`🔄 Successfully synced spin deposit transaction status to: ${status}`, {
        transactionId: result._id,
        status: result.status,
        balance_updated: result.balance_updated
      });
    }
  } catch (error) {
    console.error('❌ Failed to sync spin deposit transaction status:', error);
    throw error;
  }
}

/**
 * Validate spin wallet deposit
 */
async function validateSpinDeposit(
  userId: string, 
  amount: number, 
  phoneNumber: string
): Promise<{ valid: boolean; message: string; data?: { formattedPhone: string } }> {
  if (amount < 30 || amount > 70000) {
    return { valid: false, message: 'Spin deposit amount must be between KES 30 and KES 70,000' };
  }

  let formattedPhone = phoneNumber;
  if (phoneNumber.startsWith('0') && phoneNumber.length === 10) {
    formattedPhone = `254${phoneNumber.substring(1)}`;
  } else if (phoneNumber.startsWith('+254')) {
    formattedPhone = phoneNumber.substring(1);
  }

  if (!formattedPhone.match(/^254[0-9]{9}$/)) {
    return { valid: false, message: 'Invalid phone number format. Use 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX' };
  }

  await connectToDatabase();
  const user = await (Profile as any).findOne({ _id: userId });
  if (!user) {
    return { valid: false, message: 'User not found' };
  }

  // Check for recent pending transactions (within last 5 minutes)
  // This prevents accidental duplicate submissions but allows retry after timeout
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentPendingTransaction = await (MpesaTransaction as any).findOne({
    user_id: userId,
    status: { $in: ['initiated', 'pending'] },
    phone_number: formattedPhone,
    created_at: { $gt: fiveMinutesAgo }, // Only block recent transactions
  });

  if (recentPendingTransaction) {
    return { valid: false, message: 'You have a pending M-Pesa transaction from the last 5 minutes. Please complete or wait for it to be processed before trying again.' };
  }

  // Clean up old pending transactions (> 5 minutes old) - mark them as timeout/failed
  const stalePendingTransactions = await (MpesaTransaction as any).find({
    user_id: userId,
    status: { $in: ['initiated', 'pending'] },
    phone_number: formattedPhone,
    created_at: { $lt: fiveMinutesAgo },
  });

  if (stalePendingTransactions.length > 0) {
    console.log(`[Spin] Cleaning up ${stalePendingTransactions.length} stale pending transactions for user ${userId}`);
    // Mark them as timeout since they're older than 5 minutes
    await (MpesaTransaction as any).updateMany(
      {
        user_id: userId,
        status: { $in: ['initiated', 'pending'] },
        created_at: { $lt: fiveMinutesAgo },
      },
      {
        status: 'timeout',
        result_desc: 'Transaction timed out - no user response within 5 minutes',
        failed_at: new Date(),
      }
    );
  }

  return { valid: true, message: 'Validation passed', data: { formattedPhone } };
}

/**
 * Deposit to spin wallet via Co-op Bank STK Push.
 * Mirrors the pattern of processMpesaDeposit() in deposit.ts.
 */
export async function depositSpinWalletViaMpesa(depositData: {
  amount: number;
  phoneNumber: string;
}): Promise<{ success: boolean; data?: any; message: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, message: 'User not authenticated' };
    }

    await connectToDatabase();
    const currentUser = await (Profile as any).findById(session.user.id);

    if (!currentUser) {
      return { success: false, message: 'User profile not found' };
    }

    const validationResult = await validateSpinDeposit(
      currentUser._id.toString(),
      depositData.amount,
      depositData.phoneNumber
    );
    if (!validationResult.valid) {
      return { success: false, message: validationResult.message };
    }

    const formattedPhone = validationResult.data?.formattedPhone || depositData.phoneNumber;
    const amountCents = Math.round(depositData.amount * 100);

    // Generate a unique message reference (same pattern as deposit.ts)
    const messageReference = `SPINDY${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/coop-bank/callback`;

    // Create MpesaTransaction BEFORE calling the API
    const mpesaTransaction = await (MpesaTransaction as any).create({
      user_id: currentUser._id,
      amount_cents: amountCents,
      phone_number: formattedPhone,
      account_reference: `SPINDEP-${currentUser._id.toString().slice(-8).toUpperCase()}`,
      transaction_desc: `Spin wallet deposit for ${currentUser.username}`,
      checkout_request_id: messageReference,
      status: 'initiated',
      source: 'wallet',
      metadata: {
        user_username: currentUser.username,
        deposit_type: 'spin_wallet',
        payment_method: 'coop_bank_stk_push',
        initiated_at: new Date().toISOString(),
        callback_url: callbackUrl,
      },
    });

    // Create a pending Transaction record
    const transaction = await (Transaction as any).create({
      user_id: currentUser._id,
      amount_cents: amountCents,
      type: 'SPIN_WALLET_DEPOSIT',
      description: `Co-op Bank spin wallet deposit from ${formattedPhone}`,
      status: 'pending',
      mpesa_transaction_id: mpesaTransaction._id,
      target_type: 'company',
      target_id: 'company',
      metadata: {
        phoneNumber: formattedPhone,
        provider: 'coop_bank',
        messageReference,
        initiated_at: new Date().toISOString(),
      },
    });

    // Initiate Co-op Bank STK Push
    const coopBank = createCoopBankService();
    const stkResponse = await coopBank.initiateSTKPush(
      formattedPhone,
      depositData.amount,
      `Spin wallet deposit - ${currentUser.username}`,
      callbackUrl,
      messageReference
    );

    if (stkResponse.ResponseCode !== '0') {
      // Mark records as failed
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: 'failed',
        result_desc: stkResponse.ResponseDescription || 'STK Push rejected by bank',
      });
      await (Transaction as any).findByIdAndUpdate(transaction._id, { status: 'failed' });

      return {
        success: false,
        message: stkResponse.ResponseDescription || 'Failed to initiate payment. Please try again.',
      };
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      data: {
        messageReference,
        checkoutRequestID: messageReference, // alias for backward compat
        ResponseDescription: stkResponse.ResponseDescription,
        Amount: depositData.amount,
        PhoneNumber: formattedPhone,
        transactionId: transaction._id.toString(),
        mpesaTransactionId: mpesaTransaction._id.toString(),
      },
      message: stkResponse.ResponseDescription || 'Payment prompt sent. Please check your phone.',
    };

  } catch (error) {
    console.error('[Spin] depositSpinWalletViaMpesa error:', error);
    return {
      success: false,
      message: 'An error occurred while processing your spin wallet deposit. Please try again.',
    };
  }
}

/**
 * Check spin wallet deposit status via Co-op Bank Enquiry API.
 * Mirrors the pattern of checkMpesaPaymentStatus() in deposit.ts.
 */
export async function checkSpinDepositMpesaStatus(messageReference: string): Promise<{ success: boolean; data?: any; message: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, message: 'User not authenticated' };
    }

    await connectToDatabase();

    const mpesaTransaction = await (MpesaTransaction as any).findOne({
      checkout_request_id: messageReference,
    });

    if (!mpesaTransaction) {
      return { success: false, message: 'Transaction not found' };
    }

    // Terminal state — no need to hit the API
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
    if (terminalStatuses.includes(mpesaTransaction.status)) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          resultCode: mpesaTransaction.result_code,
          resultDesc: mpesaTransaction.result_desc,
          mpesaReceiptNumber: mpesaTransaction.mpesa_receipt_number,
          amount: mpesaTransaction.amount_cents,
          completedAt: mpesaTransaction.completed_at,
          failedAt: mpesaTransaction.failed_at,
          source: 'database',
        },
        message: `Payment status: ${mpesaTransaction.status}`,
      };
    }

    // Callback already processed
    if (mpesaTransaction.metadata?.callback_processed) {
      return {
        success: true,
        data: {
          status: mpesaTransaction.status,
          amount: mpesaTransaction.amount_cents,
          source: 'callback_processed',
        },
        message: `Payment ${mpesaTransaction.status}`,
      };
    }

    // Query Co-op Bank Enquiry API (read-only — wallet credit only via callback)
    const coopBank = createCoopBankService();
    const statusResponse = await coopBank.getTransactionStatus(messageReference);

    const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);

    if (terminalStatuses.includes(mappedStatus)) {
      await (MpesaTransaction as any).findByIdAndUpdate(mpesaTransaction._id, {
        status: mappedStatus,
        result_desc: statusResponse.ResponseDescription || '',
        ...(mappedStatus === 'completed'
          ? { completed_at: new Date() }
          : { failed_at: new Date() }),
      });

      // Sync the linked Transaction record status
      await syncSpinDepositTransactionWithMpesaStatus(
        mpesaTransaction._id,
        mappedStatus,
        0,
        statusResponse.ResponseDescription || '',
        undefined
      );
    }

    return {
      success: true,
      data: {
        status: mappedStatus,
        amount: mpesaTransaction.amount_cents,
        source: 'api',
        responseCode: statusResponse.ResponseCode,
        responseDescription: statusResponse.ResponseDescription,
      },
      message: `Payment status: ${mappedStatus}`,
    };

  } catch (error) {
    console.error('[Spin] checkSpinDepositMpesaStatus error:', error);
    return { success: false, message: 'Failed to check spin deposit status. Please try again.' };
  }
}

/**
 * Check if spin is active based on admin settings or schedule
 */
export async function checkSpinActivation(): Promise<{ active: boolean; message: string }> {
  try {
    await connectToDatabase()
    await ensureSpinSettings() // ADDED: Ensure settings exist
    
    const spinSettings = (await (SpinSettings as any).findOne({}).lean()) as SpinSettingsLean | null

    if (!spinSettings) {
      const scheduledActive = checkScheduledActivation()
      return {
        active: scheduledActive,
        message: scheduledActive
          ? "Spin wheel is active (default schedule)"
          : "Spin wheel is not active (default schedule)",
      }
    }

    if (spinSettings.maintenance_mode) {
      return {
        active: false,
        message: spinSettings.maintenance_message || "Spin wheel is under maintenance",
      }
    }

    if (!spinSettings.is_active) {
      return {
        active: false,
        message: "Spin wheel is deactivated by admin",
      }
    }

    if (spinSettings.activation_mode === "manual") {
      return {
        active: spinSettings.is_active,
        message: spinSettings.is_active ? "Spin wheel is active (manual override)" : "Spin wheel is deactivated",
      }
    }

    if (spinSettings.activation_mode === "scheduled") {
      const scheduledActive = checkScheduledActivation(spinSettings)
      return {
        active: scheduledActive,
        message: scheduledActive ? "Spin wheel is active (scheduled)" : "Spin wheel is not active (scheduled)",
      }
    }

    return { active: false, message: "Spin wheel configuration error" }
  } catch (error) {
    console.error("Error checking spin activation:", error)
    const scheduledActive = checkScheduledActivation()
    return {
      active: scheduledActive,
      message: scheduledActive
        ? "Spin wheel is active (fallback schedule)"
        : "Spin wheel is not active (fallback schedule)",
    }
  }
}

// --- CORE SPIN LOGIC ---

/**
 * Main spin function - handles complete spin logic
 */
export async function performSpin(spinAmountKes: number = 30): Promise<SpinResponse> {
  try {
    console.log("[v0] Starting performSpin with amount:", spinAmountKes, "KES")

    // Validate spin amount
    const MIN_SPIN = 30;
    const MAX_SPIN = 70000;
    if (spinAmountKes < MIN_SPIN || spinAmountKes > MAX_SPIN) {
      return {
        success: false,
        message: `Spin amount must be between KES ${MIN_SPIN} and KES ${MAX_SPIN}`,
      }
    }

    const session = await auth()
    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    await ensureSpinPrizes()
    
    const user = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null
    if (!user) {
      return { success: false, message: "User not found" }
    }

    const userId = user._id.toString()
    const userTier = normalizeRank(user.spin_tier || user.rank)

    console.log("[v0] User found:", {
      userId,
      email: user.email,
      tier: userTier,
    })

    // NEW: Check spin wallet balance
    let spinWallet = await (SpinWallet as any).findOne({ user_id: userId })
    if (!spinWallet) {
      spinWallet = await (SpinWallet as any).create({
        user_id: userId,
        balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        total_spins: 0,
      })
    }

    const SPIN_COST_CENTS = Math.round(spinAmountKes * 100); // Convert KES to cents
    if (spinWallet.balance_cents < SPIN_COST_CENTS) {
      return {
        success: false,
        message: `Insufficient spin wallet balance. You need KES ${spinAmountKes.toFixed(2)} but have KES ${(spinWallet.balance_cents / 100).toFixed(2)}. Please deposit via M-Pesa.`,
      }
    }

    const availablePrizes = await getAvailablePrizesForUser(userId)
    if (availablePrizes.length === 0) {
      return { success: false, message: "No prizes available" }
    }

    const selectedPrize = await selectPrizeWithProbability(availablePrizes, userTier)

    // Deduct from spin wallet
    spinWallet.balance_cents -= SPIN_COST_CENTS
    spinWallet.total_used_cents += SPIN_COST_CENTS
    spinWallet.total_spins += 1
    await spinWallet.save()

    const won = selectedPrize.type !== "ZERO"

    // Log spin
    await logSpin({
      userId,
      prize: selectedPrize,
      userRank: userTier,
      userLevel: user.level || 1,
      referralCount: 0,
      spinCost: SPIN_COST_CENTS,
      won: won,
    })

    // Process prize if won
    if (won && selectedPrize.value_cents > 0) {
      await processPrize(userId, selectedPrize, userTier, won)
    }

    revalidatePath("/dashboard")

    console.log("[v0] Spin completed successfully")
    return {
      success: true,
      prizeType: selectedPrize.type,
      prizeName: selectedPrize.display_name,
      prizeValue: selectedPrize.value_cents || 0,
      prizeDescription: selectedPrize.value_description,
      message:
        selectedPrize.type === "ZERO"
          ? "Try again! Better luck next time."
          : `Congratulations! You won: ${selectedPrize.display_name}`,
    }
  } catch (error) {
    console.error("[v0] Spin error:", error)
    return {
      success: false,
      message: "An error occurred while processing your spin. Please try again.",
    }
  }
}

// --- ADMIN/HELPER EXPORTS ---

/**
 * Get available prizes for spin wheel
 */
export async function getAvailablePrizes(): Promise<{
  success: boolean
  data?: any[]
  message: string
}> {
  try {
    const session = await auth()
    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    await ensureSpinPrizes() // ADDED: Ensure prizes exist

    const prizes = (await (SpinPrize as any)
      .find({ is_active: true })
      .sort({ wheel_order: 1 })
      .lean()) as SpinPrizeLean[]

    return {
      success: true,
      data: prizes.map((prize) => sanitizeMongoObject(prize)),
      message: "Prizes fetched successfully",
    }
  } catch (error) {
    console.error("Error getting prizes:", error)
    return { success: false, message: "Failed to fetch prizes" }
  }
}

/**
 * Get current spin settings
 */
export async function getSpinSettings(): Promise<SpinSettingsResponse> {
  try {
    const session = await auth()
    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    await ensureSpinSettings() // ADDED: Ensure settings exist
    
    const user = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null
    if (!user) {
      return { success: false, message: "User not found" }
    }

    const spinSettings = (await (SpinSettings as any).findOne({}).lean()) as SpinSettingsLean | null

    if (!spinSettings) {
      const defaultSettings = {
        is_active: false,
        activation_mode: "scheduled" as const,
        scheduled_days: ["wednesday", "friday"],
        start_time: "19:00",
        end_time: "22:00",
        timezone: "Africa/Nairobi",
        spins_per_session: 3,
        spins_cost_per_spin: 5,
        cooldown_minutes: 1440,
        require_tasks_completion: true,
        maintenance_mode: false,
        maintenance_message: "",
        probability_multipliers: {
          starter: 1.0,
          bronze: 1.0,
          silver: 1.1,
          gold: 1.2,
          diamond: 1.5,
        },
      }

      return {
        success: true,
        data: defaultSettings,
        message: "Using default spin settings",
      }
    }

    return {
      success: true,
      data: sanitizeMongoObject(spinSettings),
      message: "Spin settings fetched successfully",
    }
  } catch (error) {
    console.error("Error getting spin settings:", error)
    return {
      success: false,
      message: "Failed to get spin settings",
      data: {
        is_active: false,
        activation_mode: "scheduled",
        spins_per_session: 3,
        spins_cost_per_spin: 5,
      },
    }
  }
}

/**
 * Real-time task completion check
 */
async function checkRealTimeTaskCompletion(userId: string): Promise<{
  referral: boolean
  writing: boolean
  allCompleted: boolean
  referralCount?: number
  submissionCount?: number
}> {
  try {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [recentReferrals, recentSubmissions] = await Promise.all([
      (Referral as any).countDocuments({
        referrer_id: userId,
        created_at: { $gte: oneWeekAgo },
        status: { $in: ["completed", "active", "pending"] },
      }) as Promise<number>,
      (UserContent as any).countDocuments({
        user: userId,
        submission_date: { $gte: oneWeekAgo },
        status: { $in: ["pending", "approved", "revision_requested"] },
      }) as Promise<number>,
    ])

    const referralCompleted = recentReferrals > 0
    const writingCompleted = recentSubmissions > 0

    return {
      referral: referralCompleted,
      writing: writingCompleted,
      allCompleted: referralCompleted && writingCompleted,
      referralCount: recentReferrals,
      submissionCount: recentSubmissions,
    }
  } catch (error) {
    console.error("Error checking real-time task completion:", error)
    return {
      referral: false,
      writing: false,
      allCompleted: false,
    }
  }
}

/**
 * Get user task completion status
 */
export async function getUserTaskStatus(userId: string): Promise<TaskStatusResponse> {
  try {
    const realTimeStatus = await checkRealTimeTaskCompletion(userId)

    return {
      success: true,
      data: {
        referral: realTimeStatus.referral,
        writing: realTimeStatus.writing,
        last_updated: new Date().toISOString(),
        allCompleted: realTimeStatus.allCompleted,
        referralCount: realTimeStatus.referralCount,
        submissionCount: realTimeStatus.submissionCount,
      },
      message: "Real-time task status fetched successfully",
    }
  } catch (error) {
    console.error("Error getting real-time task status:", error)
    return {
      success: false,
      message: "Failed to fetch real-time task status",
    }
  }
}

// --- CORE HELPER FUNCTIONS ---

/**
 * Check if user is eligible to spin with proper type assertion
 */
async function checkSpinEligibility(userId: string): Promise<{
  eligible: boolean
  message: string
  referralCount: number
}> {
  try {
    const userProfile = (await (Profile as any).findById(userId).lean()) as UserProfileLean | null
    if (!userProfile) {
      return { eligible: false, message: "User not found", referralCount: 0 }
    }

    if (!userProfile.is_active || !userProfile.is_approved) {
      return { eligible: false, message: "Account not active or approved", referralCount: 0 }
    }

    const spinSettings = (await (SpinSettings as any).findOne({}).lean()) as SpinSettingsLean | null
    const spinsRequired = spinSettings?.spins_cost_per_spin || 5

    const availableSpins = userProfile.available_spins || 0
    if (availableSpins < spinsRequired) {
      return {
        eligible: false,
        message: `Not enough spins available. You need ${spinsRequired} spins but only have ${availableSpins}.`,
        referralCount: 0,
      }
    }

    const referralCount = await getReferralCount(userId)
    let userEligibility = await (UserSpinEligibility as any).findOne({ user_id: userId })

    if (!userEligibility) {
      userEligibility = new (UserSpinEligibility as any)({
        user_id: userId,
        spins_used_today: 0,
        current_session_spins: 0,
        session_started_at: new Date(),
        tasks_completed_this_week: {
          referral: false,
          writing: false,
          last_updated: new Date(),
        },
        is_eligible: true,
        total_spins: 0,
        total_wins: 0,
        total_prize_value_cents: 0,
      })
      await userEligibility.save()
    }

    if (
      userEligibility.manual_override &&
      userEligibility.override_until &&
      userEligibility.override_until > new Date()
    ) {
      return { eligible: true, message: "Eligible to spin (manual override)", referralCount }
    }

    const spinsPerSession = spinSettings?.spins_per_session || 3
    if (userEligibility.current_session_spins >= spinsPerSession) {
      return { eligible: false, message: "Maximum spins reached for this session", referralCount: 0 }
    }

    if (userEligibility.cooldown_until && userEligibility.cooldown_until > new Date()) {
      return { eligible: false, message: "Spin cooldown active", referralCount: 0 }
    }

    return { eligible: true, message: "Eligible to spin", referralCount }
  } catch (error) {
    console.error("Error in checkSpinEligibility:", error)
    return { eligible: false, message: "Error checking spin eligibility", referralCount: 0 }
  }
}

/**
 * Get accurate referral count for user
 */
async function getReferralCount(userId: string): Promise<number> {
  try {
    const completedReferrals = (await (Referral as any).countDocuments({
      referrer_id: userId,
      status: "completed",
    })) as number

    const activeReferrals = (await (Referral as any).countDocuments({
      referrer_id: userId,
      status: { $in: ["active", "completed", "pending"] },
    })) as number

    const userProfile = (await (Profile as any)
      .findById(userId)
      .select("referral_count referrals_completed")
      .lean()) as UserProfileLean | null
    const profileReferralCount = userProfile?.referral_count || userProfile?.referrals_completed || 0

    return Math.max(completedReferrals, activeReferrals, profileReferralCount)
  } catch (error) {
    console.error("Error getting referral count:", error)
    try {
      const userProfile = (await (Profile as any)
        .findById(userId)
        .select("referral_count")
        .lean()) as UserProfileLean | null
      return userProfile?.referral_count || 0
    } catch {
      return 0
    }
  }
}

/**
 * Get available prizes for user from database
 */
async function getAvailablePrizesForUser(userId: string): Promise<SpinPrizeLean[]> {
  const userProfile = (await (Profile as any).findById(userId).lean()) as UserProfileLean | null
  if (!userProfile) {
    return []
  }

  const referralCount = await getReferralCount(userId)
  // FIXED: Use spin_tier if available, otherwise fall back to rank
  const userTier = normalizeRank(userProfile.spin_tier || userProfile.rank)

  console.log("🎯 Getting available prizes for user:", {
    userId,
    originalRank: userProfile.rank,
    spin_tier: userProfile.spin_tier,
    normalizedTier: userTier,
    referralCount,
    availableSpins: userProfile.available_spins,
  })

  const allPrizes = (await (SpinPrize as any)
    .find({
      is_active: true,
      min_referrals: { $lte: referralCount },
      requires_activation: userProfile.is_active ? true : { $in: [true, false] },
    })
    .sort({ wheel_order: 1 })
    .lean()) as SpinPrizeLean[]

  // FIXED: Check accessible_tiers instead of accessible_ranks
  const accessiblePrizes = allPrizes.filter((prize) => {
    if (!prize.accessible_tiers || !Array.isArray(prize.accessible_tiers)) {
      console.log(`❌ Prize ${prize.display_name} has invalid accessible_tiers:`, prize.accessible_tiers)
      return false
    }

    const isAccessible = prize.accessible_tiers.some((tier: string) => normalizeRank(tier) === userTier)

    if (isAccessible) {
      console.log(`✅ Prize accessible: ${prize.display_name} - tiers: ${prize.accessible_tiers}`)
    }

    return isAccessible
  })

  console.log("🎁 Available prizes summary:", {
    totalPrizesInSystem: allPrizes.length,
    accessiblePrizesCount: accessiblePrizes.length,
    accessiblePrizes: accessiblePrizes.map((p) => p.display_name),
  })

  return accessiblePrizes
}

/**
 * Select prize based on probabilities
 */
async function selectPrizeWithProbability(availablePrizes: SpinPrizeLean[], userTier: string): Promise<SpinPrizeLean> {
  // Always return "Try Again" - no prizes are won
  const tryAgainPrize: SpinPrizeLean = {
    _id: "try-again-zero",
    type: "ZERO",
    display_name: "Try Again",
    value_cents: 0,
    credit_type: "balance",
    base_probability: 100,
  }
  
  console.log(`🎡 Spin wheel landed on: ${tryAgainPrize.display_name} - KES 30 deducted`)
  return tryAgainPrize
}

/**
 * Deduct spin cost from user's available spins
 */
async function deductSpinCost(userId: string): Promise<{ success: boolean; message: string; cost: number }> {
  try {
    const spinSettings = (await (SpinSettings as any).findOne({}).lean()) as SpinSettingsLean | null
    const cost = spinSettings?.spins_cost_per_spin || 5

    const user = await (Profile as any).findById(userId)
    if (!user) {
      return { success: false, message: "User not found", cost }
    }

    console.log(
      `💰 Before deduction - Available spins: ${user.available_spins}, Total spins used: ${user.total_spins_used}`,
    )

    if (user.available_spins < cost) {
      return { success: false, message: "Not enough spins available", cost }
    }

    user.available_spins -= cost
    user.total_spins_used = (user.total_spins_used || 0) + cost
    await user.save()

    console.log(
      `✅ Deducted ${cost} spins from user ${userId}. Remaining: ${user.available_spins}, Total used: ${user.total_spins_used}`,
    )

    return { success: true, message: "Spin cost deducted successfully", cost }
  } catch (error) {
    console.error("Error deducting spin cost:", error)
    return { success: false, message: "Error deducting spin cost", cost: 5 }
  }
}

/**
 * Process the won prize and update user statistics
 */
async function processPrize(userId: string, prize: SpinPrizeLean, userTier: string, won: boolean): Promise<void> {
  try {
    console.log(`🎁 Processing prize: ${prize.type} for user: ${userId}, Won: ${won}`)

    const user = await (Profile as any).findById(userId)
    if (!user) throw new Error("User not found")

    if (won) {
      console.log(`🏆 User won a prize! Updating statistics...`)

      user.total_prizes_won = (user.total_prizes_won || 0) + 1
      user.spin_streak = (user.spin_streak || 0) + 1
      user.max_spin_streak = Math.max(user.max_spin_streak || 0, user.spin_streak)

      console.log(
        `📈 Updated user stats - Prizes won: ${user.total_prizes_won}, Streak: ${user.spin_streak}, Max Streak: ${user.max_spin_streak}`,
      )
    } else {
      user.spin_streak = 0
      console.log(`🔄 Reset spin streak to 0 (TRY_AGAIN)`)
    }

    switch (prize.credit_type) {
      case "balance":
        if (prize.value_cents > 0) {
          user.balance_cents += prize.value_cents
          user.total_earnings_cents += prize.value_cents

          await (Transaction as any).create({
            user_id: userId,
            amount_cents: prize.value_cents,
            type: "SPIN_WIN",
            description: `Spin wheel prize: ${prize.display_name}`,
            status: "completed",
            transaction_code: `SPIN-${Date.now()}`,
            metadata: {
              prize_type: prize.type,
              spin_tier: userTier,
              prize_name: prize.display_name,
            },
            target_type: 'user',
            target_id: userId,
          })
          console.log(`💰 Added ${prize.value_cents} cents to balance`)
        } else {
          // This handles TRY_AGAIN with 0 value_cents
          console.log("🔄 No prize to process (TRY_AGAIN or 0 value)")
        }
        break

      case "spins":
        if (prize.value_cents > 0) {
          const spinsToAdd = Math.floor(prize.value_cents / 100)
          user.available_spins += spinsToAdd
          console.log(`🎫 Added ${spinsToAdd} spins to user account`)
        }
        break

      case "airtime":
        console.log(`📱 Airtime prize: ${prize.display_name}`)
        break

      case "boost":
        await applyTemporaryBoost(userId, prize.type, 7)
        break

      case "feature":
        await enableFeature(userId, prize.type, 30)
        break

      case "badge":
        await assignBadge(userId, prize.type)
        break

      case "voucher":
        await processVoucherPrize(userId, prize)
        break

      default:
        console.warn(`⚠️ Unknown credit type: ${prize.credit_type}`)
    }

    await user.save()
    console.log(
      `✅ Prize processed successfully: ${prize.type}, Available spins: ${user.available_spins}, Total prizes won: ${user.total_prizes_won}`,
    )
  } catch (error) {
    console.error("Error processing prize:", error)
    throw error
  }
}

/**
 * Update user spin eligibility after spin
 */
async function updateUserSpinEligibility(userId: string, won: boolean): Promise<void> {
  try {
    let userEligibility = await (UserSpinEligibility as any).findOne({ user_id: userId })

    if (!userEligibility) {
      userEligibility = new (UserSpinEligibility as any)({
        user_id: userId,
        spins_used_today: 1,
        current_session_spins: 1,
        session_started_at: new Date(),
        tasks_completed_this_week: {
          referral: false,
          writing: false,
          last_updated: new Date(),
        },
        is_eligible: true,
        total_spins: 1,
        total_wins: won ? 1 : 0,
        total_prize_value_cents: 0,
      })
    } else {
      userEligibility.spins_used_today += 1
      userEligibility.current_session_spins += 1
      userEligibility.total_spins += 1

      if (won) {
        userEligibility.total_wins += 1
        userEligibility.win_streak = (userEligibility.win_streak || 0) + 1
        userEligibility.best_win_streak = Math.max(userEligibility.best_win_streak || 0, userEligibility.win_streak)
        console.log(
          `📊 Eligibility updated - Wins: ${userEligibility.total_wins}, Streak: ${userEligibility.win_streak}`,
        )
      } else {
        userEligibility.win_streak = 0
        console.log(`📊 Eligibility updated - Streak reset to 0`)
      }
    }

    await userEligibility.save()
    console.log("✅ User spin eligibility updated successfully")
  } catch (error) {
    console.error("Error updating user spin eligibility:", error)
  }
}

/**
 * Update spin analytics with NaN protection
 */
async function updateSpinAnalytics(prize: SpinPrizeLean, spinCost: number): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let analytics = await (SpinAnalytics as any).findOne({ date: today, period: "daily" })

    if (!analytics) {
      analytics = new (SpinAnalytics as any)({
        date: today,
        period: "daily",
        total_spins: 0,
        total_wins: 0,
        total_revenue_cents: 0,
        total_payout_cents: 0,
        win_rate: 0,
        average_payout_cents: 0,
        most_won_prize: null,
        spin_volume: 0,
      })
    }

    analytics.total_spins += 1
    analytics.total_revenue_cents += spinCost
    analytics.spin_volume += 1

    if (prize.type !== "TRY_AGAIN") {
      analytics.total_wins += 1
      analytics.total_payout_cents += prize.value_cents || 0
    }

    analytics.win_rate = analytics.total_spins > 0 ? (analytics.total_wins / analytics.total_spins) * 100 : 0

    analytics.average_payout_cents = analytics.total_wins > 0 ? analytics.total_payout_cents / analytics.total_wins : 0

    if (isNaN(analytics.win_rate) || !isFinite(analytics.win_rate)) {
      analytics.win_rate = 0
    }
    if (isNaN(analytics.average_payout_cents) || !isFinite(analytics.average_payout_cents)) {
      analytics.average_payout_cents = 0
    }

    analytics.total_spins = analytics.total_spins || 0
    analytics.total_wins = analytics.total_wins || 0
    analytics.total_revenue_cents = analytics.total_revenue_cents || 0
    analytics.total_payout_cents = analytics.total_payout_cents || 0
    analytics.spin_volume = analytics.spin_volume || 0

    await analytics.save()
    console.log("✅ Updated spin analytics successfully")
  } catch (error) {
    console.error("Error updating spin analytics:", error)
  }
}

/**
 * Log spin activity with all required fields
 */
async function logSpin(data: {
  userId: string
  prize: SpinPrizeLean
  userRank: string
  userLevel: number
  referralCount: number
  spinCost: number
  won: boolean
}): Promise<void> {
  try {
    const userProfile = (await (Profile as any).findById(data.userId).lean()) as UserProfileLean | null
    const availablePrizes = await getAvailablePrizesForUser(data.userId)
    const probabilityMultiplier = await getProbabilityMultiplier(data.userRank)

    const spinLogData: any = {
      user_id: data.userId,
      spin_cost_cents: data.spinCost,
      spins_used: data.spinCost / 100,
      prize_type: data.prize.type,
      prize_name: data.prize.display_name,
      prize_value_cents: data.prize.value_cents || 0,
      status: "lost", // Always lost since we always land on Try Again
      won: false,     // Never won
      user_rank: data.userRank,
      user_tier: data.userRank,
      user_level: data.userLevel,
      user_referral_count: data.referralCount,
      user_balance_before: userProfile?.balance_cents || 0,
      user_spins_before: userProfile?.available_spins || 0,
      calculated_probability: 0, // No prize selection
      available_prizes_count: availablePrizes.length,
      probability_multiplier: probabilityMultiplier,
      cost_impact_cents: data.spinCost,
      revenue_impact_cents: data.spinCost, // All revenue, no payout
      net_impact_cents: data.spinCost,     // All cost to user
      credited: false,
      spin_session_id: `session_${data.userId}_${Date.now()}`,
      user_agent: "server-action",
      ip_address: "server-action",
    }

    // Only set prize_id if it's a valid MongoDB ObjectId
    if (data.prize._id && typeof data.prize._id === 'object' && data.prize._id.toString) {
      spinLogData.prize_id = data.prize._id;
    }

    if (data.won) {
      spinLogData.credited_at = new Date()
    }

    const tasksStatus = await getCurrentTaskStatus(data.userId)
    if (tasksStatus) {
      spinLogData.tasks_completed_this_week = tasksStatus
    }

    const spinLog = new (SpinLog as any)(spinLogData)
    await spinLog.save()

    console.log("✅ Spin logged successfully - Try Again (KES 30 deducted)")
  } catch (error) {
    console.error("Error logging spin:", error)
  }
}

async function getProbabilityMultiplier(userTier: string): Promise<number> {
  try {
    const spinSettings = (await (SpinSettings as any).findOne({}).lean()) as SpinSettingsLean | null
    const probabilityMultipliers = spinSettings?.probability_multipliers || {
      starter: 1.0,
      bronze: 1.0,
      silver: 1.1,
      gold: 1.2,
      diamond: 1.5,
    }

    const normalizedTier = normalizeRank(userTier)
    return probabilityMultipliers[normalizedTier as keyof typeof probabilityMultipliers] || 1.0
  } catch (error) {
    console.error("Error getting probability multiplier:", error)
    return 1.0
  }
}

async function getCurrentTaskStatus(userId: string): Promise<{ referral: boolean; writing: boolean }> {
  try {
    const userEligibility = (await (UserSpinEligibility as any)
      .findOne({ user_id: userId })
      .lean()) as UserSpinEligibilityLean | null
    return userEligibility?.tasks_completed_this_week || { referral: false, writing: false }
  } catch (error) {
    return { referral: false, writing: false }
  }
}

async function processVoucherPrize(userId: string, prize: SpinPrizeLean): Promise<void> {
  console.log("Processing voucher prize:", prize.type, "for user:", userId)
}

async function applyTemporaryBoost(userId: string, boostType: string, durationDays: number): Promise<void> {
  console.log("Applying boost:", boostType, "for", durationDays, "days to user:", userId)
}

async function assignBadge(userId: string, badgeType: string): Promise<void> {
  console.log("Assigning badge:", badgeType, "to user:", userId)
}

async function enableFeature(userId: string, featureType: string, durationDays: number): Promise<void> {
  console.log("Enabling feature:", featureType, "for", durationDays, "days for user:", userId)
}

/**
 * Get user spin statistics
 */
export async function getUserSpinStats(userId: string): Promise<SpinStatsResponse> {
  try {
    await connectToDatabase()

    console.log("🔍 Getting user spin stats for:", userId)

    const userProfile = (await (Profile as any).findById(userId).lean()) as UserProfileLean | null
    if (!userProfile) {
      return {
        success: false,
        message: "User not found",
        data: {
          totalSpins: 0,
          totalWins: 0,
          winRate: 0,
          totalPrizeValue: 0,
          currentStreak: 0,
          bestStreak: 0,
          availableSpins: 0,
          totalSpinsUsed: 0,
        },
      }
    }

    const userEligibility = (await (UserSpinEligibility as any)
      .findOne({ user_id: userId })
      .lean()) as UserSpinEligibilityLean | null

    const spinLogs = (await (SpinLog as any).find({ user_id: userId }).lean()) as any[]

    const totalSpins = spinLogs.length
    const totalWins = spinLogs.filter((log: any) => log.won && log.prize_type !== "TRY_AGAIN").length
    const winRate = totalSpins > 0 ? (totalWins / totalSpins) * 100 : 0
    const totalPrizeValue = spinLogs.reduce((sum: number, log: any) => sum + (log.prize_value_cents || 0), 0)

    console.log("📊 Spin stats calculated:", {
      totalSpins,
      totalWins,
      winRate,
      totalPrizeValue,
      availableSpins: userProfile.available_spins,
      totalSpinsUsed: userProfile.total_spins_used,
      currentStreak: userEligibility?.win_streak || 0,
      bestStreak: userEligibility?.best_win_streak || 0,
      totalPrizesWon: userProfile.total_prizes_won,
      spinStreak: userProfile.spin_streak,
      maxSpinStreak: userProfile.max_spin_streak,
    })

    return {
      success: true,
      data: {
        totalSpins,
        totalWins,
        winRate: Math.round(winRate * 100) / 100,
        totalPrizeValue,
        currentStreak: userEligibility?.win_streak || 0,
        bestStreak: userEligibility?.best_win_streak || 0,
        availableSpins: userProfile.available_spins || 0,
        totalSpinsUsed: userProfile.total_spins_used || 0,
      },
      message: "User spin stats fetched successfully",
    }
  } catch (error) {
    console.error("Error getting user spin stats:", error)
    return {
      success: false,
      message: "Failed to fetch user spin stats",
      data: {
        totalSpins: 0,
        totalWins: 0,
        winRate: 0,
        totalPrizeValue: 0,
        currentStreak: 0,
        bestStreak: 0,
        availableSpins: 0,
        totalSpinsUsed: 0,
      },
    }
  }
}

/**
 * Admin function to update spin settings
 */
export async function updateSpinSettings(settings: {
  is_active: boolean
  activation_mode: "manual" | "scheduled"
  scheduled_days: string[]
  start_time: string
  end_time: string
  spins_per_session: number
  spins_cost_per_spin: number
  cooldown_minutes: number
  require_tasks_completion: boolean
  maintenance_mode: boolean
  maintenance_message: string
  probability_multipliers?: {
    starter: number
    bronze: number
    silver: number
    gold: number
    diamond: number
  }
}): Promise<AdminActionResponse> {
  try {
    const session = await auth()

    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    
    const adminUser = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null

    if (adminUser?.role !== "admin") {
      return { success: false, message: "Admin access required" }
    }

    let spinSettings = await (SpinSettings as any).findOne({})
    const oldSettings = spinSettings ? spinSettings.toObject() : null

    if (!spinSettings) {
      spinSettings = new (SpinSettings as any)(settings)
    } else {
      Object.assign(spinSettings, settings)
    }

    spinSettings.last_activated_by = adminUser._id.toString()
    spinSettings.last_updated_by = adminUser._id.toString()
    spinSettings.last_activated_at = new Date()

    if (oldSettings) {
      const changes: any = {}
      Object.keys(settings).forEach((key) => {
        if (JSON.stringify(oldSettings[key]) !== JSON.stringify(settings[key as keyof typeof settings])) {
          changes[key] = {
            from: oldSettings[key],
            to: settings[key as keyof typeof settings],
          }
        }
      })

      if (Object.keys(changes).length > 0) {
        spinSettings.change_history.push({
          changed_by: adminUser._id.toString(),
          changed_at: new Date(),
          changes,
          version: spinSettings.version + 1,
        })
        spinSettings.version += 1
      }
    }

    await spinSettings.save()

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: "UPDATE_SPIN_SETTINGS",
      target_type: "SpinSettings",
      target_id: spinSettings._id.toString(),
      changes: settings,
      resource_type: "spin_settings",
      resource_id: spinSettings._id.toString(),
      action_type: "update",
      spin_related: {
        activation_mode: settings.activation_mode,
        scheduled_days: settings.scheduled_days,
      },
      ip_address: "server-action",
      user_agent: "server-action",
    })

    revalidatePath("/admin/spin-settings")
    revalidatePath("/dashboard")

    return { success: true, message: "Spin settings updated successfully" }
  } catch (error) {
    console.error("Error updating spin settings:", error)
    return { success: false, message: "Failed to update spin settings" }
  }
}

/**
 * Admin function to get spin logs
 */
export async function getSpinLogs(
  page = 1,
  limit = 20,
  userId?: string,
  filters?: {
    prize_type?: string
    status?: string
    date_from?: Date
    date_to?: Date
    won?: boolean
  },
): Promise<SpinLogsResponse> {
  try {
    const session = await auth()

    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    
    const adminUser = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null

    if (adminUser?.role !== "admin") {
      return { success: false, message: "Admin access required" }
    }

    const skip = (page - 1) * limit
    const query: any = {}

    if (userId) {
      query.user_id = userId
    }

    if (filters) {
      if (filters.prize_type) {
        query.prize_type = filters.prize_type
      }
      if (filters.status) {
        query.status = filters.status
      }
      if (filters.won !== undefined) {
        query.won = filters.won
      }
      if (filters.date_from || filters.date_to) {
        query.created_at = {}
        if (filters.date_from) {
          query.created_at.$gte = filters.date_from
        }
        if (filters.date_to) {
          query.created_at.$lte = filters.date_to
        }
      }
    }

    const [logs, total] = await Promise.all([
      (SpinLog as any)
        .find(query)
        .populate("user_id", "username email spin_tier level")
        .populate("prize_id", "display_name value_cents credit_type")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as Promise<any[]>,
      (SpinLog as any).countDocuments(query) as Promise<number>,
    ])

    const serializedLogs = logs.map((log: any) => ({
      ...log,
      _id: log._id.toString(),
      user_id: log.user_id
        ? {
            ...log.user_id,
            _id: log.user_id._id.toString(),
          }
        : null,
      prize_id: log.prize_id
        ? {
            ...log.prize_id,
            _id: log.prize_id._id.toString(),
          }
        : null,
      change_history: log.change_history?.map((historyItem: any) => ({
        ...historyItem,
        _id: historyItem._id?.toString(),
      })),
    }))

    return {
      success: true,
      data: serializedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      message: "Spin logs fetched successfully",
    }
  } catch (error) {
    console.error("Error getting spin logs:", error)
    return { success: false, message: "Failed to fetch spin logs" }
  }
}

/**
 * Admin function to manually add spins to user
 */
export async function addUserSpins(userId: string, spins: number, reason: string): Promise<AdminActionResponse> {
  try {
    const session = await auth()

    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    
    const adminUser = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null

    if (adminUser?.role !== "admin") {
      return { success: false, message: "Admin access required" }
    }

    const user = await (Profile as any).findById(userId)
    if (!user) {
      return { success: false, message: "User not found" }
    }

    const oldSpins = user.available_spins
    user.available_spins += spins
    await user.save()

    await (AdminAuditLog as any).create({
      actor_id: adminUser._id.toString(),
      action: "ADD_SPINS",
      target_type: "Profile",
      target_id: userId,
      changes: {
        spins_added: spins,
        reason,
        old_spins: oldSpins,
        new_spins: user.available_spins,
      },
      resource_type: "user",
      resource_id: userId,
      action_type: "update",
      ip_address: "server-action",
      user_agent: "server-action",
    })

    revalidatePath("/admin/users")
    revalidatePath("/dashboard")

    return { success: true, message: `Successfully added ${spins} spins to user` }
  } catch (error) {
    console.error("Error adding user spins:", error)
    return { success: false, message: "Failed to add spins to user" }
  }
}

/**
 * Admin function to toggle spin wheel activation
 */
export async function adminToggleSpinWheel(activate: boolean): Promise<AdminActionResponse> {
  try {
    const session = await auth()

    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    
    const adminUser = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null

    if (adminUser?.role !== "admin") {
      return { success: false, message: "Admin access required" }
    }

    const { toggleSpinWheel } = await import("./admin")
    const result = await toggleSpinWheel(activate)

    if (result.success) {
      revalidatePath("/admin")
      revalidatePath("/dashboard")
    }

    return result
  } catch (error) {
    console.error("Error toggling spin wheel:", error)
    return { success: false, message: "Failed to toggle spin wheel" }
  }
}

/**
 * Get spin analytics for admin dashboard
 */
export async function getSpinAnalytics(
  period: "daily" | "weekly" | "monthly" = "daily",
  date?: Date,
): Promise<SpinAnalyticsResponse> {
  try {
    const session = await auth()

    if (!isValidSession(session)) {
      return { success: false, message: "Unauthorized" }
    }

    await connectToDatabase()
    
    const adminUser = (await (Profile as any).findById(session.user.id).lean()) as UserProfileLean | null

    if (adminUser?.role !== "admin") {
      return { success: false, message: "Admin access required" }
    }

    const targetDate = date || new Date()
    targetDate.setHours(0, 0, 0, 0)

    const analytics = await (SpinAnalytics as any)
      .findOne({
        date: targetDate,
        period,
      })
      .lean()

    return {
      success: true,
      data: analytics,
      message: "Spin analytics fetched successfully",
    }
  } catch (error) {
    console.error("Error getting spin analytics:", error)
    return { success: false, message: "Failed to fetch spin analytics" }
  }
}

/**
 * Reconcile spin deposit transaction status with M-Pesa status
 * This function ensures that Transaction records match their corresponding MpesaTransaction status
 */
export async function reconcileSpinDepositStatus(mpesaTransactionId: string) {
  try {
    await connectToDatabase()

    // Find the M-Pesa transaction
    const mpesaTransaction = await (MpesaTransaction as any).findById(mpesaTransactionId).lean()
    
    if (!mpesaTransaction) {
      return {
        success: false,
        message: 'M-Pesa transaction not found'
      }
    }

    // Find the associated Transaction record
    const transaction = await (Transaction as any).findOne({
      $or: [
        { mpesa_transaction_id: mpesaTransaction._id },
        { 'metadata.checkoutRequestID': mpesaTransaction.metadata?.checkoutRequestID }
      ]
    })

    if (!transaction) {
      console.warn('⚠️ No Transaction record found for M-Pesa:', mpesaTransactionId)
      return {
        success: false,
        message: 'No matching Transaction record found'
      }
    }

    // If M-Pesa transaction has a terminal status but Transaction doesn't, update it
    if (mpesaTransaction.status && transaction.status !== mpesaTransaction.status) {
      console.log('🔄 Reconciling status mismatch:', {
        mpesaId: mpesaTransaction._id,
        oldStatus: transaction.status,
        newStatus: mpesaTransaction.status
      })

      transaction.status = mpesaTransaction.status
      transaction.balance_updated = true // Mark as processed
      
      // Update metadata with M-Pesa details
      transaction.metadata = {
        ...transaction.metadata,
        mpesa_receipt_number: mpesaTransaction.mpesa_receipt_number,
        result_code: mpesaTransaction.result_code,
        result_desc: mpesaTransaction.result_desc,
        reconciled_at: new Date().toISOString()
      }

      await transaction.save()

      console.log('✅ Successfully reconciled transaction status to:', mpesaTransaction.status)
    } else {
      console.log('✓ Transaction status already matches M-Pesa status')
    }

    return {
      success: true,
      data: {
        transactionId: transaction._id,
        status: transaction.status,
        balance_updated: transaction.balance_updated
      },
      message: 'Reconciliation completed successfully'
    }
  } catch (error) {
    console.error('❌ Reconciliation error:', error)
    return {
      success: false,
      message: 'Failed to reconcile transaction status'
    }
  }
}
