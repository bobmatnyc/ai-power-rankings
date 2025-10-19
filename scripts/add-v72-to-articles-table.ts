#!/usr/bin/env tsx

/**
 * Add Algorithm v7.2 Article to ARTICLES table (Production)
 *
 * The API reads from the 'articles' table, not 'news' table.
 * This script adds the v7.2 announcement to the correct table.
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { articles } from "@/lib/db/article-schema";
import { eq } from "drizzle-orm";

neonConfig.poolQueryViaFetch = true;

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

console.log("📰 Adding Algorithm v7.2 Article to ARTICLES table (Production)");
console.log("=".repeat(80));

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function addArticle() {
  try {
    // Check if exists
    console.log("\n🔍 Checking if article already exists in articles table...");
    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, "algorithm-v72-october-2025-rankings"));

    if (existing.length > 0) {
      console.log("⚠️  Article already exists in articles table!");
      console.log(`   Slug: ${existing[0].slug}`);
      console.log(`   Title: ${existing[0].title}`);
      console.log(`   Published: ${existing[0].publishedDate}`);
      console.log("\n✅ No action needed");
      return;
    }

    console.log("✓ Article does not exist, inserting...\n");

    const content = `# Algorithm v7.2: Agentic Capabilities Take Center Stage

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
`;

    const summary =
      "AI Power Rankings unveils Algorithm v7.2 for October 2025, increasing the weight of agentic capabilities from 25% to 35% to better reflect the shift toward autonomous AI coding tools. The update recognizes SWE-bench performance as the leading indicator of real-world agent effectiveness.";

    console.log("💾 Inserting article into articles table...");
    await db.insert(articles).values({
      slug: "algorithm-v72-october-2025-rankings",
      title: "Algorithm v7.2: Agentic Capabilities Take Center Stage in October Rankings",
      summary: summary,
      content: content,
      ingestionType: "text",
      sourceName: "AI Power Rankings",
      sourceUrl: null,
      category: "algorithm-update",
      tags: ["algorithm-update", "methodology", "agentic-ai", "swe-bench", "rankings", "october-2025"],
      importanceScore: 95,
      toolMentions: [
        "claude-code",
        "cursor",
        "warp",
        "refact-ai",
        "kiro",
        "epam-ai-run",
        "greptile",
      ] as any,
      author: "AI Power Rankings Research Team",
      publishedDate: new Date("2025-10-17"),
      status: "active",
      isProcessed: true,
      processedAt: new Date(),
    });

    console.log("✅ Article successfully added to articles table!");
    console.log("\n📊 Article Details:");
    console.log(`   Slug: algorithm-v72-october-2025-rankings`);
    console.log(`   Category: algorithm-update`);
    console.log(`   Importance Score: 95/100`);
    console.log(`   Status: active`);
    console.log(`   Tool Mentions: 7 tools`);

    console.log("\n🎉 Success!");
    console.log("=".repeat(80));
    console.log("✅ Article will now appear in news feed");
    console.log("🔗 News page: https://aipowerranking.com/en/news");
    console.log("📋 Article page: https://aipowerranking.com/en/news/algorithm-v72-october-2025-rankings");
  } catch (error) {
    console.error("\n❌ Failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

addArticle();
