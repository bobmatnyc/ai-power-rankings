#!/usr/bin/env tsx
/**
 * Final Goose Ranking Verification
 *
 * Validates that the v7.2 algorithm correction was applied correctly
 */

import { getDb, closeDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function finalVerification() {
  const db = getDb();
  if (!db) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n✅ Final Goose Ranking Verification Report\n');
  console.log('='.repeat(80));
  console.log('');

  try {
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.error('❌ No current rankings found');
      process.exit(1);
    }

    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any[];

    console.log('📋 Ranking Metadata:');
    console.log('   Period:           ', ranking.period);
    console.log('   Algorithm Version:', ranking.algorithmVersion);
    console.log('   Total Tools:      ', rankingsData.length);
    console.log('');

    const goose = rankingsData.find((r: any) => r.tool_slug === 'goose');
    if (!goose) {
      console.log('❌ CRITICAL: Goose not found');
      process.exit(1);
    }

    console.log('🦆 Goose Ranking Status:');
    console.log('   Rank:  #' + goose.rank + ' / ' + rankingsData.length);
    console.log('   Score: ' + goose.score + '/100');
    console.log('   Tier:  ' + goose.tier);
    console.log('');

    const tests = [
      { name: 'NOT ranked #1', pass: goose.rank > 1 },
      { name: 'Realistic range', pass: goose.rank >= 35 },
      { name: 'Appropriate score', pass: goose.score < 60 }
    ];

    console.log('✅ Verification:');
    const allPass = tests.every(t => {
      console.log('   ' + (t.pass ? '✅' : '❌') + ' ' + t.name);
      return t.pass;
    });
    console.log('');

    if (allPass) {
      console.log('🎉 SUCCESS! Goose ranking corrected (#1 → #' + goose.rank + ')');
    } else {
      console.log('❌ FAILED: Correction incomplete');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

finalVerification();
