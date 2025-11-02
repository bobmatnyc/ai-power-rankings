#!/usr/bin/env tsx

/**
 * Investigate GitHub Copilot's Innovation Score
 *
 * Analyzes why GitHub Copilot has an innovation score of 87.0
 * and compares with top 10 tools.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { RankingEngineV76 } from "@/lib/ranking-algorithm-v76";

async function investigateInnovation() {
  const db = getDb();
  console.log("\n🔍 Investigating GitHub Copilot's Innovation Score\n");
  console.log("=".repeat(80));

  // Get top tools
  const topToolSlugs = [
    'github-copilot',
    'claude-code',
    'cline',
    'jules',
    'cursor',
    'windsurf',
    'goose',
    'replit-agent',
    'aider',
    'v0'
  ];

  console.log("\n📚 Loading tools from database...");
  const allTools = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, topToolSlugs));

  console.log(`✓ Found ${allTools.length} tools\n`);

  const engine = new RankingEngineV76();
  const results: any[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;

    const metrics = {
      tool_id: tool.id,
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      info: {
        ...(toolData.info || {}),
        // Ensure company is a string to avoid algorithm bugs
        company: String(toolData.info?.company || ''),
        company_name: String(toolData.info?.company_name || ''),
      },
    };

    const score = engine.calculateToolScore(metrics);

    // Extract innovation-related data
    const info = metrics.info;
    const featureCount = info?.features?.length || 0;
    const description = `${info?.summary || ""} ${info?.description || ""}`;
    const launchYear = info?.launch_year;
    const performance = info?.technical?.performance;

    // Check for innovative keywords
    const innovativeKeywords = [
      "specification-driven",
      "autonomous",
      "agent",
      "mcp",
      "scaffolding",
      "multi-modal",
      "reasoning",
      "planning",
      "orchestration",
      "background agent",
      "speculative",
    ];

    const matchedKeywords = innovativeKeywords.filter((keyword) =>
      description.toLowerCase().includes(keyword)
    );

    results.push({
      name: tool.name,
      slug: tool.slug,
      innovationScore: score.factorScores.innovation,
      featureCount,
      matchedKeywords: matchedKeywords.length,
      keywordsList: matchedKeywords,
      launchYear,
      hasPerformanceInnovations: !!performance,
      performanceDetails: {
        mixtureOfExperts: performance?.mixture_of_experts || false,
        speculativeDecoding: performance?.speculative_decoding || false,
        indexingSpeed: !!performance?.indexing_speed,
      }
    });
  }

  // Sort by innovation score
  results.sort((a, b) => b.innovationScore - a.innovationScore);

  console.log("\n📊 Innovation Scores Comparison\n");
  console.log("=".repeat(80));
  console.log("Rank | Tool                | Innovation | Features | Keywords | Launch | Performance");
  console.log("-".repeat(80));

  results.forEach((r, idx) => {
    const perf = r.performanceDetails;
    const perfIcons = [
      perf.mixtureOfExperts ? 'MoE' : '',
      perf.speculativeDecoding ? 'SD' : '',
      perf.indexingSpeed ? 'IS' : '',
    ].filter(Boolean).join(',');

    console.log(
      `${(idx + 1).toString().padStart(4)} | ` +
      `${r.name.padEnd(19)} | ` +
      `${r.innovationScore.toFixed(1).padStart(10)} | ` +
      `${r.featureCount.toString().padStart(8)} | ` +
      `${r.matchedKeywords.toString().padStart(8)} | ` +
      `${(r.launchYear || 'N/A').toString().padStart(6)} | ` +
      `${perfIcons.padEnd(15)}`
    );
  });

  // Detailed analysis for GitHub Copilot
  const copilot = results.find(r => r.slug === 'github-copilot');
  if (copilot) {
    console.log("\n\n🔬 Detailed Analysis: GitHub Copilot");
    console.log("=".repeat(80));
    console.log(`Innovation Score: ${copilot.innovationScore.toFixed(1)}`);
    console.log(`Feature Count: ${copilot.featureCount}`);
    console.log(`Matched Keywords: ${copilot.matchedKeywords}`);
    console.log(`Keywords: ${copilot.keywordsList.join(', ') || 'None'}`);
    console.log(`Launch Year: ${copilot.launchYear || 'Unknown'}`);
    console.log(`Performance Innovations:`);
    console.log(`  - Mixture of Experts: ${copilot.performanceDetails.mixtureOfExperts}`);
    console.log(`  - Speculative Decoding: ${copilot.performanceDetails.speculativeDecoding}`);
    console.log(`  - Indexing Speed: ${copilot.performanceDetails.indexingSpeed}`);

    // Calculate score breakdown
    console.log("\n📐 Innovation Score Breakdown:");
    console.log(`  Base Score: 30`);
    const featureBonus = Math.min(55, copilot.featureCount * 3);
    console.log(`  Feature Bonus (${copilot.featureCount} × 3): +${featureBonus}`);
    const keywordBonus = copilot.matchedKeywords * 8;
    console.log(`  Keyword Bonus (${copilot.matchedKeywords} × 8): +${keywordBonus}`);

    let performanceBonus = 0;
    if (copilot.performanceDetails.mixtureOfExperts) performanceBonus += 5;
    if (copilot.performanceDetails.speculativeDecoding) performanceBonus += 5;
    if (copilot.performanceDetails.indexingSpeed) performanceBonus += 3;
    console.log(`  Performance Bonus: +${performanceBonus}`);

    // Maturity bonus calculation
    const currentYear = new Date().getFullYear();
    const age = copilot.launchYear ? currentYear - copilot.launchYear : 0;
    let maturityBonus = 0;
    if (age >= 1 && age <= 3) maturityBonus = 10;
    else if (age >= 4 && age <= 5) maturityBonus = 5;
    else if (age < 1) maturityBonus = 3;
    console.log(`  Maturity Bonus (${age} years): +${maturityBonus}`);

    const calculatedTotal = Math.min(100, 30 + featureBonus + keywordBonus + performanceBonus + maturityBonus);
    console.log(`  Calculated Total (capped at 100): ${calculatedTotal.toFixed(1)}`);
    console.log(`  Actual Score: ${copilot.innovationScore.toFixed(1)}`);

    if (Math.abs(calculatedTotal - copilot.innovationScore) > 1) {
      console.log(`  ⚠️  Mismatch detected!`);
    }
  }

  // Show innovation scoring formula from code
  console.log("\n\n📖 Innovation Scoring Formula (from algorithm):");
  console.log("=".repeat(80));
  console.log(`
  Base Score: 30

  Feature Count Bonus:
    - If features > 0: min(85, 30 + featureCount × 3)
    - Max contribution: 55 points

  Keyword Matching (× 8 points each):
    - specification-driven
    - autonomous
    - agent
    - mcp
    - scaffolding
    - multi-modal
    - reasoning
    - planning
    - orchestration
    - background agent
    - speculative

  Performance Innovations:
    - mixture_of_experts: +5
    - speculative_decoding: +5
    - indexing_speed: +3

  Launch Year Maturity:
    - 1-3 years: +10 (sweet spot)
    - 4-5 years: +5
    - < 1 year: +3
    - > 5 years: 0

  Final Score: min(100, total)
  `);

  console.log("\n✅ Investigation Complete\n");
  await closeDb();
}

investigateInnovation().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
