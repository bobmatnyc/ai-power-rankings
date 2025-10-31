import { getDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";

async function checkJulesEntries() {
  const db = getDb();

  console.log("\n=== CHECKING JULES ENTRIES IN TOOLS TABLE ===\n");

  // Find all tools with "Jules" in the name using raw SQL
  const julesTools = await db.execute(sql`
    SELECT id, slug, name, status, category, created_at
    FROM tools
    WHERE name ILIKE '%jules%'
  `);

  console.log(`Found ${julesTools.rows.length} tools with "Jules" in the name:\n`);
  julesTools.rows.forEach((tool: any) => {
    console.log(`  ID: ${tool.id}`);
    console.log(`  Slug: ${tool.slug}`);
    console.log(`  Name: ${tool.name}`);
    console.log(`  Status: ${tool.status}`);
    console.log(`  Category: ${tool.category}`);
    console.log(`  Created: ${tool.created_at}`);
    console.log();
  });

  console.log("\n=== CHECKING CURRENT RANKINGS FOR JULES ===\n");

  // Get current rankings that contain Jules
  const currentRankings = await db.execute(sql`
    SELECT period, algorithm_version, published_at, data
    FROM rankings
    WHERE is_current = true
  `);

  if (currentRankings.rows.length === 0) {
    console.log("No current rankings found!");
    return;
  }

  const currentRanking: any = currentRankings.rows[0];
  console.log(`Current ranking period: ${currentRanking.period}`);
  console.log(`Algorithm version: ${currentRanking.algorithm_version}`);
  console.log(`Published at: ${currentRanking.published_at}`);
  console.log();

  // Parse the JSONB data
  const rankingsData = currentRanking.data as any;
  let rankingsList = [];

  if (Array.isArray(rankingsData)) {
    rankingsList = rankingsData;
  } else if (rankingsData && typeof rankingsData === "object") {
    if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
      rankingsList = rankingsData.rankings;
    } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
      rankingsList = rankingsData.data;
    }
  }

  console.log(`Total tools in current rankings: ${rankingsList.length}\n`);

  // Filter for Jules entries
  const julesRankings = rankingsList.filter((r: any) =>
    r.tool_name?.toLowerCase().includes("jules")
  );

  console.log(`Jules entries in current rankings: ${julesRankings.length}\n`);
  julesRankings.forEach((r: any) => {
    console.log(`  Tool ID: ${r.tool_id}`);
    console.log(`  Tool Slug: ${r.tool_slug}`);
    console.log(`  Tool Name: ${r.tool_name}`);
    console.log(`  Position/Rank: ${r.rank || r.position}`);
    console.log(`  Score: ${r.score || r.total_score}`);
    console.log(`  Category: ${r.category}`);
    console.log();
  });

  console.log("\n=== CHECKING FOR MISSING LOGOS ===\n");

  // Check tools without logos using raw SQL
  const toolsCheck = await db.execute(sql`
    SELECT
      id,
      slug,
      name,
      category,
      status,
      COALESCE(data->>'logo', data->>'logo_url', '') as logo
    FROM tools
    WHERE status = 'active'
  `);

  const toolsMissingLogos: any[] = [];

  toolsCheck.rows.forEach((tool: any) => {
    if (!tool.logo || tool.logo.trim() === '') {
      toolsMissingLogos.push({
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
      });
    }
  });

  console.log(`Total active tools: ${toolsCheck.rows.length}`);
  console.log(`Tools missing logos: ${toolsMissingLogos.length}\n`);

  if (toolsMissingLogos.length > 0 && toolsMissingLogos.length <= 20) {
    console.log("Tools missing logos:");
    toolsMissingLogos.forEach((t) => {
      console.log(`  - ${t.name} (${t.slug}) [${t.category}]`);
    });
  } else if (toolsMissingLogos.length > 20) {
    console.log("First 20 tools missing logos:");
    toolsMissingLogos.slice(0, 20).forEach((t) => {
      console.log(`  - ${t.name} (${t.slug}) [${t.category}]`);
    });
    console.log(`  ... and ${toolsMissingLogos.length - 20} more`);
  }

  process.exit(0);
}

checkJulesEntries().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
