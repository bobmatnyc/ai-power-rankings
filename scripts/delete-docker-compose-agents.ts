import { db } from '../lib/db';
import { tools, rankings } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function deleteDockerComposeAgents() {
  console.log('Starting deletion of docker-compose-agents...');

  try {
    // Find the tool
    const tool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'docker-compose-agents'))
      .limit(1);

    if (!tool.length) {
      console.log('❌ Tool not found');
      return;
    }

    const toolSlug = tool[0].slug;
    console.log(`Found tool: ${tool[0].name} (slug: ${toolSlug})`);

    // Remove tool from rankings data (JSONB arrays)
    const allRankings = await db.select().from(rankings);
    console.log(`Found ${allRankings.length} ranking periods to check`);

    for (const ranking of allRankings) {
      const data = ranking.data as any[];
      const filteredData = data.filter((item: any) => item.slug !== toolSlug);

      if (filteredData.length !== data.length) {
        await db.update(rankings)
          .set({ data: filteredData as any })
          .where(eq(rankings.id, ranking.id));
        console.log(`✅ Removed from ranking period: ${ranking.period}`);
      }
    }

    // Delete the tool
    await db.delete(tools)
      .where(eq(tools.id, tool[0].id));
    console.log('✅ Deleted tool entry');

    console.log('\n🎉 docker-compose-agents successfully removed from database');
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

deleteDockerComposeAgents();
