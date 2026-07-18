/**
 * Admin Email Migration Script
 * 
 * This script migrates the admin user from the old email to a new email.
 * It transfers all admin privileges and data to the new email address.
 * 
 * Run with: npx ts-node scripts/migrate-admin-email.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Migration configuration
const MIGRATION_CONFIG = {
  oldEmail: 'scholinesandra1@gmail.com',
  newEmail: 'hustleadmin001@gmail.com',
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

// Define Profile Schema inline
const ProfileSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone_number: { type: String, required: false },
  password: { type: String, required: false, select: false },
  role: { type: String, enum: ['user', 'support', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'inactive', 'suspended', 'banned', 'pending'] },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },
  referral_id: { type: String, unique: true, sparse: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const getProfileModel = () => {
  if (mongoose.models.Profile) {
    return mongoose.models.Profile;
  }
  return mongoose.model('Profile', ProfileSchema);
};

async function migrateAdminEmail() {
  try {
    await connectToDatabase();
    
    const Profile = getProfileModel();
    
    console.log('\n📋 Migration Configuration:');
    console.log(`   Old Email: ${MIGRATION_CONFIG.oldEmail}`);
    console.log(`   New Email: ${MIGRATION_CONFIG.newEmail}`);
    console.log('');

    // Find the old admin user
    const oldAdmin = await (Profile as any).findOne({
      email: { $regex: new RegExp(`^${MIGRATION_CONFIG.oldEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      role: 'admin'
    });

    if (!oldAdmin) {
      console.log('⚠️  No admin user found with email:', MIGRATION_CONFIG.oldEmail);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('📌 Found old admin user:');
    console.log(`   ID: ${oldAdmin._id}`);
    console.log(`   Email: ${oldAdmin.email}`);
    console.log(`   Username: ${oldAdmin.username}`);
    console.log(`   Role: ${oldAdmin.role}`);
    console.log(`   Status: ${oldAdmin.status}`);
    console.log('');

    // Check if new email already exists
    const newEmailExists = await (Profile as any).findOne({
      email: { $regex: new RegExp(`^${MIGRATION_CONFIG.newEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (newEmailExists) {
      console.log('❌ Error: New email address already exists in the system!');
      console.log(`   Email: ${newEmailExists.email}`);
      console.log(`   ID: ${newEmailExists._id}`);
      console.log('');
      console.log('💡 Please either:');
      console.log('   1. Delete the existing user with the new email, or');
      console.log('   2. Choose a different new email address');
      
      await mongoose.disconnect();
      process.exit(1);
    }

    // Update the admin email
    console.log('🔄 Updating admin email...');
    
    const updatedAdmin = await (Profile as any).findByIdAndUpdate(
      oldAdmin._id,
      {
        email: MIGRATION_CONFIG.newEmail.toLowerCase(),
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!updatedAdmin) {
      throw new Error('Failed to update admin email');
    }

    console.log('✅ Admin email updated successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('              ADMIN USER UPDATED                        ');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   User ID:    ${updatedAdmin._id}`);
    console.log(`   Username:   ${updatedAdmin.username}`);
    console.log(`   Old Email:  ${MIGRATION_CONFIG.oldEmail}`);
    console.log(`   New Email:  ${updatedAdmin.email}`);
    console.log(`   Phone:      ${updatedAdmin.phone_number}`);
    console.log(`   Role:       ${updatedAdmin.role}`);
    console.log(`   Status:     ${updatedAdmin.status}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🔐 Important Notes:');
    console.log(`   • Admin email has been changed to: ${MIGRATION_CONFIG.newEmail}`);
    console.log('   • All admin privileges have been preserved');
    console.log('   • Users can now only access admin with the new email');
    console.log('');
    
    await mongoose.disconnect();
    console.log('🔌 Database connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
migrateAdminEmail();
