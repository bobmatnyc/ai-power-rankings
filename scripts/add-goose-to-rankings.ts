#!/usr/bin/env tsx
/**
 * Add Goose to Current Rankings
 *
 * Inserts Goose AI Agent into the current rankings (2025-10)
 * with a power ranking of 84/100 (A+ tier).
 *
 * Usage: npx tsx scripts/add-goose-to-rankings.ts
 */

import { getDb } from '../lib/db/connection';
import { rankings, tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function addGooseToRankings() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🦆 Adding Goose to current rankings...\n');

  try {
    // 1. Get Goose tool from database
    const gooseTools = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, 'goose'))
      .limit(1);

    if (gooseTools.length === 0) {
      console.error('❌ Goose tool not found in database');
      console.error('   Run: npx tsx scripts/add-goose-tool.ts first');
      process.exit(1);
    }

    const gooseTool = gooseTools[0];
    console.log('✓ Found Goose tool in database');
    console.log('  ID:', gooseTool.id);
    console.log('  Slug:', gooseTool.slug);
    console.log('  Name:', gooseTool.name);
    console.log('');

    // 2. Get current rankings
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.error('❌ No current rankings found');
      console.error('   Cannot add Goose without an active ranking period');
      process.exit(1);
    }

    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any[];

    console.log('✓ Found current rankings');
    console.log('  Period:', ranking.period);
    console.log('  Algorithm:', ranking.algorithmVersion);
    console.log('  Current tools:', rankingsData.length);
    console.log('');

    // 3. Check if Goose already exists in rankings
    const existingGoose = rankingsData.find(
      (r: any) => r.tool_slug === 'goose' || r.tool_id === gooseTool.id
    );

    if (existingGoose) {
      console.log('⚠️  Goose already exists in rankings');
      console.log('  Current rank:', existingGoose.rank);
      console.log('  Current score:', existingGoose.score);
      console.log('');
      console.log('❓ Would you like to update instead?');
      console.log('   Manually update the ranking entry if needed');
      process.exit(0);
    }

    // 4. Create Goose ranking entry
    // Position: Score of 84 should place it around rank 4-6
    const gooseRanking = {
      rank: 0, // Will be recalculated after insertion
      tier: 'A+',
      score: 84,
      status: 'active',
      tool_id: gooseTool.id,
      category: gooseTool.category,
      movement: {
        change: 0,
        direction: 'new',
        previous_position: null
      },
      tool_name: gooseTool.name,
      tool_slug: gooseTool.slug,
      factor_scores: {
        innovation: 90,
        marketTraction: 85,
        agenticCapability: 88,
        businessSentiment: 75,
        developerAdoption: 85,
        communitySentiment: 82,
        platformResilience: 75,
        developmentVelocity: 80,
        technicalCapability: 88,
        technicalPerformance: 80
      }
    };

    // 5. Insert Goose into rankings array
    const updatedRankings = [...rankingsData, gooseRanking];

    // 6. Sort by score (descending) and recalculate ranks
    updatedRankings.sort((a: any, b: any) => b.score - a.score);
    updatedRankings.forEach((r: any, index: number) => {
      r.rank = index + 1;
    });

    console.log('✓ Created Goose ranking entry');
    console.log('  Score:', gooseRanking.score);
    console.log('  Tier:', gooseRanking.tier);
    console.log('');

    // 7. Update rankings in database
    await db
      .update(rankings)
      .set({
        data: updatedRankings,
        updatedAt: new Date()
      })
      .where(eq(rankings.id, ranking.id));

    console.log('✅ Goose added to rankings successfully!\n');

    // 8. Find Goose's new rank
    const gooseInRankings = updatedRankings.find((r: any) => r.tool_slug === 'goose');

    console.log('📊 Ranking Results:');
    console.log('  Goose Rank:', gooseInRankings?.rank, '/', updatedRankings.length);
    console.log('  Score:', gooseInRankings?.score);
    console.log('  Tier:', gooseInRankings?.tier);
    console.log('  Category:', gooseInRankings?.category);
    console.log('');

    // 9. Show surrounding tools
    const gooseRank = gooseInRankings?.rank || 0;
    console.log('📍 Position in Rankings:');

    const showRange = 2; // Show 2 tools above and below
    const startIdx = Math.max(0, gooseRank - showRange - 1);
    const endIdx = Math.min(updatedRankings.length, gooseRank + showRange);

    for (let i = startIdx; i < endIdx; i++) {
      const tool = updatedRankings[i];
      const isGoose = tool.tool_slug === 'goose';
      const marker = isGoose ? '→' : ' ';
      const highlight = isGoose ? '🦆 ' : '';
      console.log(`  ${marker} ${highlight}#${tool.rank}: ${tool.tool_name} (${tool.score})`);
    }
    console.log('');

    console.log('✨ Next Steps:');
    console.log('  1. Regenerate static categories: npm run generate-categories');
    console.log('  2. Add tool logo: /public/tools/goose.png');
    console.log('  3. Verify tool page: /en/tools/goose');
    console.log('  4. Deploy changes to production');
    console.log('');

  } catch (error) {
    console.error('❌ Error adding Goose to rankings:', error);

    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }

    process.exit(1);
  }
}

// Run the script
addGooseToRankings();
