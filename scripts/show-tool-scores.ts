/**
 * Show all tools with their scores to verify the fix
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";

async function showToolScores() {
  console.log("=== All Active Tools with Scores ===\n");

  const db = getDb();

  const allTools = await db
    .select({
      name: tools.name,
      baselineScore: tools.baselineScore,
      deltaScore: tools.deltaScore,
      status: tools.status,
    })
    .from(tools)
    .where(eq(tools.status, "active"))
    .orderBy(tools.name);

  console.log(`Total Active Tools: ${allTools.length}\n`);
  console.log(
    "Name".padEnd(60) +
      "Baseline".padEnd(12) +
      "Delta".padEnd(12) +
      "Current"
  );
  console.log("=".repeat(100));

  allTools.forEach((tool) => {
    const baseline = Number(tool.baselineScore) || 0;
    const delta = Number(tool.deltaScore) || 0;
    const current = baseline + delta;

    console.log(
      tool.name.padEnd(60) +
        baseline.toFixed(2).padEnd(12) +
        delta.toFixed(2).padEnd(12) +
        current.toFixed(2)
    );
  });

  console.log("\n=== Score Statistics ===");
  const scores = allTools.map(
    (t) => (Number(t.baselineScore) || 0) + (Number(t.deltaScore) || 0)
  );
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  console.log(`Average Score: ${avgScore.toFixed(2)}`);
  console.log(`Max Score: ${maxScore.toFixed(2)}`);
  console.log(`Min Score: ${minScore.toFixed(2)}`);

  process.exit(0);
}

showToolScores().catch(console.error);
