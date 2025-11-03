#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyInnovationScores() {
  const db = getDb();

  console.log('🔍 Checking innovation scores for 2025-11 rankings...\n');

  const results = await db
    .select()
    .from(rankings)
    .where(eq(rankings.period, '2025-11'));

  if (results.length === 0) {
    console.log('❌ No rankings found for 2025-11');
    closeDb();
    return;
  }

  const rankingData = results[0];
  const toolsData = (rankingData.data as any) || [];

  console.log('📊 Innovation Score Analysis:\n');

  let maxInnovation = 0;
  const toolsWithHighInnovation: Array<{name: string, score: number}> = [];

  for (const tool of toolsData) {
    const factorScores = tool.factor_scores || {};
    const innovationScore = factorScores.innovation || 0;

    if (innovationScore > maxInnovation) {
      maxInnovation = innovationScore;
    }

    if (innovationScore >= 95) {
      toolsWithHighInnovation.push({
        name: tool.tool_name,
        score: innovationScore
      });
    }
  }

  console.log(`✅ Maximum innovation score: ${maxInnovation.toFixed(1)}`);
  console.log(`${maxInnovation <= 100 ? '✅' : '❌'} Innovation scores properly capped at 100\n`);

  if (toolsWithHighInnovation.length > 0) {
    console.log('🔥 Tools with innovation score ≥ 95:');
    for (const tool of toolsWithHighInnovation) {
      console.log(`   ${tool.name}: ${tool.score.toFixed(1)}`);
    }
  }

  console.log('\n🏆 Top 10 with scores:');
  const top10 = toolsData.slice(0, 10);
  for (const tool of top10) {
    console.log(`   #${tool.rank} ${tool.tool_name}: ${tool.score.toFixed(3)}`);
  }

  closeDb();
}

verifyInnovationScores().catch(console.error);
