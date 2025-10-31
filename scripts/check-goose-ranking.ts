#!/usr/bin/env tsx
/**
 * Check Goose's Current Ranking
 * Displays Goose's current position, score, and factor scores
 */

import { getDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkGooseRanking() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🦆 Checking Goose ranking...\n');

  try {
    // Get current rankings
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

    console.log('📊 Current Rankings Period:', ranking.period);
    console.log('   Algorithm Version:', ranking.algorithmVersion);
    console.log('   Total Tools:', rankingsData.length);
    console.log('');

    // Find Goose
    const goose = rankingsData.find(
      (r: any) => r.tool_slug === 'goose'
    );

    if (!goose) {
      console.log('❌ Goose not found in current rankings');
      process.exit(0);
    }

    console.log('🦆 Goose Ranking Details:');
    console.log('   Rank:', goose.rank, '/', rankingsData.length);
    console.log('   Score:', goose.score, '/100');
    console.log('   Tier:', goose.tier);
    console.log('   Category:', goose.category);
    console.log('');

    console.log('📈 Factor Scores:');
    const factorScores = goose.factor_scores || {};
    Object.entries(factorScores).forEach(([factor, score]) => {
      console.log(`   ${factor}:`, score);
    });
    console.log('');

    // Show top 10 for context
    console.log('🏆 Top 10 Tools for Context:');
    rankingsData.slice(0, 10).forEach((r: any) => {
      const marker = r.tool_slug === 'goose' ? '🦆' : '  ';
      console.log(`${marker} #${r.rank}: ${r.tool_name} - ${r.score}/100 (${r.tier})`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error checking Goose ranking:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

checkGooseRanking();
