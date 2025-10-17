#!/usr/bin/env tsx

/**
 * Add News Article: Algorithm v7.2 Update
 *
 * Creates a news article announcing the October 2025 rankings with
 * Algorithm v7.2's increased emphasis on agentic capabilities.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { news } from "@/lib/db/schema";

async function addV72AlgorithmNews() {
  const db = getDb();

  console.log("\n📰 Creating News Article: Algorithm v7.2 Update\n");
  console.log("=".repeat(80));

  const slug = "algorithm-v72-october-2025-rankings";
  const title = "Algorithm v7.2: Agentic Capabilities Take Center Stage in October Rankings";

  const summary = "AI Power Rankings unveils Algorithm v7.2 for October 2025, increasing the weight of agentic capabilities from 25% to 35% to better reflect the shift toward autonomous AI coding tools. The update recognizes SWE-bench performance as the leading indicator of real-world agent effectiveness.";

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

  const articleData = {
    title,
    summary,
    content,
    author: {
      name: "AI Power Rankings Research Team",
      role: "Algorithm Development"
    },
    tags: [
      "algorithm-update",
      "methodology",
      "agentic-ai",
      "swe-bench",
      "rankings",
      "october-2025"
    ],
    seo: {
      metaTitle: "Algorithm v7.2: Agentic AI Takes Priority in October 2025 Rankings",
      metaDescription: summary,
      keywords: [
        "AI coding tools",
        "algorithm update",
        "agentic capabilities",
        "SWE-bench",
        "autonomous coding",
        "AI Power Rankings v7.2"
      ]
    }
  };

  try {
    await db.insert(news).values({
      slug,
      title,
      summary,
      category: "algorithm-update",
      source: "AI Power Rankings",
      sourceUrl: "https://aipowerranking.com",
      publishedAt: new Date(),
      date: new Date(),
      data: articleData as any,
      toolMentions: [
        "claude-code",
        "cursor",
        "warp",
        "refact-ai",
        "kiro",
        "epam-ai-run",
        "greptile"
      ] as any,
      importanceScore: 95, // High importance - major algorithm update
    });

    console.log("\n✅ News article created successfully!\n");
    console.log("📊 Article Details:");
    console.log(`   Title:      ${title}`);
    console.log(`   Slug:       ${slug}`);
    console.log(`   Category:   algorithm-update`);
    console.log(`   Importance: 95/100`);
    console.log(`   Published:  ${new Date().toISOString()}`);
    console.log(`   URL:        /en/news/${slug}`);

    console.log("\n🔗 Tool Mentions:");
    console.log("   - Claude Code");
    console.log("   - Cursor");
    console.log("   - Warp");
    console.log("   - Refact.ai");
    console.log("   - Kiro");
    console.log("   - EPAM AI/Run");
    console.log("   - Greptile");

    console.log("\n" + "=".repeat(80));
    console.log("✨ Algorithm v7.2 announcement is now live!");
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("\n❌ Error creating news article:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run the script
addV72AlgorithmNews()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal Error:", error);
    process.exit(1);
  });
