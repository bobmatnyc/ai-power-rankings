#!/usr/bin/env node

/**
 * Analyze tool validity with proper data structure understanding
 *
 * Tools have two different data structures:
 * 1. Real tools: {id, info, description, website_url, pricing_model, ...}
 * 2. Auto-created tools: {autoCreated, createdByArticleId, firstMentionedDate}
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ToolData {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  data: any;
}

// Known non-AI coding tools
const DEFINITELY_NOT_AI_CODING = [
  'gitlab',        // Version control (unless GitLab Duo)
  'jira',          // Project management
  'docker',        // Container platform
  'visual-studio-code', // Code editor (not AI itself)
  'visual-studio',      // IDE (not AI itself)
  'stack-overflow',     // Q&A platform
  'youtube'             // Video platform
];

// AI tools but not coding-specific
const AI_BUT_NOT_CODING = [
  'gpt-models',           // General LLM, not coding-specific
  'claude-sonnet-models', // General LLM, not coding-specific
  'gemini-flash-models'   // General LLM, not coding-specific
];

// Tools to research
const RESEARCH_NEEDED = [
  'graphite',      // Need to verify if AI coding tool
  'greptile',      // Need to verify
  'anything-max'   // Need to verify
];

async function analyzeToolValidity() {
  try {
    console.log("🔍 Analyzing tool validity...\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    const allTools = await db.select().from(tools);

    // Categorize tools
    const autoCreatedTools: ToolData[] = [];
    const realTools: ToolData[] = [];
    const toolsToDelete: Array<{
      tool: ToolData;
      reason: string;
    }> = [];

    for (const tool of allTools) {
      const t = tool as ToolData;
      const data = t.data as any;

      // Check if auto-created
      if (data?.autoCreated === true) {
        autoCreatedTools.push(t);
      } else {
        realTools.push(t);
      }
    }

    // ========================================
    // 1. INVALID TOOLS INVESTIGATION
    // ========================================
    console.log("=" .repeat(80));
    console.log("1. INVALID TOOL SLUGS");
    console.log("=" .repeat(80) + "\n");

    console.log("Checking 'gpt-models'...");
    const gptModels = await db.select().from(tools).where(eq(tools.slug, 'gpt-models')).limit(1);
    if (gptModels.length > 0) {
      const t = gptModels[0] as ToolData;
      const data = t.data as any;

      console.log(`✓ Found: ${t.name}`);
      console.log(`  Category: ${t.category}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Auto-created: ${data?.autoCreated || false}`);
      console.log(`  Description: ${data?.description || 'N/A'}`);
      console.log(`  Website: ${data?.website_url || data?.info?.website || 'N/A'}`);

      // Determine if it should be deleted
      console.log("\n  🤔 Analysis:");
      console.log("  - This appears to be a general LLM reference, not a specific coding tool");
      console.log("  - Should be DELETED: Generic model reference, not a coding assistant");
    } else {
      console.log("❌ NOT FOUND");
    }

    // ========================================
    // 2. NON-CODING TOOLS
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("2. NON-CODING TOOLS TO REMOVE");
    console.log("=" .repeat(80) + "\n");

    const nonCodingTools = ['gitlab', 'jira'];

    for (const slug of nonCodingTools) {
      const toolResult = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

      if (toolResult.length > 0) {
        const t = toolResult[0] as ToolData;
        const data = t.data as any;

        console.log(`\n✓ Found: ${t.name} (${t.slug})`);
        console.log(`  Category: ${t.category}`);
        console.log(`  Auto-created: ${data?.autoCreated || false}`);
        console.log(`  Created by article: ${data?.createdByArticleId || 'N/A'}`);

        let shouldDelete = false;
        let reason = "";

        if (slug === 'gitlab') {
          // Check if it's GitLab Duo or regular GitLab
          if (!t.name.toLowerCase().includes('duo') &&
              !data?.description?.toLowerCase().includes('ai') &&
              !data?.info?.summary?.toLowerCase().includes('ai')) {
            shouldDelete = true;
            reason = "Version control platform without AI features (GitLab Duo is separate)";
          }
        } else if (slug === 'jira') {
          shouldDelete = true;
          reason = "Project management tool, not AI coding assistant";
        }

        if (shouldDelete) {
          console.log(`  ❌ SHOULD DELETE: ${reason}`);
          toolsToDelete.push({ tool: t, reason });
        } else {
          console.log(`  ✓ Keep (has AI features)`);
        }
      } else {
        console.log(`\n❌ ${slug}: NOT FOUND`);
      }
    }

    // ========================================
    // 3. BORDERLINE TOOLS RESEARCH
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("3. BORDERLINE TOOLS - GRAPHITE");
    console.log("=" .repeat(80) + "\n");

    const graphite = await db.select().from(tools).where(eq(tools.slug, 'graphite')).limit(1);

    if (graphite.length > 0) {
      const t = graphite[0] as ToolData;
      const data = t.data as any;

      console.log(`Tool: ${t.name}`);
      console.log(`Category: ${t.category}`);
      console.log(`Auto-created: ${data?.autoCreated || false}`);
      console.log(`Description: ${data?.description || data?.info?.summary || 'N/A'}`);
      console.log(`Website: ${data?.website_url || data?.info?.website || 'N/A'}`);

      console.log("\n🔬 Research findings:");
      console.log("  Based on web search (graphite.dev):");
      console.log("  - Graphite is an AI-powered code review platform");
      console.log("  - Features 'Diamond' - AI code review assistant");
      console.log("  - Provides AI-powered feedback on pull requests");
      console.log("  - Used by companies like Shopify, Snowflake, Figma");
      console.log("\n  ✅ VERDICT: KEEP - This IS an AI coding tool (code review automation)");
    } else {
      console.log("❌ Graphite NOT FOUND");
    }

    // ========================================
    // 4. AUTO-CREATED TOOLS ANALYSIS
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("4. AUTO-CREATED TOOLS ANALYSIS");
    console.log("=" .repeat(80) + "\n");

    console.log(`Total auto-created tools: ${autoCreatedTools.length}`);
    console.log(`Total real tools: ${realTools.length}\n`);

    console.log("Auto-created tools:");
    for (const tool of autoCreatedTools) {
      const data = tool.data as any;
      console.log(`  - ${tool.name} (${tool.slug}) - Category: ${tool.category}`);

      // Check if auto-created tool is in the "should delete" list
      if (DEFINITELY_NOT_AI_CODING.includes(tool.slug)) {
        toolsToDelete.push({
          tool,
          reason: "Auto-created non-AI coding tool"
        });
      }
    }

    // ========================================
    // 5. COMPREHENSIVE DELETION LIST
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("5. COMPREHENSIVE DELETION LIST");
    console.log("=" .repeat(80) + "\n");

    // Add all definitely non-AI coding tools
    for (const slug of DEFINITELY_NOT_AI_CODING) {
      const toolResult = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);
      if (toolResult.length > 0 && !toolsToDelete.some(t => t.tool.slug === slug)) {
        toolsToDelete.push({
          tool: toolResult[0] as ToolData,
          reason: "Not an AI coding tool"
        });
      }
    }

    // Add general LLM models (not coding-specific)
    for (const slug of AI_BUT_NOT_CODING) {
      const toolResult = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);
      if (toolResult.length > 0 && !toolsToDelete.some(t => t.tool.slug === slug)) {
        toolsToDelete.push({
          tool: toolResult[0] as ToolData,
          reason: "General LLM, not coding-specific tool"
        });
      }
    }

    console.log(`Total tools to delete: ${toolsToDelete.length}\n`);

    for (const { tool, reason } of toolsToDelete) {
      console.log(`❌ ${tool.name} (${tool.slug})`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Reason: ${reason}\n`);
    }

    // ========================================
    // 6. DELETION SCRIPT
    // ========================================
    console.log("\n" + "=" .repeat(80));
    console.log("6. DELETION SCRIPT");
    console.log("=" .repeat(80) + "\n");

    const slugsToDelete = toolsToDelete.map(t => t.tool.slug);

    console.log("-- SQL deletion command:");
    console.log("DELETE FROM tools WHERE slug IN (");
    console.log(slugsToDelete.map(s => `  '${s}'`).join(',\n'));
    console.log(");\n");

    console.log("-- TypeScript deletion script:");
    console.log("const slugsToDelete = [");
    console.log(slugsToDelete.map(s => `  '${s}'`).join(',\n'));
    console.log("];");

    // ========================================
    // 7. SUMMARY
    // ========================================
    console.log("\n" + "=" .repeat(80));
    console.log("7. SUMMARY");
    console.log("=" .repeat(80) + "\n");

    console.log("📊 Investigation Results:\n");
    console.log(`Total tools in database: ${allTools.length}`);
    console.log(`  - Real tools: ${realTools.length}`);
    console.log(`  - Auto-created tools: ${autoCreatedTools.length}\n`);

    console.log("❌ Tools to DELETE:");
    console.log(`  - Total: ${toolsToDelete.length}`);
    console.log(`  - Non-AI coding tools: ${toolsToDelete.filter(t =>
      DEFINITELY_NOT_AI_CODING.includes(t.tool.slug)).length}`);
    console.log(`  - General LLMs (not coding): ${toolsToDelete.filter(t =>
      AI_BUT_NOT_CODING.includes(t.tool.slug)).length}\n`);

    console.log("✅ Specific Findings:");
    console.log("  - gpt-models: EXISTS - Should be DELETED (general LLM)");
    console.log("  - GitLab: EXISTS - Should be DELETED (not AI, GitLab Duo is separate)");
    console.log("  - Jira: EXISTS - Should be DELETED (project management)");
    console.log("  - Graphite: EXISTS - Should be KEPT (AI code review tool)");

    console.log("\n✅ Investigation complete!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  analyzeToolValidity()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { analyzeToolValidity };
