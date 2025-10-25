/**
 * Check for tools that are in the database but not in current rankings
 */

import { db } from "@/lib/db";
import { tools, rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function findNewTools() {
  const allTools = await db.select({
    id: tools.id,
    slug: tools.slug,
    name: tools.name,
    category: tools.category
  }).from(tools).orderBy(tools.name);

  const currentRankings = await db.select().from(rankings).where(eq(rankings.isCurrent, true)).limit(1);

  if (currentRankings[0]) {
    const data = currentRankings[0].data as any;
    let rankingsArray = Array.isArray(data) ? data : (data.rankings || data.data || []);
    // Rankings use tool_id (UUID), not slug
    const rankedIds = new Set(rankingsArray.map((r: any) => r.tool_id).filter(Boolean));

    console.log('Tools in database:', allTools.length);
    console.log('Tools in rankings:', rankingsArray.length);
    console.log('');
    console.log('Tools NOT in current rankings:');

    const newTools = allTools.filter(t => rankedIds.has(t.id) === false);
    newTools.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name} (${t.slug}) - Category: ${t.category}`);
    });

    if (newTools.length === 0) {
      console.log('(none - all tools are ranked)');
    }
  }

  process.exit(0);
}

findNewTools();
