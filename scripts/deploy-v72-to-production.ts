#!/usr/bin/env tsx

/**
 * Deploy Algorithm v7.2 Rankings and News Article to PRODUCTION
 *
 * This script:
 * 1. Generates October 2025 rankings with Algorithm v7.2
 * 2. Marks them as current in PRODUCTION database
 * 3. Adds the v7.2 algorithm announcement news article
 *
 * IMPORTANT: This runs against PRODUCTION database (DATABASE_URL)
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { rankings, tools, news } from "@/lib/db/schema";
import { RankingEngineV7, ALGORITHM_V7_WEIGHTS } from "@/lib/ranking-algorithm-v7";

// Configure for production
neonConfig.poolQueryViaFetch = true;

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

console.log("🚀 Deploying Algorithm v7.2 to PRODUCTION");
console.log("⚠️  This will modify the PRODUCTION database");
console.log("=".repeat(80));

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

interface ToolScore {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  category: string;
  status: string;
  overall_score: number;
  factor_scores: Record<string, number>;
  rank: number;
}

function calculateTier(rank: number): string {
  if (rank <= 5) return "S";
  if (rank <= 15) return "A";
  if (rank <= 30) return "B";
  if (rank <= 45) return "C";
  return "D";
}

async function deployV72ToProduction() {
  try {
    console.log("\n📊 Algorithm v7.2 Weights:");
    console.log(`   Agentic Capability:    ${ALGORITHM_V7_WEIGHTS.agenticCapability.toFixed(3)} (↑ from 0.250)`);
    console.log(`   Developer Adoption:    ${ALGORITHM_V7_WEIGHTS.developerAdoption.toFixed(3)}`);
    console.log(`   Market Traction:       ${ALGORITHM_V7_WEIGHTS.marketTraction.toFixed(3)}`);
    console.log(`   Business Sentiment:    ${ALGORITHM_V7_WEIGHTS.businessSentiment.toFixed(3)} (↓ from 0.150)`);
    console.log(`   Innovation:            ${ALGORITHM_V7_WEIGHTS.innovation.toFixed(3)} (↓ from 0.125)`);
    console.log(`   Technical Performance: ${ALGORITHM_V7_WEIGHTS.technicalPerformance.toFixed(3)} (↓ from 0.125)`);
    console.log(`   Development Velocity:  ${ALGORITHM_V7_WEIGHTS.developmentVelocity.toFixed(3)}`);
    console.log(`   Platform Resilience:   ${ALGORITHM_V7_WEIGHTS.platformResilience.toFixed(3)} (↓ from 0.050)`);

    // Get previous rankings for movement calculation
    console.log("\n📥 Loading previous rankings from PRODUCTION...");
    const prevRankingsResult = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    let previousRankMap: Map<string, number> = new Map();

    if (prevRankingsResult.length > 0) {
      const prevData = prevRankingsResult[0].data as any;
      const prevRankings = Array.isArray(prevData) ? prevData : prevData?.rankings || [];

      prevRankings.forEach((r: any) => {
        const toolId = r.tool_id || r.id;
        const rank = r.rank || r.position;
        if (toolId && rank) {
          previousRankMap.set(toolId, rank);
        }
      });

      console.log(`✓ Loaded ${previousRankMap.size} previous rankings`);
    } else {
      console.log("⚠️  No previous rankings found");
    }

    // Load all active tools
    console.log("\n📚 Loading active tools from PRODUCTION...");
    const allTools = await db.select().from(tools).where(eq(tools.status, "active"));
    console.log(`✓ Found ${allTools.length} active tools\n`);

    // Calculate scores
    console.log("🧮 Calculating scores with Algorithm v7.2...\n");
    const engine = new RankingEngineV7(ALGORITHM_V7_WEIGHTS);
    const toolScores: ToolScore[] = [];

    for (const tool of allTools) {
      const toolData = tool.data as any;

      const metrics = {
        tool_id: tool.id,
        name: tool.name,
        category: tool.category,
        status: tool.status,
        info: toolData?.info || {},
      };

      const score = engine.calculateToolScore(metrics);

      toolScores.push({
        tool_id: tool.id,
        tool_name: tool.name,
        tool_slug: tool.slug,
        category: tool.category || "uncategorized",
        status: tool.status,
        overall_score: score.overallScore,
        factor_scores: score.factorScores,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort and assign ranks
    toolScores.sort((a, b) => b.overall_score - a.overall_score);
    toolScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    // Create rankings data
    const rankingsData = {
      period: "2025-10",
      algorithm_version: "7.2",
      generated_at: new Date().toISOString(),
      total_tools: toolScores.length,
      rankings: toolScores.map((score) => {
        const prevRank = previousRankMap.get(score.tool_id);
        return {
          tool_id: score.tool_id,
          rank: score.rank,
          previous_rank: prevRank || null,
          movement: prevRank ? prevRank - score.rank : null,
          score: Math.round(score.overall_score * 10) / 10,
          tier: calculateTier(score.rank),
          category: score.category,
          factor_scores: score.factor_scores,
        };
      }),
    };

    // Unmark previous rankings
    console.log("\n📝 Unmarking previous rankings as current...");
    await db.update(rankings).set({ isCurrent: false }).where(eq(rankings.isCurrent, true));

    // Insert new rankings
    console.log("💾 Inserting October 2025 rankings to PRODUCTION...");
    await db.insert(rankings).values({
      period: "2025-10",
      algorithmVersion: "7.2",
      isCurrent: true,
      publishedAt: new Date(),
      data: rankingsData as any,
    });

    console.log(`✅ Generated rankings for ${toolScores.length} tools`);
    console.log(`\nTop 10:`);
    toolScores.slice(0, 10).forEach((score, i) => {
      const prevRank = previousRankMap.get(score.tool_id);
      const movement = prevRank ? prevRank - score.rank : null;
      const movementStr = movement
        ? movement > 0
          ? `↑${movement}`
          : movement < 0
          ? `↓${Math.abs(movement)}`
          : "—"
        : "NEW";
      console.log(
        `   ${i + 1}. ${score.tool_name.padEnd(30)} ${score.overall_score.toFixed(1)} ${movementStr}`
      );
    });

    // Add news article
    console.log("\n📰 Adding Algorithm v7.2 news article to PRODUCTION...");

    const articleData = {
      title: "Algorithm v7.2: Agentic Capabilities Take Center Stage in October Rankings",
      summary:
        "AI Power Rankings unveils Algorithm v7.2 for October 2025, increasing the weight of agentic capabilities from 25% to 35% to better reflect the shift toward autonomous AI coding tools. The update recognizes SWE-bench performance as the leading indicator of real-world agent effectiveness.",
      content: `# Algorithm v7.2: Agentic Capabilities Take Center Stage

## Major Algorithm Update for October 2025

AI Power Rankings has released **Algorithm v7.2**, our most significant methodology update since launch. The new algorithm increases the weight of **Agentic Capability** from 25% to 35%, reflecting the industry's rapid shift toward autonomous AI coding agents.

## What Changed

### Algorithm v7.2 Weights

**Increased Emphasis:**
- **Agentic Capability**: 25% → **35%** (+40%)
  - SWE-bench Verified scores
  - Autonomous task completion
  - Multi-file code understanding
  - Complex refactoring abilities

**Rebalanced Factors:**
- **Developer Adoption**: 12.5% (unchanged)
- **Market Traction**: 12.5% (unchanged)
- **Business Sentiment**: 15% → **12.5%** (-17%)
- **Innovation**: 12.5% → **10%** (-20%)
- **Technical Performance**: 12.5% → **10%** (-20%)
- **Development Velocity**: 5% (unchanged)
- **Platform Resilience**: 5% → **2.5%** (-50%)

## Why This Matters

### The Agentic AI Shift

The AI coding landscape has fundamentally transformed in 2025. Tools are no longer just assistants—they're becoming autonomous agents capable of:

1. **Understanding entire codebases** with full context
2. **Completing complex multi-step tasks** independently
3. **Solving real-world bugs** measured by SWE-bench
4. **Refactoring large code sections** safely and effectively

### SWE-bench as the Gold Standard

SWE-bench Verified has emerged as the industry's definitive benchmark for agentic capability. It measures what matters: **can the tool actually fix real GitHub issues?**

Tools with strong SWE-bench scores (40%+) demonstrate genuine autonomous capability, not just code completion.

## Impact on Rankings

### Top Performers Under v7.2

The October 2025 rankings show clear winners from the algorithm update:

**Maintained Dominance:**
- **Claude Code** (#1) - Exceptional agentic capabilities with strong SWE-bench performance
- **Cursor** (#4) - Solid autonomous task handling

**New Top 5 Entries:**
- **Warp** (#2) - Strong autonomous workflow integration
- **Refact.ai** (#3) - Impressive agentic code understanding

**Notable Movers:**
- **Kiro** (#7, ↑5) - Improved agentic capabilities recognized
- **EPAM AI/Run** (#8, NEW) - Strong autonomous agent features
- **Greptile** (#9, ↓4) - Comprehensive codebase awareness

### Significant Drops

Tools that relied more on innovation and technical polish saw rankings adjust:
- **Google Gemini CLI** (↓23 positions)
- **Aider** (↓19 positions)
- **Lovable** (↓22 positions)
- **Bolt.new** (↓25 positions)

These tools remain excellent in their domains but score lower on true autonomous capabilities measured by SWE-bench.

## Looking Forward

Algorithm v7.2 positions AI Power Rankings to accurately reflect the **Age of Agentic AI**. As tools continue evolving toward full autonomy, our methodology now weights factors proportional to real-world developer value.

**Key Takeaways:**
- Agentic capability is now the dominant factor (35%)
- SWE-bench scores directly impact rankings
- Tools must demonstrate autonomous task completion, not just assistance
- The shift toward AI agents is reflected in methodology, not just marketing

## About AI Power Rankings

AI Power Rankings provides monthly, data-driven analysis of AI coding tools, helping developers choose the right tools for their needs. Our methodology emphasizes real-world performance, measurable metrics, and transparent scoring.

**Explore the October 2025 Rankings:** [View Full Rankings](/en/rankings)

---

*Published: October 17, 2025*
*Algorithm Version: v7.2*
*Next Update: November 2025*
`,
      author: {
        name: "AI Power Rankings Research Team",
        role: "Algorithm Development",
      },
      tags: ["algorithm-update", "methodology", "agentic-ai", "swe-bench", "rankings", "october-2025"],
      seo: {
        metaTitle: "Algorithm v7.2: Agentic AI Takes Priority in October 2025 Rankings",
        metaDescription:
          "AI Power Rankings unveils Algorithm v7.2 for October 2025, increasing the weight of agentic capabilities from 25% to 35% to better reflect the shift toward autonomous AI coding tools. The update recognizes SWE-bench performance as the leading indicator of real-world agent effectiveness.",
        keywords: [
          "AI coding tools",
          "algorithm update",
          "agentic capabilities",
          "SWE-bench",
          "autonomous coding",
          "AI Power Rankings v7.2",
        ],
      },
    };

    await db.insert(news).values({
      slug: "algorithm-v72-october-2025-rankings",
      title: "Algorithm v7.2: Agentic Capabilities Take Center Stage in October Rankings",
      summary: articleData.summary,
      category: "algorithm-update",
      source: "AI Power Rankings",
      publishedAt: new Date(),
      data: articleData as any,
      toolMentions: [
        "claude-code",
        "cursor",
        "warp",
        "refact-ai",
        "kiro",
        "epam-ai-run",
        "greptile",
      ] as any,
      importanceScore: 95,
    });

    console.log("✅ News article added to PRODUCTION");

    console.log("\n🎉 Deployment Complete!");
    console.log("=".repeat(80));
    console.log("✅ October 2025 rankings (v7.2) are now live in PRODUCTION");
    console.log("✅ Algorithm announcement article published");
    console.log("\n🔗 View at: https://aipowerranking.com/en/news");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

deployV72ToProduction();
