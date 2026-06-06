/**
 * Script: Backfill Referral records for Chat Foreigners
 * 
 * Purpose: Create Referral records for users who have a referred_by field in Profile
 * but no corresponding Referral collection entry. This ensures existing users also
 * benefit from Chat Foreigners commission payouts.
 * 
 * Usage: node scripts/backfill-chat-foreigners-referrals.js
 */

import mongoose from 'mongoose';
import { Profile, Referral, connectToDatabase } from '../app/lib/models';

async function backfillReferrals() {
  try {
    console.log('[Backfill] Connecting to MongoDB...');
    await connectToDatabase();
    console.log('[Backfill] Connected!');

    // Find all Profile users who have a referred_by field but no corresponding Referral record
    const usersWithoutReferral = await Profile.find({
      referred_by: { $ne: null, $exists: true },
    })
      .select('_id username email referred_by')
      .lean();

    console.log(`[Backfill] Found ${usersWithoutReferral.length} users with referred_by field`);

    if (usersWithoutReferral.length === 0) {
      console.log('[Backfill] No users to process. All referrals are up to date!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Get existing referred_id values from Referral collection to avoid duplicates
    const existingReferrals = await Referral.find({}).select('referred_id').lean();
    const existingReferredIds = new Set(existingReferrals.map((r) => r.referred_id.toString()));

    console.log(`[Backfill] Found ${existingReferrals.length} existing Referral records`);

    // Filter users who don't already have a Referral record
    const usersToProcess = usersWithoutReferral.filter(
      (user) => !existingReferredIds.has(user._id.toString())
    );

    console.log(`[Backfill] ${usersToProcess.length} users need Referral records created`);

    if (usersToProcess.length === 0) {
      console.log('[Backfill] All users already have Referral records!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create Referral records in batches
    const batchSize = 100;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < usersToProcess.length; i += batchSize) {
      const batch = usersToProcess.slice(i, i + batchSize);

      for (const user of batch) {
        try {
          // Verify the referrer exists and is active
          const referrer = await Profile.findById(user.referred_by).select('_id approval_status status').lean();

          if (!referrer) {
            console.log(
              `[Backfill] ⚠️  Referrer not found for user ${user.username} (ID: ${user._id}). Skipping.`
            );
            skipped++;
            continue;
          }

          if (referrer.approval_status !== 'approved' || referrer.status !== 'active') {
            console.log(
              `[Backfill] ⚠️  Referrer is not active for user ${user.username}. Skipping.`
            );
            skipped++;
            continue;
          }

          // Check if Referral record already exists (in case of race condition)
          const existingRecord = await Referral.findOne({ referred_id: user._id });
          if (existingRecord) {
            console.log(`[Backfill] ℹ️  Referral already exists for ${user.username}. Skipping.`);
            skipped++;
            continue;
          }

          // Create the Referral record
          const referralRecord = await Referral.create({
            referrer_id: user.referred_by,
            referred_id: user._id,
            earning_cents: 0,
            status: 'active',
            referred_user_activated: false, // Will be set when user activates
          });

          created++;
          console.log(
            `[Backfill] ✓ Created Referral for ${user.username} → referrer ID: ${user.referred_by}`
          );

          // Optional: Log every 10 records
          if (created % 10 === 0) {
            console.log(`[Backfill] Progress: ${created} created, ${skipped} skipped, ${errors} errors`);
          }
        } catch (error) {
          errors++;
          console.error(
            `[Backfill] ✗ Error creating referral for ${user.username}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    console.log('\n[Backfill] === Summary ===');
    console.log(`Total users processed: ${usersToProcess.length}`);
    console.log(`Referral records created: ${created}`);
    console.log(`Records skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    if (created > 0) {
      console.log(
        `\n[Backfill] ✓ Successfully backfilled ${created} Referral records!`
      );
      console.log(
        '[Backfill] These users will now earn Chat Foreigners commissions when their downlines unlock persons.'
      );
    }

    await mongoose.disconnect();
    console.log('[Backfill] Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
backfillReferrals();
