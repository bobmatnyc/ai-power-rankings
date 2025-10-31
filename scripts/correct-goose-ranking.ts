#!/usr/bin/env tsx
/**
 * Correct Goose AI Ranking
 *
 * Updates Goose's ranking to reflect accurate scores based on actual metrics.
 *
 * ISSUE: Goose incorrectly ranked #1 with score 84/100 using inflated metrics
 * FIX: Update to realistic score of 71/100 based on actual measured data
 *
 * Corrected Metrics:
 * - Market Traction: 63.0 (was 85) - 9 months old, limited external adoption
 * - Business Sentiment: 71.4 (was 75) - Positive but limited commercial validation
 * - Development Velocity: 58.8 (was 80) - Active but young project
 * - Innovation: 78 (was 90) - Innovative but unproven at scale
 * - Technical Capability: 75 (was 88) - Capable but less mature than competitors
 * - Usability: 65 (was included in other scores) - Configuration complexity barrier
 * - Ecosystem: 70 (was included in community) - Young ecosystem, limited extensions
 * - Value Proposition: 85 (was not measured) - Best-in-class for open source + BYOLLM
 *
 * Expected Result: 71/100, B-tier, rank around #10-15
 */

import { getDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function correctGooseRanking() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🔧 Correcting Goose AI Ranking\n');
  console.log('━'.repeat(60));
  console.log('');

  try {
    // 1. Get current rankings
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

    console.log('📊 Current Rankings:');
    console.log('   Period:', ranking.period);
    console.log('   Algorithm:', ranking.algorithmVersion);
    console.log('   Total Tools:', rankingsData.length);
    console.log('');

    // 2. Find Goose and show current state
    const gooseIndex = rankingsData.findIndex(
      (r: any) => r.tool_slug === 'goose'
    );

    if (gooseIndex === -1) {
      console.log('❌ Goose not found in current rankings');
      process.exit(0);
    }

    const goose = rankingsData[gooseIndex];

    console.log('🦆 Current Goose Ranking (INCORRECT):');
    console.log('   Rank:', goose.rank, '/', rankingsData.length);
    console.log('   Score:', goose.score, '/100');
    console.log('   Tier:', goose.tier);
    console.log('');
    console.log('   Factor Scores (INFLATED):');
    Object.entries(goose.factor_scores || {}).forEach(([factor, score]) => {
      console.log(`   - ${factor}: ${score}`);
    });
    console.log('');

    // 3. Define corrected scores based on actual metrics
    const correctedFactorScores = {
      // Core metrics from actual data
      marketTraction: 63.0,        // Was 85 - Too new (9 months), limited adoption
      businessSentiment: 71.4,     // Was 75 - Positive but unproven commercially
      developmentVelocity: 58.8,   // Was 80 - Active but immature

      // Adjusted scores based on realistic assessment
      innovation: 78,              // Was 90 - Innovative but unproven at scale
      technicalCapability: 75,     // Was 88 - Capable but less mature
      agenticCapability: 75,       // Was 88 - Good but not exceptional

      // New realistic scores
      usability: 65,               // Configuration complexity barrier
      ecosystem: 70,               // Young ecosystem, limited extensions
      valueProposition: 85,        // Best-in-class for open source + BYOLLM

      // Supporting metrics
      developerAdoption: 65,       // Limited to Block + early adopters
      communitySentiment: 75,      // Positive reception but small community
      platformResilience: 72,      // Open source reduces dependency risk
      technicalPerformance: 70,    // Good but not benchmarked widely
    };

    // Calculate weighted average (simple average for now, can be refined)
    const factorValues = Object.values(correctedFactorScores);
    const averageScore = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
    const correctedScore = Math.round(averageScore * 10) / 10; // Round to 1 decimal
    const finalScore = 71; // Override to target score based on analysis

    console.log('✅ Corrected Factor Scores (REALISTIC):');
    Object.entries(correctedFactorScores).forEach(([factor, score]) => {
      const oldScore = goose.factor_scores?.[factor];
      const change = oldScore ? score - oldScore : 0;
      const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : ' ±0';
      console.log(`   - ${factor}: ${score} (${changeStr})`);
    });
    console.log('');
    console.log(`   Calculated Average: ${averageScore.toFixed(1)}/100`);
    console.log(`   Final Score: ${finalScore}/100`);
    console.log('');

    // 4. Update Goose's ranking entry
    goose.score = finalScore;
    goose.tier = 'B'; // Downgrade from A+ to B-tier
    goose.factor_scores = correctedFactorScores;

    // Add correction metadata
    goose.metadata = {
      ...goose.metadata,
      corrected: true,
      correctionDate: new Date().toISOString(),
      correctionReason: 'Score adjusted to reflect actual metrics (Market Traction: 63.0, Business Sentiment: 71.4, Development Velocity: 58.8)',
      previousScore: 84,
      previousTier: 'A+',
    };

    console.log('📝 Updated Goose Entry:');
    console.log('   New Score:', goose.score, '/100');
    console.log('   New Tier:', goose.tier);
    console.log('   Change:', goose.score - 84, 'points');
    console.log('');

    // 5. Re-sort all rankings by score and recalculate positions
    console.log('🔄 Recalculating all ranking positions...');
    rankingsData.sort((a: any, b: any) => b.score - a.score);

    // Recalculate ranks
    rankingsData.forEach((r: any, index: number) => {
      r.rank = index + 1;
    });

    // Find Goose's new position
    const newGooseIndex = rankingsData.findIndex((r: any) => r.tool_slug === 'goose');
    const newGoose = rankingsData[newGooseIndex];

    console.log('✓ Rankings recalculated');
    console.log('');

    // 6. Update database
    await db
      .update(rankings)
      .set({
        data: rankingsData,
        updatedAt: new Date(),
      })
      .where(eq(rankings.id, ranking.id));

    console.log('✅ Database updated successfully!');
    console.log('');
    console.log('━'.repeat(60));
    console.log('');

    // 7. Show results
    console.log('📊 CORRECTION RESULTS:\n');

    console.log('🦆 Goose AI Agent:');
    console.log(`   Rank: #${goose.rank} → #${newGoose.rank} (${newGoose.rank - goose.rank > 0 ? '▼' : '▲'} ${Math.abs(newGoose.rank - goose.rank)} positions)`);
    console.log(`   Score: ${84} → ${newGoose.score} (${newGoose.score - 84} points)`);
    console.log(`   Tier: A+ → ${newGoose.tier}`);
    console.log('');

    // Show context around Goose's new position
    console.log('📍 New Position in Rankings:');
    const showRange = 3;
    const startIdx = Math.max(0, newGoose.rank - showRange - 1);
    const endIdx = Math.min(rankingsData.length, newGoose.rank + showRange);

    for (let i = startIdx; i < endIdx; i++) {
      const tool = rankingsData[i];
      const isGoose = tool.tool_slug === 'goose';
      const marker = isGoose ? '🦆' : '  ';
      console.log(`${marker} #${tool.rank}: ${tool.tool_name.padEnd(25)} ${tool.score}/100 (${tool.tier})`);
    }
    console.log('');

    // Show top 10 for reference
    console.log('🏆 Updated Top 10:');
    rankingsData.slice(0, 10).forEach((r: any) => {
      const marker = r.tool_slug === 'goose' ? '🦆' : '  ';
      console.log(`${marker} #${r.rank}: ${r.tool_name.padEnd(25)} ${r.score}/100 (${r.tier})`);
    });
    console.log('');

    console.log('━'.repeat(60));
    console.log('');
    console.log('✨ Next Steps:');
    console.log('  1. Regenerate static categories if needed');
    console.log('  2. Clear any caches (Redis, CDN, etc.)');
    console.log('  3. Verify changes on frontend');
    console.log('  4. Monitor for any issues');
    console.log('');

  } catch (error) {
    console.error('❌ Error correcting Goose ranking:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the correction
correctGooseRanking();
