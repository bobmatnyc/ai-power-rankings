import { getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  if (!db) {
    console.log("No database connection");
    process.exit(1);
  }

  // Get latest ranking using raw SQL
  const latest = await db.execute(
    sql`SELECT * FROM ${rankings} ORDER BY period DESC LIMIT 1`
  );

  const rows = latest.rows || latest;
  if (rows.length === 0) {
    console.log("No rankings found");
    process.exit(0);
  }

  const latestRanking = rows[0];
  console.log("Latest ranking:", {
    id: latestRanking.id,
    period: latestRanking.period,
    isCurrent: latestRanking.is_current,
    dataType: typeof latestRanking.data,
  });

  // Check if data has rankings array
  const dataObj = latestRanking.data as any;
  if (dataObj && Array.isArray(dataObj.rankings)) {
    console.log(`\nRankings array length: ${dataObj.rankings.length}`);
    console.log("\nFirst 10 tools:");
    dataObj.rankings.slice(0, 10).forEach((r: any, i: number) => {
      console.log(`${i + 1}. ${r.tool_slug} (ID: ${r.tool_id})`);
    });

    // Search for Claude Code and ChatGPT
    const claudeCode = dataObj.rankings.find((r: any) =>
      r.tool_slug === 'claude-code' || r.tool_slug?.includes('claude')
    );
    const chatgpt = dataObj.rankings.find((r: any) =>
      r.tool_slug?.includes('chatgpt')
    );

    console.log("\nClaude Code in rankings:", claudeCode ? `Yes (${claudeCode.tool_slug})` : "No");
    console.log("ChatGPT in rankings:", chatgpt ? `Yes (${chatgpt.tool_slug})` : "No");
  } else {
    console.log("\nData structure:", JSON.stringify(dataObj, null, 2).substring(0, 500));
  }
}

main();
