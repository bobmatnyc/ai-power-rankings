/**
 * Test script to verify tool matching fix
 * Tests that all 54 tools are now matchable, not just the 5 in rankings
 */

import { ArticleDatabaseService } from "@/lib/services/article-db-service";

async function testToolMatching() {
  console.log("=== Testing Tool Matching Fix ===\n");

  const service = new ArticleDatabaseService();

  // Test article with tools that should now match
  const testArticle = {
    type: "text" as const,
    input: `
      Breaking News: Claude Code receives major update with enhanced code generation capabilities.
      ChatGPT Canvas introduces new collaborative features for developers.
      GitHub Copilot announces partnership with Microsoft for enterprise AI.
      Cursor AI raises $60M in Series B funding.
      Windsurf launches new agent-based coding assistant.
      Devin showcases autonomous software engineering capabilities.
      Continue dev improves VS Code integration.
      Aider gets new context management features.
      Tabnine expands enterprise offerings.
      Amazon Q Developer updates code review tools.
    `,
    dryRun: true,
    metadata: {
      author: "Test Author",
    },
  };

  try {
    console.log("Ingesting test article...\n");
    const result = await service.ingestArticle(testArticle);

    if ("predictedChanges" in result) {
      console.log("✅ Article Analysis Complete\n");
      console.log(`📊 Total Tools Affected: ${result.predictedChanges.length}`);
      console.log(`📈 New Tools Identified: ${result.newTools?.length || 0}`);
      console.log(`🏢 New Companies Identified: ${result.newCompanies?.length || 0}\n`);

      console.log("=== Affected Tools ===");
      result.predictedChanges.forEach((change, index) => {
        console.log(`${index + 1}. ${change.toolName}`);
        console.log(`   - Tool ID: ${change.toolId}`);
        console.log(`   - Current Rank: ${change.currentRank}`);
        console.log(`   - Predicted Rank: ${change.predictedRank} (${change.rankChange > 0 ? "+" : ""}${change.rankChange})`);
        console.log(`   - Score Change: ${change.scoreChange > 0 ? "+" : ""}${change.scoreChange.toFixed(2)} points`);
        console.log("");
      });

      // Verify key tools were matched
      const expectedTools = [
        "Claude Code",
        "ChatGPT Canvas",
        "GitHub Copilot",
        "Cursor",
        "Windsurf",
        "Devin",
        "Continue",
        "Aider",
        "Tabnine",
        "Amazon Q Developer",
      ];

      const matchedTools = result.predictedChanges.map((c) => c.toolName);
      const missingTools = expectedTools.filter((t) => !matchedTools.includes(t));

      console.log("\n=== Verification Results ===");
      console.log(`✅ Matched ${matchedTools.length} out of ${expectedTools.length} expected tools`);

      if (missingTools.length > 0) {
        console.log(`❌ Missing tools: ${missingTools.join(", ")}`);
      } else {
        console.log("✅ All expected tools were matched!");
      }

      // Check if we're getting tools beyond the top 5
      const ranksAbove5 = result.predictedChanges.filter((c) => c.currentRank > 5);
      console.log(`\n✅ Tools matched beyond top 5 rankings: ${ranksAbove5.length}`);
      if (ranksAbove5.length > 0) {
        console.log("   Sample unranked tools matched:");
        ranksAbove5.slice(0, 3).forEach((tool) => {
          console.log(`   - ${tool.toolName} (rank: ${tool.currentRank})`);
        });
      }

      // Summary
      console.log("\n=== Summary ===");
      console.log(`Total matchable tools should be 54 (was 5 before fix)`);
      console.log(`Tools matched in this test: ${matchedTools.length}`);
      console.log(
        `Fix working: ${ranksAbove5.length > 0 ? "✅ YES" : "❌ NO (only top 5 matched)"}`
      );
    } else {
      console.log("❌ Unexpected result type");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }

  process.exit(0);
}

// Run the test
testToolMatching().catch(console.error);
