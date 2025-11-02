#!/usr/bin/env tsx
/**
 * Find All Tools with Duplicate Scores
 *
 * Check the October 2025 rankings for all tools with identical scores
 */

import { getDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function findAllDuplicateScores() {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection not available');
    process.exit(1);
  }

  console.log('🔍 Finding all duplicate scores in October 2025 rankings...\n');

  try {
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, '2025-10'))
      .limit(1);

    if (currentRankings.length === 0) {
      console.log('❌ No October 2025 rankings found!');
      process.exit(1);
    }

    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any[];

    console.log(`Total tools: ${rankingsData.length}\n`);

    // Group by score signature
    const scoreGroups = new Map<string, any[]>();

    for (const tool of rankingsData) {
      const scoreKey = JSON.stringify({
        score: tool.score,
        factor_scores: tool.factor_scores
      });

      if (!scoreGroups.has(scoreKey)) {
        scoreGroups.set(scoreKey, []);
      }
      scoreGroups.get(scoreKey)!.push(tool);
    }

    // Find groups with more than one tool
    const duplicateGroups = Array.from(scoreGroups.values())
      .filter(group => group.length > 1)
      .sort((a, b) => b.length - a.length); // Sort by group size

    console.log(`Found ${duplicateGroups.length} duplicate score groups\n`);
    console.log('='.repeat(80));

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate scores found!');
      process.exit(0);
    }

    let totalAffected = 0;
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      totalAffected += group.length;

      console.log(`\n❌ Duplicate Group ${i + 1}: ${group.length} tools with identical scores`);
      console.log(`   Overall Score: ${group[0].score}`);
      console.log(`   Tools:`);

      group.forEach(tool => {
        console.log(`      - ${tool.tool_slug} (${tool.tool_name}) - Rank #${tool.rank}`);
      });

      console.log(`\n   Factor Scores:`);
      Object.entries(group[0].factor_scores).forEach(([factor, score]) => {
        console.log(`      ${factor}: ${score}`);
      });

      console.log('\n' + '-'.repeat(80));
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Duplicate groups: ${duplicateGroups.length}`);
    console.log(`Total tools affected: ${totalAffected}`);
    console.log(`Percentage of tools: ${((totalAffected / rankingsData.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    process.exit(1); // Exit with error code since duplicates exist

  } catch (error) {
    console.error('\n❌ Error finding duplicates:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

findAllDuplicateScores();
