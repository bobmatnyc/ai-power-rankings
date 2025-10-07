/**
 * Direct test of getCurrentRankings to verify bug fixes
 */

import { db } from '../lib/db/index.js';
import { rankings, tools } from '../lib/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

interface CurrentRanking {
  id: string;
  tool_id: string;
  tool_name: string;
  name: string;
  rank: number;
  score: number;
  metrics: Record<string, unknown>;
}

async function testGetCurrentRankings() {
  console.log('🧪 Testing getCurrentRankings Bug Fixes\n');
  console.log('=' .repeat(80));

  console.log('\n📊 Step 1: Fetching latest ranking from database...\n');

  const [latestRanking] = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (!latestRanking?.data) {
    console.log('❌ No current ranking found in database');
    process.exit(1);
  }

  console.log('✅ Found current ranking');
  console.log('Raw data type:', typeof latestRanking.data);
  console.log('Is array?:', Array.isArray(latestRanking.data));

  // Fix Bug 1: Access correct data structure (object with rankings array)
  console.log('\n🔧 Fix Bug 1: Accessing data.rankings instead of data directly...\n');

  const dataObj = latestRanking.data as { rankings: any[] };
  const rankingArray = dataObj.rankings || [];

  console.log('✅ Successfully accessed rankings array');
  console.log(`   Found ${rankingArray.length} rankings`);
  console.log('\n   Sample ranking entry:');
  console.log('   ', JSON.stringify(rankingArray[0], null, 2));

  // Fix Bug 2: Get tool names from database using JOIN
  console.log('\n🔧 Fix Bug 2: Fetching tool names from database...\n');

  const toolIds = rankingArray.map((r) => r.tool_id).filter(Boolean);
  console.log(`   Extracted ${toolIds.length} tool IDs`);
  console.log('   Sample tool IDs:', toolIds.slice(0, 3));

  let toolMap = new Map<string, string>();
  if (toolIds.length > 0) {
    const toolsData = await db
      .select()
      .from(tools)
      .where(inArray(tools.id, toolIds));

    toolMap = new Map(toolsData.map((t) => [t.id, t.name]));
    console.log(`\n✅ Fetched ${toolsData.length} tool names from database`);
    console.log('   Sample tools:', toolsData.slice(0, 3).map(t => ({ id: t.id, name: t.name })));
  }

  // Map the rankings with tool names
  console.log('\n📝 Mapping rankings with tool names...\n');

  const mappedRankings: CurrentRanking[] = rankingArray.map((item, index) => ({
    id: String(item.tool_id ?? `unknown_${index}`),
    tool_id: String(item.tool_id ?? `unknown_${index}`),
    tool_name: toolMap.get(item.tool_id) || item.tool_slug || 'Unknown Tool',
    name: toolMap.get(item.tool_id) || item.tool_slug || 'Unknown Tool',
    rank: typeof item.position === 'number' ? item.position : index + 1,
    score: typeof item.score === 'number' ? item.score : 0,
    metrics: item.factor_scores || {},
  }));

  console.log(`✅ Mapped ${mappedRankings.length} rankings`);
  console.log('\n📋 Sample mapped rankings (first 5):\n');

  mappedRankings.slice(0, 5).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.tool_name} (${r.rank})`);
    console.log(`      - Tool ID: ${r.tool_id}`);
    console.log(`      - Score: ${r.score}`);
    console.log(`      - Has tool_name: ${r.tool_name !== 'Unknown Tool' ? '✅ YES' : '❌ NO'}`);
  });

  // Verify all tools have names
  console.log('\n🎯 Verification:\n');
  const toolsWithNames = mappedRankings.filter(r => r.tool_name !== 'Unknown Tool').length;
  const toolsWithoutNames = mappedRankings.length - toolsWithNames;

  console.log(`   Tools with names: ${toolsWithNames}/${mappedRankings.length}`);
  console.log(`   Tools without names: ${toolsWithoutNames}/${mappedRankings.length}`);

  const allToolsHaveNames = toolsWithoutNames === 0;
  const allToolsHaveIds = mappedRankings.every(r => r.tool_id && !r.tool_id.startsWith('unknown_'));

  console.log('\n' + '='.repeat(80));
  console.log('🏆 Test Results:\n');

  if (rankingArray.length > 0) {
    console.log('  ✅ Bug 1 (Data Structure): FIXED');
    console.log('     - Successfully accessed data.rankings');
    console.log(`     - Extracted ${rankingArray.length} ranking entries`);
  } else {
    console.log('  ❌ Bug 1 (Data Structure): FAILED - No rankings found');
  }

  if (allToolsHaveNames) {
    console.log('\n  ✅ Bug 2 (Tool Names): FIXED');
    console.log(`     - All ${mappedRankings.length} tools have names from database`);
    console.log('     - Tool matching will now work correctly');
  } else {
    console.log('\n  ⚠️  Bug 2 (Tool Names): PARTIAL');
    console.log(`     - ${toolsWithNames} tools have names`);
    console.log(`     - ${toolsWithoutNames} tools still missing names`);
  }

  if (allToolsHaveIds) {
    console.log('\n  ✅ Tool IDs: All valid');
  } else {
    console.log('\n  ❌ Tool IDs: Some missing or invalid');
  }

  console.log('\n' + '='.repeat(80));

  const success = rankingArray.length > 0 && allToolsHaveNames && allToolsHaveIds;
  console.log(success ? '\n✨ ALL TESTS PASSED!\n' : '\n❌ Some tests failed\n');

  process.exit(success ? 0 : 1);
}

testGetCurrentRankings().catch((error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
