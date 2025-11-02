#!/usr/bin/env tsx
/**
 * Test Ranking Calculation for Duplicate Score Tools
 *
 * Calculate scores manually for the three tools to understand
 * why they're getting identical results
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';
import { RankingEngineV7, ALGORITHM_V7_WEIGHTS } from '../lib/ranking-algorithm-v7';

async function testRankingCalculation() {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection not available');
    process.exit(1);
  }

  console.log('🧮 Testing ranking calculation for duplicate score tools...\n');
  console.log('='.repeat(80));

  try {
    const suspectSlugs = ['google-jules', 'refact-ai', 'devin'];

    const toolsData = await db
      .select()
      .from(tools)
      .where(inArray(tools.slug, suspectSlugs));

    console.log(`\nTesting ${toolsData.length} tools with Algorithm v7.2\n`);

    const engine = new RankingEngineV7(ALGORITHM_V7_WEIGHTS);

    for (const tool of toolsData) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 ${tool.name} (${tool.slug})`);
      console.log(`${'='.repeat(80)}\n`);

      const toolData = tool.data as any;

      console.log('📋 Input Data:');
      console.log(`   Category: ${tool.category}`);
      console.log(`   Status: ${tool.status}`);
      console.log(`   Features: ${toolData.features?.length || 0}`);
      console.log(`   Has metrics: ${!!toolData.metrics}`);
      console.log(`   Has technical: ${!!toolData.technical}`);

      if (toolData.metrics) {
        console.log(`   Metrics keys: ${Object.keys(toolData.metrics).join(', ')}`);
      }
      if (toolData.technical) {
        console.log(`   Technical keys: ${Object.keys(toolData.technical).join(', ')}`);
      }

      const metrics = {
        tool_id: tool.id,
        name: tool.name,
        category: tool.category,
        status: tool.status,
        info: toolData,
      };

      try {
        const score = engine.calculateToolScore(metrics);

        console.log('\n📊 Calculated Scores:');
        console.log(`   Overall: ${score.overallScore.toFixed(2)}`);
        console.log('\n   Factor Scores:');
        Object.entries(score.factorScores).forEach(([factor, value]) => {
          console.log(`      ${factor}: ${value}`);
        });

      } catch (error) {
        console.error(`\n   ❌ Error calculating score: ${error}`);
        if (error instanceof Error) {
          console.error(`      ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔍 Analysis Complete\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error testing calculation:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRankingCalculation();
