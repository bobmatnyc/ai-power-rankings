import { db } from '../lib/db';
import { tools, rankings } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function checkScores() {
  console.log('='.repeat(100));
  console.log('CHECKING THE 7 UPDATED TOOLS');
  console.log('='.repeat(100));

  const toolNames = [
    'OpenAI Codex',
    'Greptile',
    'Google Gemini CLI',
    'Graphite',
    'Qwen Code',
    'GitLab Duo',
    'Anything Max'
  ];

  for (const name of toolNames) {
    const toolRecords = await db
      .select()
      .from(tools)
      .where(eq(tools.name, name));

    if (toolRecords.length > 0) {
      const tool = toolRecords[0];
      console.log(`\n${name}:`);
      console.log(`  ID: ${tool.id}`);
      console.log(`  Score: ${tool.score ?? 'NULL'}`);
      console.log(`  Category: ${tool.category}`);
      console.log(`  Description length: ${tool.description?.length || 0} characters`);
      console.log(`  Description preview: ${tool.description?.substring(0, 100) || 'NONE'}...`);

      // Check if there are rankings for this tool
      const toolRankings = await db
        .select()
        .from(rankings)
        .where(eq(rankings.tool_id, tool.id))
        .orderBy(desc(rankings.date));

      console.log(`  Rankings count: ${toolRankings.length}`);
      if (toolRankings.length > 0) {
        const latestRanking = toolRankings[0];
        console.log(`  Latest ranking:`);
        console.log(`    Rank: ${latestRanking.rank}`);
        console.log(`    Total score: ${latestRanking.total_score}`);
        console.log(`    Base score: ${latestRanking.base_score}`);
        console.log(`    Date: ${latestRanking.date}`);
      }
    } else {
      console.log(`\n${name}: NOT FOUND`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));

  // Count tools with scores
  const allTools = await db.select().from(tools);
  const toolsWithScores = allTools.filter(t => t.score !== null && t.score !== undefined);
  const toolsWithoutScores = allTools.filter(t => t.score === null || t.score === undefined);

  console.log(`\nTotal tools in database: ${allTools.length}`);
  console.log(`Tools with scores: ${toolsWithScores.length}`);
  console.log(`Tools WITHOUT scores: ${toolsWithoutScores.length}`);

  if (toolsWithoutScores.length > 0) {
    console.log(`\nTools without scores:`);
    toolsWithoutScores.forEach(t => console.log(`  - ${t.name}`));
  }

  process.exit(0);
}

checkScores().catch(console.error);
