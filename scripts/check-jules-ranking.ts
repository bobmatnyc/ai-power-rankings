#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();

  console.log("Checking current rankings for Google Jules...\n");

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true));

  console.log(`Found ${currentRankings.length} current ranking record(s)\n`);

  for (const ranking of currentRankings) {
    console.log(`Period: ${ranking.period}`);
    console.log(`Algorithm: ${ranking.algorithmVersion}`);
    console.log(`Created: ${ranking.createdAt}\n`);

    const data = ranking.data as any;
    const rankingsData = Array.isArray(data) ? data : data?.rankings || [];

    const julesRankings = rankingsData.filter((r: any) =>
      (r.tool_name || r.name || '').toLowerCase().includes('jules')
    );

    console.log("Google Jules rankings found:");
    julesRankings.forEach((r: any) => {
      console.log(JSON.stringify(r, null, 2));
    });

    console.log("\n\nTop 10 rankings:");
    rankingsData.slice(0, 10).forEach((r: any) => {
      console.log(`  ${(r.position || r.rank || '?').toString().padStart(3)}. ${(r.tool_name || r.name || 'unknown').padEnd(25)} ${(r.score || r.overall_score || 0).toFixed(3)}`);
    });
  }

  await closeDb();
}

main().catch(console.error);
