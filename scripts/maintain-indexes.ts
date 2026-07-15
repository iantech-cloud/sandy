// Database Index Maintenance Script
// Run: npx ts-node scripts/maintain-indexes.ts

import mongoose from 'mongoose';
import { Profile, GamingWallet, GameResult, GamingTransaction, Transaction } from '@/app/lib/models';

const MONGODB_URI = process.env.MONGODB_URI;

async function maintainIndexes() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Collection list to maintain
    const collections = [
      { name: 'profiles', model: Profile },
      { name: 'gamingwallets', model: GamingWallet },
      { name: 'gameresults', model: GameResult },
      { name: 'gamingtransactions', model: GamingTransaction },
      { name: 'transactions', model: Transaction },
    ];

    for (const { name, model } of collections) {
      console.log(`\n📋 Processing ${name}...`);
      
      try {
        // Get current indexes
        const indexes = await model.collection.getIndexes();
        console.log(`   Current indexes: ${Object.keys(indexes).length}`);

        // Drop indexes except _id_
        const indexesToDrop = Object.keys(indexes).filter(idx => idx !== '_id_');
        for (const idx of indexesToDrop) {
          try {
            await model.collection.dropIndex(idx);
            console.log(`   ✓ Dropped index: ${idx}`);
          } catch (e) {
            // Index might have already been dropped
          }
        }

        // Recreate all indexes from schema
        await model.collection.dropIndexes();
        await model.syncIndexes();
        
        const newIndexes = await model.collection.getIndexes();
        console.log(`   ✅ Recreated ${Object.keys(newIndexes).length} indexes`);
      } catch (error) {
        console.error(`   ❌ Error processing ${name}:`, error);
      }
    }

    console.log('\n✅ Index maintenance complete');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

maintainIndexes();
