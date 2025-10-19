#!/usr/bin/env tsx

/**
 * Update Algorithm v7.2 Content to Trigger Announcement Classification
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

console.log("📢 Updating Article Content for Announcement Classification");
console.log("=".repeat(80));

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function updateContent() {
  try {
    console.log("\n🔍 Finding article...");
    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, "algorithm-v72-october-2025-rankings"));

    if (existing.length === 0) {
      console.log("❌ Article not found!");
      return;
    }

    console.log("✓ Found article\n");

    const title = "AI Power Rankings Announces Algorithm v7.2 Update";

    const summary = `AI Power Rankings announces the release of Algorithm v7.2 for October 2025, increasing agentic capability weighting from 25% to 35% to better reflect the shift toward autonomous AI coding agents. SWE-bench performance now plays a larger role in rankings.`;

    const content = `AI Power Rankings announces the release of Algorithm v7.2, a significant update to our ranking methodology for October 2025.

## Announcement: Algorithm v7.2

We are pleased to announce that our ranking system has been updated to better reflect the evolving landscape of AI coding tools, with a major emphasis on agentic capabilities.

## Key Changes

The updated algorithm reflects the industry's shift toward autonomous AI coding agents:

**Agentic Capability**: 25% → 35% (+40%)
- SWE-bench Verified scores now weighted more heavily
- Autonomous task completion emphasized
- Multi-file code understanding and complex refactoring abilities

**Rebalanced Factors**:
- Developer Adoption: 12.5% (unchanged)
- Market Traction: 12.5% (unchanged)
- Business Sentiment: 15% → 12.5% (-17%)
- Innovation: 12.5% → 10% (-20%)
- Technical Performance: 12.5% → 10% (-20%)
- Development Velocity: 5% (unchanged)
- Platform Resilience: 5% → 2.5% (-50%)

## Ranking Impact

The October 2025 rankings show clear winners from the algorithm update. Claude Code maintains #1 position with exceptional agentic capabilities. New top 5 entries include Warp (#2) and Refact.ai (#3), both demonstrating strong autonomous workflow capabilities.

Notable movers include Kiro (↑5 positions) and EPAM AI/Run (new entry), while tools focused primarily on innovation saw rankings adjust to reflect lower emphasis on that factor.

The methodology change recognizes that AI coding tools are evolving from assistants to autonomous agents, with SWE-bench performance emerging as the gold standard for measuring true agentic capability.`;

    console.log("💾 Updating article content...");
    await db
      .update(articles)
      .set({
        title: title,
        summary: summary,
        content: content,
        tags: ["announcement", "site update", "methodology", "AI Power Rankings"],
        updatedAt: new Date(),
      })
      .where(eq(articles.slug, "algorithm-v72-october-2025-rankings"));

    console.log("✅ Article updated successfully!");
    console.log("\n📊 Updated Properties:");
    console.log(`   Title: ${title}`);
    console.log(`   Content: Includes "announces" and "announcement" keywords`);
    console.log(`   Tags: announcement, site update, methodology`);

    console.log("\n🎉 Complete!");
    console.log("=".repeat(80));
    console.log("✅ Article should now classify as Announcement type");
    console.log("🔗 View: https://aipowerranking.com/en/news");
  } catch (error) {
    console.error("\n❌ Failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateContent();
