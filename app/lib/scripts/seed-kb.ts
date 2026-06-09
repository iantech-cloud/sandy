/**
 * Seed HustleHub Knowledge Base to MongoDB
 * 
 * Run: npx ts-node app/lib/scripts/seed-kb.ts
 * Or: node -r ts-node/register app/lib/scripts/seed-kb.ts
 */

import { connectToDatabase, KnowledgeBase } from '@/app/lib/models';
import { HUSTLEHUB_KNOWLEDGE_BASE } from '../services/hustlehub-kb-seed';

async function seedKB() {
  try {
    console.log('[KB Seed] Connecting to database...');
    await connectToDatabase();

    console.log('[KB Seed] Checking existing entries...');
    const existingCount = await KnowledgeBase.countDocuments();
    console.log(`[KB Seed] Found ${existingCount} existing KB entries`);

    // Option 1: Replace all (recommended for first-time seed)
    if (process.argv.includes('--replace')) {
      console.log('[KB Seed] Deleting all existing KB entries...');
      await KnowledgeBase.deleteMany({});
      console.log('[KB Seed] All entries deleted');
    }

    // Option 2: Only insert new entries not already in DB
    console.log('[KB Seed] Inserting/updating KB entries...');
    const upsertedCount = await Promise.all(
      HUSTLEHUB_KNOWLEDGE_BASE.map((entry) =>
        KnowledgeBase.updateOne(
          { id: entry.id },
          { $set: entry },
          { upsert: true }
        )
      )
    );

    const insertedCount = upsertedCount.filter(
      (result) => result.upsertedId !== null && result.upsertedId !== undefined
    ).length;

    console.log(`[KB Seed] Successfully seeded ${HUSTLEHUB_KNOWLEDGE_BASE.length} KB entries`);
    console.log(`[KB Seed] New entries inserted: ${insertedCount}`);
    console.log('[KB Seed] Seed completed successfully!');

    // Verify
    const finalCount = await KnowledgeBase.countDocuments();
    console.log(`[KB Seed] Total KB entries now: ${finalCount}`);
  } catch (error) {
    console.error('[KB Seed] Error:', error);
    process.exit(1);
  }
}

// Run seed
seedKB();
