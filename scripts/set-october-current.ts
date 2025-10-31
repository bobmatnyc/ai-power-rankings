#!/usr/bin/env tsx

/**
 * Set October 2025 Ranking as Current
 */

import { getDb, closeDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function setOctoberAsCurrent() {
  const db = getDb();

  console.log('\n🔄 Setting October 2025 as current ranking...\n');

  try {
    // First, unset all current rankings
    await db.update(rankings).set({ isCurrent: false });
    console.log('✓ Unmarked all rankings as current');

    // Set October 2025 as current
    const result = await db
      .update(rankings)
      .set({ isCurrent: true })
      .where(eq(rankings.period, '2025-10'))
      .returning({ period: rankings.period, version: rankings.algorithmVersion });

    if (result.length > 0) {
      console.log(`✓ Set ${result[0].period} (v${result[0].version}) as current`);
      console.log('\n✅ Success! October 2025 is now the current ranking.\n');
    } else {
      console.log('❌ October 2025 ranking not found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

setOctoberAsCurrent().catch(process.exit);
