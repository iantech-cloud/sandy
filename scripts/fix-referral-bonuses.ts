/**
 * Script to fix referral bonuses - Ensures referrers are credited with KES 70 (7,000 cents)
 * and company gets KES 20 (2,000 cents), not the old incorrect amounts
 * 
 * Usage: node --env-file-if-exists=/vercel/share/.env.project scripts/fix-referral-bonuses.ts
 */

import { connectToDatabase, Referral, Transaction, Profile, Company } from '@/app/lib/models';

async function fixReferralBonuses() {
  console.log('🔄 Starting referral bonus fix...');
  console.log('');

  try {
    await connectToDatabase();
    console.log('✅ Connected to database');

    // Get all referrals that have been paid but with incorrect amounts
    const incorrectBonuses = await (Referral as any).find({
      referral_bonus_paid: true,
      referral_bonus_amount_cents: { $ne: 7000 } // Not equal to KES 70
    }).lean();

    console.log(`📊 Found ${incorrectBonuses.length} referrals with incorrect bonus amounts\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const referral of incorrectBonuses) {
      try {
        const referrer = await (Profile as any).findById(referral.referrer_id);
        const referred = await (Profile as any).findById(referral.referred_id);

        if (!referrer || !referred) {
          console.log(`⚠️  Skipping referral ${referral._id} - referrer or referred user not found`);
          skippedCount++;
          continue;
        }

        const oldAmount = referral.referral_bonus_amount_cents || 0;
        const newAmount = 7000; // KES 70
        const difference = newAmount - oldAmount;

        console.log(`\n📝 Fixing referral: ${referrer.username} → ${referred.username}`);
        console.log(`   Old amount: KES ${oldAmount / 100}`);
        console.log(`   New amount: KES ${newAmount / 100}`);
        console.log(`   Difference: KES ${difference / 100}`);

        // Update referral record
        await (Referral as any).findByIdAndUpdate(referral._id, {
          referral_bonus_amount_cents: newAmount,
          metadata: {
            ...referral.metadata,
            corrected_at: new Date().toISOString(),
            original_amount: oldAmount
          }
        });

        // Check if there's a transaction for this referral
        const existingTransaction = await (Transaction as any).findOne({
          user_id: referrer._id,
          type: 'REFERRAL',
          'metadata.referral_id': referral._id.toString()
        });

        if (existingTransaction && difference !== 0) {
          console.log(`   ⚙️  Adjusting transaction...`);
          
          // Update the transaction
          existingTransaction.amount_cents = newAmount;
          existingTransaction.balance_after_cents = existingTransaction.balance_before_cents + newAmount;
          existingTransaction.metadata = {
            ...existingTransaction.metadata,
            corrected_at: new Date().toISOString(),
            original_amount: oldAmount
          };
          await existingTransaction.save();

          // Adjust referrer's balance
          const balanceAdjustment = difference;
          await (Profile as any).findByIdAndUpdate(referrer._id, {
            $inc: {
              balance_cents: balanceAdjustment,
              total_earnings_cents: balanceAdjustment
            }
          });

          console.log(`   ✅ Updated referrer balance: +KES ${balanceAdjustment / 100}`);
        } else if (!existingTransaction) {
          console.log(`   ⚠️  No transaction found for this referral - creating one...`);
          
          // Create missing transaction
          const newTransaction = await (Transaction as any).create({
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
              correction_date: new Date().toISOString()
            }
          });

          // Update referrer balance
          await (Profile as any).findByIdAndUpdate(referrer._id, {
            $inc: {
              balance_cents: newAmount,
              total_earnings_cents: newAmount
            }
          });

          console.log(`   ✅ Created transaction & updated referrer balance: +KES ${newAmount / 100}`);
        }

        fixedCount++;
        
      } catch (error) {
        console.error(`❌ Error fixing referral ${referral._id}:`, error);
        skippedCount++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   Total processed: ${fixedCount + skippedCount}`);
    
    // Recalculate company financials
    console.log(`\n📈 Updating company financial records...`);
    const company = await (Company as any).findOne({ email: 'company@hustlehubafrica.com' });
    
    if (company) {
      // Recalculate from transactions
      const revenueTransactions = await (Transaction as any).find({
        target_type: 'company',
        status: 'completed'
      }).lean();

      const totalRevenue = revenueTransactions.reduce((sum: number, tx: any) => sum + tx.amount_cents, 0);
      
      company.total_revenue_cents = totalRevenue;
      company.wallet_balance_cents = totalRevenue - (company.total_expenses_cents || 0);
      await company.save();

      console.log(`   ✅ Company financials updated`);
    }

    console.log(`\n🎉 Referral bonus fix completed!`);

  } catch (error) {
    console.error('❌ Error in referral bonus fix:', error);
    process.exit(1);
  }
}

// Run the fix
fixReferralBonuses().then(() => {
  console.log('\n✅ All done!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
