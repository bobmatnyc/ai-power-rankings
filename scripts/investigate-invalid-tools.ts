#!/usr/bin/env node

/**
 * Comprehensive investigation of invalid and miscategorized tools
 *
 * Checks:
 * 1. Invalid tool slugs (gpt-models)
 * 2. Non-coding tools (GitLab, Jira)
 * 3. Borderline tools (Graphite)
 * 4. Tools with suspicious categories
 * 5. Non-AI tools
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, inArray, or, sql } from "drizzle-orm";

interface ToolData {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  data: any;
}

// Non-coding tool categories to flag
const SUSPICIOUS_CATEGORIES = [
  'other',
  'collaboration',
  'project-management',
  'productivity',
  'communication',
  'design',
  'analytics'
];

// Known non-AI or non-coding tools to investigate
const TOOLS_TO_INVESTIGATE = [
  'gpt-models',
  'gitlab',
  'jira',
  'graphite'
];

async function investigateTools() {
  try {
    console.log("🔍 Starting comprehensive tool investigation...\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // ========================================
    // 1. Check specific tools mentioned
    // ========================================
    console.log("=" .repeat(80));
    console.log("1. INVESTIGATING SPECIFIC TOOLS");
    console.log("=" .repeat(80) + "\n");

    for (const slug of TOOLS_TO_INVESTIGATE) {
      const tool = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

      if (tool.length === 0) {
        console.log(`❌ "${slug}" - NOT FOUND IN DATABASE`);
      } else {
        const t = tool[0] as ToolData;
        const toolData = t.data as any;

        console.log(`\n📊 Tool: ${t.name} (${t.slug})`);
        console.log(`   Category: ${t.category}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Description: ${toolData?.description?.substring(0, 200) || 'N/A'}...`);
        console.log(`   Website: ${toolData?.website || 'N/A'}`);
        console.log(`   Tags: ${JSON.stringify(toolData?.tags || [])}`);
        console.log(`   Features: ${JSON.stringify(toolData?.features?.slice(0, 3) || [])}`);
      }
    }

    // ========================================
    // 2. List all tools by category
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("2. TOOLS BY CATEGORY");
    console.log("=" .repeat(80) + "\n");

    const allTools = await db.select().from(tools);
    const toolsByCategory = new Map<string, ToolData[]>();

    for (const tool of allTools) {
      const category = tool.category || 'uncategorized';
      if (!toolsByCategory.has(category)) {
        toolsByCategory.set(category, []);
      }
      toolsByCategory.get(category)!.push(tool as ToolData);
    }

    // Sort categories by count
    const sortedCategories = Array.from(toolsByCategory.entries())
      .sort((a, b) => b[1].length - a[1].length);

    for (const [category, categoryTools] of sortedCategories) {
      const isSuspicious = SUSPICIOUS_CATEGORIES.includes(category.toLowerCase());
      const marker = isSuspicious ? "⚠️" : "✓";
      console.log(`${marker} ${category}: ${categoryTools.length} tools`);

      if (isSuspicious) {
        console.log(`   Tools: ${categoryTools.map(t => t.name).join(', ')}`);
      }
    }

    // ========================================
    // 3. Identify non-AI coding tools
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("3. POTENTIAL NON-AI CODING TOOLS");
    console.log("=" .repeat(80) + "\n");

    const potentialNonAITools: Array<{
      tool: ToolData;
      reason: string[];
    }> = [];

    for (const tool of allTools) {
      const t = tool as ToolData;
      const toolData = t.data as any;
      const reasons: string[] = [];

      // Check category
      if (SUSPICIOUS_CATEGORIES.includes(t.category.toLowerCase())) {
        reasons.push(`Suspicious category: ${t.category}`);
      }

      // Check for non-AI keywords in description
      const description = (toolData?.description || '').toLowerCase();
      const name = t.name.toLowerCase();

      // Non-AI tool patterns
      if (!description.includes('ai') &&
          !description.includes('artificial intelligence') &&
          !description.includes('machine learning') &&
          !description.includes('ml') &&
          !description.includes('gpt') &&
          !description.includes('llm') &&
          !description.includes('neural') &&
          !toolData?.tags?.some((tag: string) =>
            tag.toLowerCase().includes('ai') ||
            tag.toLowerCase().includes('ml')
          )) {
        reasons.push('No AI-related keywords in description or tags');
      }

      // Project management tools
      if (name.includes('jira') ||
          name.includes('asana') ||
          name.includes('trello') ||
          description.includes('project management') ||
          description.includes('issue tracking')) {
        reasons.push('Project management tool');
      }

      // Version control (non-AI)
      if ((name.includes('gitlab') && !name.includes('duo')) ||
          (name.includes('github') && !name.includes('copilot')) ||
          (name.includes('bitbucket') && !description.includes('ai'))) {
        reasons.push('Version control without AI features');
      }

      if (reasons.length > 0) {
        potentialNonAITools.push({ tool: t, reason: reasons });
      }
    }

    console.log(`Found ${potentialNonAITools.length} potential non-AI tools:\n`);

    for (const { tool, reason } of potentialNonAITools) {
      console.log(`\n🚨 ${tool.name} (${tool.slug})`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Reasons:`);
      reason.forEach(r => console.log(`   - ${r}`));
    }

    // ========================================
    // 4. Generate deletion recommendations
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("4. DELETION RECOMMENDATIONS");
    console.log("=" .repeat(80) + "\n");

    const toolsToDelete: Array<{
      slug: string;
      name: string;
      reason: string;
    }> = [];

    // Add tools based on investigation
    for (const { tool, reason } of potentialNonAITools) {
      toolsToDelete.push({
        slug: tool.slug,
        name: tool.name,
        reason: reason.join('; ')
      });
    }

    console.log(`Total tools to consider for deletion: ${toolsToDelete.length}\n`);

    // Group by reason
    const byReason = new Map<string, typeof toolsToDelete>();
    for (const tool of toolsToDelete) {
      if (!byReason.has(tool.reason)) {
        byReason.set(tool.reason, []);
      }
      byReason.get(tool.reason)!.push(tool);
    }

    for (const [reason, tools] of byReason.entries()) {
      console.log(`\n📋 Reason: ${reason}`);
      console.log(`   Count: ${tools.length}`);
      console.log(`   Tools: ${tools.map(t => t.name).join(', ')}`);
    }

    // ========================================
    // 5. SQL deletion script
    // ========================================
    console.log("\n\n" + "=" .repeat(80));
    console.log("5. SQL DELETION COMMANDS");
    console.log("=" .repeat(80) + "\n");

    console.log("-- Delete specific tools by slug");
    console.log("DELETE FROM tools WHERE slug IN (");
    const slugsToDelete = toolsToDelete.map(t => `  '${t.slug}'`);
    console.log(slugsToDelete.join(',\n'));
    console.log(");\n");

    console.log("-- Or delete by category");
    console.log("DELETE FROM tools WHERE category IN (");
    const categoriesToDelete = Array.from(new Set(
      potentialNonAITools
        .filter(({ reason }) => reason.some(r => r.includes('category')))
        .map(({ tool }) => tool.category)
    ));
    console.log(categoriesToDelete.map(c => `  '${c}'`).join(',\n'));
    console.log(");\n");

    // ========================================
    // 6. Summary statistics
    // ========================================
    console.log("\n" + "=" .repeat(80));
    console.log("6. SUMMARY");
    console.log("=" .repeat(80) + "\n");

    console.log(`Total tools in database: ${allTools.length}`);
    console.log(`Categories: ${toolsByCategory.size}`);
    console.log(`Suspicious categories: ${sortedCategories.filter(([cat]) =>
      SUSPICIOUS_CATEGORIES.includes(cat.toLowerCase())
    ).length}`);
    console.log(`Tools flagged for review: ${potentialNonAITools.length}`);
    console.log(`Recommended deletions: ${toolsToDelete.length}`);

    console.log("\n✅ Investigation complete!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  investigateTools()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { investigateTools };
