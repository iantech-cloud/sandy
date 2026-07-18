/**
 * Seed Admin Script
 * 
 * This script creates the initial admin user who is fully activated and verified.
 * This admin can then give referral links to other users so they can join the platform.
 * 
 * Run with: npx ts-node scripts/seed-admin.ts
 * Or add to package.json: "seed:admin": "ts-node scripts/seed-admin.ts"
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Admin configuration - CHANGE THESE VALUES BEFORE RUNNING
const ADMIN_CONFIG = {
  username: 'HustleAdmin',
  email: 'hustleadmin001@gmail.com',
  phone_number: '254707871154',
  password: 'Admin@123456',
  referral_id: 'SANDY001', // The referral code others will use to join
};

// MongoDB connection
async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  console.log('🔗 Connecting to MongoDB...');
  
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });
  
  console.log('✅ Connected to MongoDB');
}

// Define Profile Schema inline to avoid circular dependencies
const ProfileSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true, maxlength: 50 },
  phone_number: { type: String, required: false, default: null, maxlength: 50 },
  email: { type: String, required: true, unique: true, maxlength: 255 },
  password: { type: String, required: false, select: false },
  
  // 2FA Fields
  twoFAEnabled: { type: Boolean, default: false },
  twoFASecret: { type: String, default: null },
  twoFABackupCodes: [{ code: String, used: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } }],
  twoFALastUsed: { type: Date },
  twoFASetupDate: { type: Date },
  
  // Anti-Phishing Fields
  antiPhishingCode: { type: String, default: null, select: false },
  antiPhishingCodeSet: { type: Boolean, default: false },
  antiPhishingSetAt: { type: Date },
  antiPhishingLastUpdated: { type: Date },

  referral_id: { type: String, unique: true, sparse: true, maxlength: 10 },
  role: { type: String, enum: ['user', 'support', 'admin'], default: 'user', required: true },

  // Activation Fields
  is_verified: { type: Boolean, default: false },
  email_verified_at: { type: Date },
  activation_paid_at: { type: Date },
  activation_amount_cents: { type: Number, default: 9000 },
  activation_method: { type: String, enum: ['mpesa', 'manual'], default: 'mpesa' },

  approval_status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
  approval_by: { type: String, ref: 'Profile' },
  approval_at: { type: Date },
  approval_notes: { type: String },

  status: { type: String, enum: ['active', 'inactive', 'suspended', 'banned', 'pending'], default: 'pending', required: true },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },

  ban_reason: { type: String },
  banned_at: { type: Date },
  suspension_reason: { type: String },
  suspended_at: { type: Date },

  level: { type: Number, default: 0 },
  rank: { type: String, default: 'Unactivated', maxlength: 50 },
  total_earnings_cents: { type: Number, default: 0 },
  balance_cents: { type: Number, default: 0 },
  tasks_completed: { type: Number, default: 0 },
  
  // Spin fields
  available_spins: { type: Number, default: 0 },
  total_spins_used: { type: Number, default: 0 },
  total_prizes_won: { type: Number, default: 0 },
  spin_tier: { type: String, enum: ['starter', 'bronze', 'silver', 'gold', 'diamond'], default: 'starter' },
  last_spin_at: { type: Date },
  spin_streak: { type: Number, default: 0 },
  max_spin_streak: { type: Number, default: 0 },

  // M-Pesa Integration Fields
  total_deposits_cents: { type: Number, default: 0 },
  total_withdrawals_cents: { type: Number, default: 0 },
  last_deposit_at: { type: Date },
  last_withdrawal_at: { type: Date },
  preferred_mpesa_number: { type: String, required: false, default: null },
  mpesa_number_verified: { type: Boolean, default: false },
  mpesa_verification_date: { type: Date },

  // Daily Limits
  daily_deposit_limit_cents: { type: Number, default: 7000000 },
  daily_withdrawal_limit_cents: { type: Number, default: 1500000 },
  total_deposits_today_cents: { type: Number, default: 0 },
  total_withdrawals_today_cents: { type: Number, default: 0 },
  last_deposit_reset: { type: Date, default: Date.now },
  last_withdrawal_reset: { type: Date, default: Date.now },

  // M-Pesa Transaction Statistics
  mpesa_transactions_count: { type: Number, default: 0 },
  successful_mpesa_deposits: { type: Number, default: 0 },
  failed_mpesa_deposits: { type: Number, default: 0 },
  last_mpesa_deposit_date: { type: Date },

  // Security & Compliance
  kyc_status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  kyc_verified_at: { type: Date },

  // Referral System - Admin has no referrer (they are the root)
  referred_by: { type: String, ref: 'Profile' },
  referral_bonus_claimed: { type: Boolean, default: false },

  // Profile Completion
  profile_completed: { type: Boolean, default: false },
  completion_percentage: { type: Number, default: 0 },

  // Authentication method tracking
  authMethod: { type: String, enum: ['email', 'google'], default: 'email' },

  // Login tracking
  last_login: { type: Date },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

// Get or create the Profile model
const getProfileModel = () => {
  if (mongoose.models.Profile) {
    return mongoose.models.Profile;
  }
  return mongoose.model('Profile', ProfileSchema);
};

async function seedAdmin() {
  try {
    await connectToDatabase();
    
    const Profile = getProfileModel();
    
    console.log('\n📋 Admin Configuration:');
    console.log(`   Username: ${ADMIN_CONFIG.username}`);
    console.log(`   Email: ${ADMIN_CONFIG.email}`);
    console.log(`   Phone: ${ADMIN_CONFIG.phone_number}`);
    console.log(`   Referral Code: ${ADMIN_CONFIG.referral_id}`);
    console.log('');

    // Check if admin already exists
    const existingAdmin = await (Profile as any).findOne({
      $or: [
        { email: { $regex: new RegExp(`^${ADMIN_CONFIG.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { username: ADMIN_CONFIG.username },
        { referral_id: ADMIN_CONFIG.referral_id }
      ]
    }).lean();

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   ID: ${existingAdmin._id}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Referral Code: ${existingAdmin.referral_id}`);
      console.log(`   Status: ${existingAdmin.status}`);
      console.log(`   Role: ${existingAdmin.role}`);
      
      // Ask if we should update the existing admin
      console.log('\n💡 To update the admin, delete the existing user first or modify this script.');
      
      await mongoose.disconnect();
      process.exit(0);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, 12);
    const adminId = randomUUID();
    const now = new Date();

    // Create the admin user with full activation
    const adminUser = await (Profile as any).create({
      _id: adminId,
      username: ADMIN_CONFIG.username,
      email: ADMIN_CONFIG.email.toLowerCase(),
      phone_number: ADMIN_CONFIG.phone_number,
      password: hashedPassword,
      referral_id: ADMIN_CONFIG.referral_id,
      
      // Admin role
      role: 'admin',
      
      // Fully verified and activated
      is_verified: true,
      email_verified_at: now,
      activation_paid_at: now,
      activation_amount_cents: 0, // Admin doesn't need to pay
      activation_method: 'manual',
      
      // Approved and active
      approval_status: 'approved',
      approval_by: adminId, // Self-approved
      approval_at: now,
      approval_notes: 'Initial system administrator - auto-approved',
      
      status: 'active',
      is_active: true,
      is_approved: true,
      
      // Admin rank
      level: 10,
      rank: 'System Administrator',
      
      // Profile completion
      profile_completed: true,
      completion_percentage: 100,
      
      // KYC verified
      kyc_status: 'verified',
      kyc_verified_at: now,
      
      // M-Pesa verified
      preferred_mpesa_number: ADMIN_CONFIG.phone_number,
      mpesa_number_verified: true,
      mpesa_verification_date: now,
      
      // No referrer - admin is the root user
      referred_by: null,
      referral_bonus_claimed: false,
      
      // Authentication
      authMethod: 'email',
      last_login: now,
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('              ADMIN USER DETAILS                        ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   User ID:       ${adminUser._id}`);
    console.log(`   Username:      ${adminUser.username}`);
    console.log(`   Email:         ${adminUser.email}`);
    console.log(`   Phone:         ${adminUser.phone_number}`);
    console.log(`   Role:          ${adminUser.role}`);
    console.log(`   Status:        ${adminUser.status}`);
    console.log(`   Referral Code: ${adminUser.referral_id}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('🔗 Share this referral link with users to let them join:');
    console.log(`   ${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/auth/sign-up?ref=${adminUser.referral_id}`);
    console.log('');
    
    console.log('🔐 Login Credentials:');
    console.log(`   Email:    ${ADMIN_CONFIG.email}`);
    console.log(`   Password: ${ADMIN_CONFIG.password}`);
    console.log('');
    
    console.log('⚠️  IMPORTANT: Change the admin password after first login!');
    console.log('');

    await mongoose.disconnect();
    console.log('🔌 Database connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seed function
seedAdmin();
