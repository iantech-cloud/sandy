/**
 * Script: backfill-chat-foreigners-referrals.ts
 *
 * One-time migration: ensures every existing user who was referred (has
 * Profile.referred_by set) also has a matching Referral collection record.
 * The Referral record is what the Chat Foreigners payment completion code
 * reads to look up who referred a user and therefore who should receive the
 * KES 60 commission when that user unlocks a personality.
 *
 * Safety guarantees
 * -----------------
 * 1. Skips users who already have a Referral record (idempotent).
 * 2. Skips users whose referred_by referrer no longer exists in Profile.
 * 3. Does NOT require the referrer to be approved/active — commission
 *    eligibility is checked at payout time, not here.
 * 4. Sets `referred_user_activated` correctly based on the referred user's
 *    own approval_status so downstream logic is consistent.
 * 5. Runs in serial batches of 100 to avoid overwhelming the DB.
 *
 * Usage
 * -----
 *   node --env-file-if-exists=/vercel/share/.env.project \
 *        -r ts-node/register scripts/backfill-chat-foreigners-referrals.ts
 *
 * Or compile first:
 *   npx tsc --module commonjs --esModuleInterop scripts/backfill-chat-foreigners-referrals.ts
 *   node scripts/backfill-chat-foreigners-referrals.js
 */

import mongoose from 'mongoose';
import { connectToDatabase, Profile, Referral } from '../app/lib/models';

async function backfillChatForeignersReferrals() {
  try {
    console.log('[Backfill] Connecting to MongoDB...');
    await connectToDatabase();
    console.log('[Backfill] Connected.');

    // ----------------------------------------------------------------
    // Step 1: Load all users who have a referred_by value
    // ----------------------------------------------------------------
    const usersWithReferredBy = await Profile.find({
      referred_by: { $ne: null, $exists: true },
    })
      .select('_id username email referred_by approval_status status')
      .lean();

    console.log(`[Backfill] Found ${usersWithReferredBy.length} users with referred_by set.`);

    if (usersWithReferredBy.length === 0) {
      console.log('[Backfill] Nothing to process. Exiting.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ----------------------------------------------------------------
    // Step 2: Build a set of referred_ids that already have a Referral
    //         record so we can skip them cheaply.
    // ----------------------------------------------------------------
    const existingReferralIds = await Referral.distinct('referred_id');
    const existingSet = new Set(existingReferralIds.map((id: unknown) => String(id)));

    const usersNeedingBackfill = usersWithReferredBy.filter(
      (u) => !existingSet.has(String(u._id))
    );

    console.log(
      `[Backfill] ${usersWithReferredBy.length - usersNeedingBackfill.length} already have Referral records.`
    );
    console.log(`[Backfill] ${usersNeedingBackfill.length} users need a Referral record created.`);

    if (usersNeedingBackfill.length === 0) {
      console.log('[Backfill] All referral records are up to date. Exiting.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ----------------------------------------------------------------
    // Step 3: Build a cache of referrer existence so we don't hit the
    //         DB repeatedly for the same referrer_id.
    // ----------------------------------------------------------------
    const referrerIdSet = new Set(
      usersNeedingBackfill.map((u) => String(u.referred_by))
    );
    const existingReferrers = await Profile.find({
      _id: { $in: Array.from(referrerIdSet) },
    })
      .select('_id')
      .lean();
    const validReferrerIds = new Set(existingReferrers.map((r) => String(r._id)));

    // ----------------------------------------------------------------
    // Step 4: Create Referral records in batches
    // ----------------------------------------------------------------
    const BATCH = 100;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < usersNeedingBackfill.length; i += BATCH) {
      const batch = usersNeedingBackfill.slice(i, i + BATCH);

      for (const user of batch) {
        const referrerId = String(user.referred_by);

        if (!validReferrerIds.has(referrerId)) {
          console.warn(
            `[Backfill] Referrer ${referrerId} not found for user ${user.username ?? user._id}. Skipping.`
          );
          skipped++;
          continue;
        }

        try {
          // Double-check — guard against a race between Step 2 and now
          const alreadyExists = await Referral.findOne({ referred_id: String(user._id) }).lean();
          if (alreadyExists) {
            skipped++;
            continue;
          }

          const isActivated =
            user.approval_status === 'approved' && user.status === 'active';

          await Referral.create({
            referrer_id: referrerId,
            referred_id: String(user._id),
            earning_cents: 0,
            status: 'active',
            referred_user_activated: isActivated,
          });

          created++;

          if (created % 50 === 0) {
            console.log(
              `[Backfill] Progress: ${created} created | ${skipped} skipped | ${errors} errors`
            );
          }
        } catch (err: unknown) {
          // Unique-key violation means a record was inserted by another
          // process between our check and insert — that is fine.
          const mongoErr = err as { code?: number; message?: string };
          if (mongoErr.code === 11000) {
            skipped++;
          } else {
            errors++;
            console.error(
              `[Backfill] Error for user ${user.username ?? user._id}:`,
              mongoErr.message ?? err
            );
          }
        }
      }
    }

    // ----------------------------------------------------------------
    // Step 5: Summary
    // ----------------------------------------------------------------
    console.log('\n[Backfill] === Completed ===');
    console.log(`  Users processed : ${usersNeedingBackfill.length}`);
    console.log(`  Records created : ${created}`);
    console.log(`  Skipped         : ${skipped}`);
    console.log(`  Errors          : ${errors}`);

    if (created > 0) {
      console.log(
        `\n[Backfill] ${created} Referral records created. These users' referrers will now` +
          ' receive KES 60 commissions when those users unlock Chat Foreigners personalities.'
      );
    }

    await mongoose.disconnect();
    console.log('[Backfill] Disconnected. Done.');
    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
  }
}

backfillChatForeignersReferrals();
