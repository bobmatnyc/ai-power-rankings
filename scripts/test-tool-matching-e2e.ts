/**
 * End-to-end test of tool matching in article processing
 */

import { db } from '../lib/db/index.js';
import { rankings, tools } from '../lib/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

interface ToolMention {
  tool_name: string;
  tool_id?: string;
  is_new: boolean;
  context: string;
  importance_score: number;
}

async function getCurrentRankings() {
  const [latestRanking] = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (!latestRanking?.data) {
    return [];
  }

  // Fix Bug 1: Access correct data structure
  const dataObj = latestRanking.data as { rankings: any[] };
  const rankingArray = dataObj.rankings || [];

  // Fix Bug 2: Get tool names from database
  const toolIds = rankingArray.map((r) => r.tool_id).filter(Boolean);

  let toolMap = new Map<string, string>();
  if (toolIds.length > 0) {
    const toolsData = await db
      .select()
      .from(tools)
      .where(inArray(tools.id, toolIds));

    toolMap = new Map(toolsData.map((t) => [t.id, t.name]));
  }

  return rankingArray.map((item, index) => ({
    id: String(item.tool_id ?? `unknown_${index}`),
    tool_id: String(item.tool_id ?? `unknown_${index}`),
    tool_name: toolMap.get(item.tool_id) || item.tool_slug || 'Unknown Tool',
    name: toolMap.get(item.tool_id) || item.tool_slug || 'Unknown Tool',
    rank: typeof item.position === 'number' ? item.position : index + 1,
    score: typeof item.score === 'number' ? item.score : 0,
    metrics: item.factor_scores || {},
  }));
}

async function getExistingToolNames(): Promise<string[]> {
  const currentRankings = await getCurrentRankings();
  return currentRankings.map((r) => r.tool_name);
}

async function matchToolsAgainstDatabase(toolMentions: { tool_name: string }[]): Promise<ToolMention[]> {
  const existingTools = await getExistingToolNames();
  console.log('\n📚 Existing tools in database:', existingTools);

  // Get all tools from database for ID mapping
  const allTools = await db.select().from(tools);
  const toolNameToId = new Map(allTools.map((t) => [t.name.toLowerCase(), t.id]));

  const matched = toolMentions.map((mention) => {
    const toolNameLower = mention.tool_name.toLowerCase();
    const isExisting = existingTools.some((t) => t.toLowerCase() === toolNameLower);
    const toolId = toolNameToId.get(toolNameLower);

    return {
      tool_name: mention.tool_name,
      tool_id: toolId,
      is_new: !isExisting,
      context: `Test context for ${mention.tool_name}`,
      importance_score: 8,
    };
  });

  return matched;
}

async function testToolMatching() {
  console.log('🧪 End-to-End Tool Matching Test\n');
  console.log('=' .repeat(80));

  // Test cases: tools that should exist in the database
  const testToolMentions = [
    { tool_name: 'Cursor' },
    { tool_name: 'Windsurf' },
    { tool_name: 'GitHub Copilot' },
    { tool_name: 'Claude Dev' },
    { tool_name: 'Aider' },
    { tool_name: 'NonExistentTool123' }, // This should be marked as new
  ];

  console.log('\n📝 Testing with tool mentions:');
  testToolMentions.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.tool_name}`);
  });

  console.log('\n🔍 Matching tools against database...\n');

  const matchedTools = await matchToolsAgainstDatabase(testToolMentions);

  console.log('\n📊 Matching Results:\n');

  matchedTools.forEach((tool) => {
    const status = tool.is_new ? '🆕 NEW' : '✅ MATCHED';
    const hasId = tool.tool_id ? `ID: ${tool.tool_id.substring(0, 8)}...` : 'No ID';
    console.log(`   ${status} - ${tool.tool_name} (${hasId})`);
  });

  // Verify results
  console.log('\n' + '='.repeat(80));
  console.log('🎯 Verification:\n');

  const existingToolsMatched = matchedTools.filter(
    (t) => !t.is_new && ['cursor', 'windsurf', 'github copilot', 'claude dev', 'aider'].includes(t.tool_name.toLowerCase())
  );
  const newToolsDetected = matchedTools.filter((t) => t.is_new && t.tool_name === 'NonExistentTool123');
  const existingToolsWithIds = matchedTools.filter((t) => !t.is_new && t.tool_id);

  console.log(`   Existing tools correctly matched: ${existingToolsMatched.length}/5`);
  console.log(`   New tools correctly detected: ${newToolsDetected.length}/1`);
  console.log(`   Matched tools have IDs: ${existingToolsWithIds.length}/5`);

  const allCorrect = existingToolsMatched.length === 5 && newToolsDetected.length === 1 && existingToolsWithIds.length === 5;

  console.log('\n' + '='.repeat(80));
  console.log('🏆 Final Result:\n');

  if (allCorrect) {
    console.log('  ✅ SUCCESS - All tool matching tests passed!');
    console.log('  ✅ Bug 1 (data structure) - FIXED');
    console.log('  ✅ Bug 2 (tool names) - FIXED');
    console.log('\n  📝 Details:');
    console.log('     - Existing tools (Cursor, Windsurf, etc.) are correctly matched');
    console.log('     - All matched tools have valid tool_id values');
    console.log('     - Non-existent tools are correctly marked as new');
    console.log('     - Tool matching will now work in article analysis');
  } else {
    console.log('  ❌ FAILED - Some tool matching issues remain');
    if (existingToolsMatched.length < 5) {
      console.log(`     ❌ Only ${existingToolsMatched.length}/5 existing tools matched`);
    }
    if (newToolsDetected.length < 1) {
      console.log('     ❌ New tool detection not working');
    }
    if (existingToolsWithIds.length < 5) {
      console.log(`     ❌ Only ${existingToolsWithIds.length}/5 matched tools have IDs`);
    }
  }

  console.log('='.repeat(80));

  process.exit(allCorrect ? 0 : 1);
}

testToolMatching().catch((error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
