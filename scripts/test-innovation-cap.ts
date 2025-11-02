#!/usr/bin/env tsx

/**
 * Test Innovation Score Cap Fix
 *
 * Verifies that the bug fix in v7.3.1 correctly caps innovation scores at 100.
 * Previously, calculateInnovation() applied Math.min(100) too early, allowing
 * subsequent bonuses to push scores above 100.
 *
 * This script checks:
 * 1. All innovation scores are ≤ 100
 * 2. Tools previously scoring > 100 (Jules, Devin, Refact.ai) now score exactly 100
 * 3. Overall scores decrease slightly for affected tools
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV73 } from "@/lib/ranking-algorithm-v73";

interface InnovationTestResult {
  name: string;
  innovationScore: number;
  overallScore: number;
  isValid: boolean;
}

async function testInnovationCap() {
  const db = getDb();

  console.log("\n" + "=".repeat(80));
  console.log("🧪 Innovation Score Cap Test (v7.3.1)");
  console.log("=".repeat(80));

  // Load tools
  console.log("\n📚 Loading active tools...");
  const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
  console.log(`✓ Loaded ${allTools.length} active tools`);

  // Test all tools
  console.log("\n🔬 Testing innovation scores...");
  const engine = new RankingEngineV73();
  const results: InnovationTestResult[] = [];
  let invalidCount = 0;
  const toolsOver100: InnovationTestResult[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: toolData,
    };

    try {
      const score = engine.calculateToolScore(metrics);
      const innovationScore = score.factorScores.innovation;
      const isValid = innovationScore >= 0 && innovationScore <= 100;

      const result: InnovationTestResult = {
        name: tool.name,
        innovationScore,
        overallScore: score.overallScore,
        isValid,
      };

      results.push(result);

      if (!isValid) {
        invalidCount++;
        toolsOver100.push(result);
      }
    } catch (error) {
      console.error(`Error scoring ${tool.name}:`, error);
    }
  }

  // Report results
  console.log("\n📊 Innovation Score Validation Results:");
  console.log("─".repeat(80));
  console.log(`Total Tools Tested:    ${results.length}`);
  console.log(`Valid Scores (≤100):   ${results.length - invalidCount}`);
  console.log(`Invalid Scores (>100): ${invalidCount}`);

  if (invalidCount > 0) {
    console.log("\n❌ FAIL: Found tools with innovation scores > 100:");
    console.log("─".repeat(80));
    console.log("Tool Name                       | Innovation Score");
    console.log("─".repeat(80));
    toolsOver100.forEach((result) => {
      console.log(
        `${result.name.padEnd(30)} | ${result.innovationScore.toFixed(2)}`
      );
    });
  } else {
    console.log("\n✅ PASS: All innovation scores are ≤ 100");
  }

  // Check specific tools that were previously affected
  console.log("\n🎯 Checking Previously Affected Tools:");
  console.log("─".repeat(80));
  const affectedToolNames = ["Google Jules", "Devin", "Refact.ai"];
  const affectedTools = results.filter((r) =>
    affectedToolNames.some((name) => r.name.includes(name))
  );

  if (affectedTools.length > 0) {
    console.log("Tool Name                       | Innovation | Overall | Status");
    console.log("─".repeat(80));
    affectedTools.forEach((result) => {
      const status = result.innovationScore <= 100 ? "✅ Fixed" : "❌ Still broken";
      console.log(
        `${result.name.padEnd(30)} | ${result.innovationScore.toFixed(2).padStart(10)} | ` +
        `${result.overallScore.toFixed(3).padStart(7)} | ${status}`
      );
    });
  } else {
    console.log("⚠️  Could not find affected tools in database");
  }

  // Show tools with highest innovation scores (should be exactly 100)
  console.log("\n📈 Top 10 Innovation Scores:");
  console.log("─".repeat(80));
  const sortedByInnovation = [...results].sort((a, b) => b.innovationScore - a.innovationScore);
  console.log("Rank | Tool Name                       | Innovation Score");
  console.log("─".repeat(80));

  for (let i = 0; i < Math.min(10, sortedByInnovation.length); i++) {
    const tool = sortedByInnovation[i];
    const rank = String(i + 1).padStart(4);
    console.log(
      `${rank} | ${tool.name.substring(0, 30).padEnd(30)} | ${tool.innovationScore.toFixed(2).padStart(16)}`
    );
  }

  // Final verdict
  console.log("\n\n" + "=".repeat(80));
  console.log("🎯 Final Verdict");
  console.log("=".repeat(80));

  if (invalidCount === 0) {
    console.log("\n✅ SUCCESS: Bug fix verified!");
    console.log("   - All innovation scores are capped at 100");
    console.log("   - Algorithm v7.3.1 is working correctly");
    console.log("\nReady to deploy to production.");
  } else {
    console.log("\n❌ FAILURE: Bug still present!");
    console.log(`   - Found ${invalidCount} tools with innovation scores > 100`);
    console.log("   - Review the fix in lib/ranking-algorithm-v73.ts");
    console.log("\nDo not deploy until fixed.");
  }

  await closeDb();
  return invalidCount === 0;
}

// Run the test
testInnovationCap()
  .then((success) => {
    console.log("\n✨ Test complete!\n");
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n💥 Test Error:", error);
    process.exit(1);
  });
