/**
 * Migration script to fix users missing referred_by field
 * Run once to backfill referred_by for all users with referral records
 */

import { connectToDatabase, Profile, Referral, Transaction, Earning } from '@/app/lib/models';

async function fixMissingReferredBy() {
  console.log('Starting migration: Fix missing referred_by field\n');

  try {
    await connectToDatabase();
    console.log('Connected to database\n');

    // Find all referral records
    const allReferrals = await (Referral as any).find({}).lean();
    console.log(`Found ${allReferrals.length} referral records\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const referral of allReferrals) {
      try {
        const referredUser = await (Profile as any).findById(referral.referred_id);
        
        if (!referredUser) {
          console.log(`Skipping - Referred user not found: ${referral.referred_id}`);
          skippedCount++;
          continue;
        }

        // Check if referred_by is missing or wrong
        if (!referredUser.referred_by || referredUser.referred_by.toString() !== referral.referrer_id.toString()) {
          console.log(`\nFixing ${referredUser.username}:`);
          console.log(`  Old referred_by: ${referredUser.referred_by || 'MISSING'}`);
          console.log(`  New referred_by: ${referral.referrer_id}`);

          // Update the user
          await (Profile as any).findByIdAndUpdate(referredUser._id, {
            referred_by: referral.referrer_id
          });

          fixedCount++;
          
          // If user is activated and bonus not yet paid, calculate and award it
          if (referredUser.is_active && referredUser.approval_status === 'approved' && !referral.referral_bonus_paid) {
            console.log(`  User is active but bonus not paid - awarding KES 70 bonus...`);
            
            const referrer = await (Profile as any).findById(referral.referrer_id);
            if (!referrer) {
              console.log(`  ERROR: Referrer not found`);
              continue;
            }

            const BONUS_CENTS = 7000;

            // Create transaction
            const transaction = await (Transaction as any).create({
              target_type: 'user',
              target_id: referrer._id.toString(),
              user_id: referrer._id,
              amount_cents: BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${referredUser.username} [MIGRATED BACKFILL]`,
              status: 'completed',
              source: 'migration',
              balance_before_cents: referrer.balance_cents,
              balance_after_cents: referrer.balance_cents + BONUS_CENTS,
              metadata: {
                referred_user_id: referredUser._id.toString(),
                referred_username: referredUser.username,
                level: 1,
                migration: true
              }
            });

            // Create earning record
            const earning = await (Earning as any).create({
              user_id: referrer._id,
              amount_cents: BONUS_CENTS,
              type: 'REFERRAL',
              description: `Referral bonus for ${referredUser.username} [MIGRATED BACKFILL]`,
              source_id: referral._id,
              source_type: 'referral',
              transaction_id: transaction._id,
              processed: true,
              processed_at: new Date(),
              metadata: {
                level: 1,
                referred_user_id: referredUser._id.toString(),
                migration: true
              }
            });

            // Update referrer balance
            referrer.balance_cents += BONUS_CENTS;
            referrer.total_earnings_cents += BONUS_CENTS;
            await referrer.save();

            // Mark referral as paid
            await (Referral as any).findByIdAndUpdate(referral._id, {
              referral_bonus_paid: true,
              referral_bonus_amount_cents: BONUS_CENTS,
              bonus_paid_at: new Date(),
              status: 'bonus_paid',
              referred_user_activated: true,
              referred_user_activated_at: new Date(),
              metadata: {
                level: 1,
                bonus_amount: BONUS_CENTS,
                activated_via: 'migration_backfill'
              }
            });

            console.log(`  Transaction created: ${transaction._id}`);
            console.log(`  Referrer balance updated: KES ${(referrer.balance_cents / 100)}`);
          }
        } else {
          console.log(`${referredUser.username} - referred_by already correct`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`Error processing referral:`, error);
        skippedCount++;
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
fixMissingReferredBy().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
