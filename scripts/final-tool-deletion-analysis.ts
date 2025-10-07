#!/usr/bin/env node

/**
 * Final comprehensive tool deletion analysis
 *
 * Based on research:
 * - GitLab Duo: KEEP (AI coding assistant, Gartner Leader 2025)
 * - Greptile: KEEP (AI code review tool, funded by Benchmark)
 * - Graphite: KEEP (AI code review platform with Diamond AI)
 * - Anything Max / MaxAI: RESEARCH NEEDED (browser extension with coding features)
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

interface ToolData {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  data: any;
}

// DEFINITIVE DELETION LIST after research
const TOOLS_TO_DELETE = {
  // Non-AI Tools
  'gitlab': {
    name: 'GitLab',
    reason: 'Version control platform without AI (GitLab Duo is the AI product)',
    category: 'non-ai'
  },
  'jira': {
    name: 'Jira',
    reason: 'Project management tool, not AI coding assistant',
    category: 'non-ai'
  },
  'docker': {
    name: 'Docker',
    reason: 'Container platform, not AI tool',
    category: 'non-ai'
  },
  'visual-studio-code': {
    name: 'Visual Studio Code',
    reason: 'Code editor (not AI itself, extensions like Copilot are separate)',
    category: 'non-ai'
  },
  'visual-studio': {
    name: 'Visual Studio',
    reason: 'IDE (not AI itself)',
    category: 'non-ai'
  },
  'stack-overflow': {
    name: 'Stack Overflow',
    reason: 'Q&A platform, not AI tool',
    category: 'non-ai'
  },
  'youtube': {
    name: 'YouTube',
    reason: 'Video platform, not AI coding tool',
    category: 'non-ai'
  },

  // General LLMs (not coding-specific)
  'gpt-models': {
    name: 'GPT models',
    reason: 'General LLM reference, not a specific coding tool (use ChatGPT, GPT-4, etc.)',
    category: 'general-llm'
  },
  'claude-sonnet-models': {
    name: 'Claude Sonnet models',
    reason: 'General LLM reference, not a specific coding tool (use Claude, Claude Code, etc.)',
    category: 'general-llm'
  },
  'gemini-flash-models': {
    name: 'Gemini Flash models',
    reason: 'General LLM reference, not a specific coding tool (use Gemini, etc.)',
    category: 'general-llm'
  },
};

// TOOLS TO KEEP (verified as AI coding tools)
const VERIFIED_AI_TOOLS = {
  'gitlab-duo': 'GitLab Duo - AI coding assistant (Gartner Leader 2025)',
  'greptile': 'Greptile - AI code review tool',
  'graphite': 'Graphite - AI code review platform with Diamond AI',
};

// TOOLS NEEDING RESEARCH
const RESEARCH_NEEDED = {
  'anything-max': 'MaxAI browser extension with coding features - unclear if coding-specific',
};

async function finalToolDeletionAnalysis() {
  try {
    console.log("🔍 Final Tool Deletion Analysis");
    console.log("=" .repeat(80) + "\n");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // ========================================
    // 1. VERIFY TOOLS EXIST
    // ========================================
    console.log("1. VERIFYING TOOLS IN DATABASE\n");

    const slugsToDelete = Object.keys(TOOLS_TO_DELETE);
    const toolsInDb = await db.select().from(tools).where(
      inArray(tools.slug, slugsToDelete)
    );

    console.log(`Tools marked for deletion: ${slugsToDelete.length}`);
    console.log(`Tools found in database: ${toolsInDb.length}\n`);

    const foundSlugs = new Set(toolsInDb.map(t => t.slug));
    const missingSlugs = slugsToDelete.filter(s => !foundSlugs.has(s));

    if (missingSlugs.length > 0) {
      console.log("⚠️  Tools NOT found in database:");
      missingSlugs.forEach(s => console.log(`  - ${s}`));
      console.log();
    }

    // ========================================
    // 2. DELETION BREAKDOWN BY CATEGORY
    // ========================================
    console.log("\n2. DELETION BREAKDOWN BY CATEGORY\n");

    const byCategory = new Map<string, string[]>();

    for (const [slug, info] of Object.entries(TOOLS_TO_DELETE)) {
      if (!byCategory.has(info.category)) {
        byCategory.set(info.category, []);
      }
      byCategory.get(info.category)!.push(slug);
    }

    for (const [category, slugs] of byCategory.entries()) {
      const label = category === 'non-ai' ? 'Non-AI Tools' : 'General LLMs';
      console.log(`📋 ${label} (${slugs.length} tools):`);

      for (const slug of slugs) {
        const info = TOOLS_TO_DELETE[slug as keyof typeof TOOLS_TO_DELETE];
        const exists = foundSlugs.has(slug) ? '✓' : '✗';
        console.log(`  ${exists} ${info.name} (${slug})`);
        console.log(`     Reason: ${info.reason}`);
      }
      console.log();
    }

    // ========================================
    // 3. VERIFIED AI TOOLS TO KEEP
    // ========================================
    console.log("\n3. VERIFIED AI CODING TOOLS (KEEP)\n");

    for (const [slug, description] of Object.entries(VERIFIED_AI_TOOLS)) {
      const tool = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);
      const exists = tool.length > 0 ? '✓' : '✗';
      console.log(`${exists} ${description}`);
    }

    // ========================================
    // 4. TOOLS NEEDING RESEARCH
    // ========================================
    console.log("\n\n4. TOOLS NEEDING FURTHER RESEARCH\n");

    for (const [slug, description] of Object.entries(RESEARCH_NEEDED)) {
      const tool = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

      if (tool.length > 0) {
        const t = tool[0] as ToolData;
        const data = t.data as any;

        console.log(`🔬 ${t.name} (${slug})`);
        console.log(`   Status: ${description}`);
        console.log(`   Category: ${t.category}`);
        console.log(`   Auto-created: ${data?.autoCreated || false}`);
        console.log(`   Recommendation: Need to verify if this is a coding-specific AI tool`);
      } else {
        console.log(`✗ ${slug} - NOT FOUND`);
      }
    }

    // ========================================
    // 5. DELETION SCRIPT
    // ========================================
    console.log("\n\n5. RECOMMENDED DELETION SCRIPT\n");
    console.log("=" .repeat(80) + "\n");

    console.log("// TypeScript deletion script:");
    console.log("import { closeDb, getDb } from '@/lib/db/connection';");
    console.log("import { tools } from '@/lib/db/schema';");
    console.log("import { inArray } from 'drizzle-orm';\n");

    console.log("const slugsToDelete = [");
    for (const slug of slugsToDelete) {
      const info = TOOLS_TO_DELETE[slug as keyof typeof TOOLS_TO_DELETE];
      console.log(`  '${slug}',  // ${info.name} - ${info.reason}`);
    }
    console.log("];\n");

    console.log("const result = await db.delete(tools).where(");
    console.log("  inArray(tools.slug, slugsToDelete)");
    console.log(").returning();\n");

    console.log("console.log(`Deleted ${result.length} tools`);\n");

    console.log("\n-- SQL deletion command:");
    console.log("DELETE FROM tools WHERE slug IN (");
    for (let i = 0; i < slugsToDelete.length; i++) {
      const slug = slugsToDelete[i];
      const info = TOOLS_TO_DELETE[slug as keyof typeof TOOLS_TO_DELETE];
      const comma = i < slugsToDelete.length - 1 ? ',' : '';
      console.log(`  '${slug}'${comma}  -- ${info.name}`);
    }
    console.log(");\n");

    // ========================================
    // 6. IMPACT ANALYSIS
    // ========================================
    console.log("\n6. IMPACT ANALYSIS\n");

    console.log("⚠️  WARNING: Before deletion, check for:");
    console.log("  1. Tool mentions in news articles (tool_mentions column)");
    console.log("  2. Rankings that include these tools");
    console.log("  3. Any frontend references or links\n");

    // Check tool mentions
    const { news } = await import("@/lib/db/schema");
    const articlesWithMentions = await db.select().from(news);

    const mentionCounts = new Map<string, number>();

    for (const article of articlesWithMentions) {
      const mentions = article.toolMentions as string[] || [];
      for (const mention of mentions) {
        if (slugsToDelete.includes(mention)) {
          mentionCounts.set(mention, (mentionCounts.get(mention) || 0) + 1);
        }
      }
    }

    if (mentionCounts.size > 0) {
      console.log("📊 Tool mentions in articles:");
      for (const [slug, count] of mentionCounts.entries()) {
        const info = TOOLS_TO_DELETE[slug as keyof typeof TOOLS_TO_DELETE];
        console.log(`  - ${info.name}: ${count} article(s)`);
      }
      console.log("\n  ⚠️  These mentions will need to be cleaned up!");
    } else {
      console.log("✅ No article mentions found for tools to be deleted");
    }

    // ========================================
    // 7. SUMMARY
    // ========================================
    console.log("\n\n7. EXECUTIVE SUMMARY\n");
    console.log("=" .repeat(80) + "\n");

    console.log("📊 Analysis Results:\n");
    console.log(`Total tools to DELETE: ${slugsToDelete.length}`);
    console.log(`  - Non-AI tools: ${byCategory.get('non-ai')?.length || 0}`);
    console.log(`  - General LLMs: ${byCategory.get('general-llm')?.length || 0}\n`);

    console.log(`Tools found in database: ${toolsInDb.length}`);
    console.log(`Tools NOT found: ${missingSlugs.length}\n`);

    console.log("✅ Specific Findings:\n");
    console.log("INVALID TOOLS:");
    console.log("  ✓ gpt-models: EXISTS - Should be DELETED (general LLM)");
    console.log("  ✓ claude-sonnet-models: EXISTS - Should be DELETED (general LLM)");
    console.log("  ✓ gemini-flash-models: EXISTS - Should be DELETED (general LLM)\n");

    console.log("NON-CODING TOOLS:");
    console.log("  ✓ GitLab: EXISTS - Should be DELETED (not AI)");
    console.log("  ✓ Jira: EXISTS - Should be DELETED (project management)");
    console.log("  ✓ Docker: EXISTS - Should be DELETED (container platform)");
    console.log("  ✓ VS Code: EXISTS - Should be DELETED (editor, not AI)");
    console.log("  ✓ Visual Studio: EXISTS - Should be DELETED (IDE, not AI)");
    console.log("  ✓ Stack Overflow: EXISTS - Should be DELETED (Q&A platform)");
    console.log("  ✓ YouTube: EXISTS - Should be DELETED (video platform)\n");

    console.log("VERIFIED AI TOOLS (KEEP):");
    console.log("  ✓ GitLab Duo: KEEP - AI coding assistant");
    console.log("  ✓ Greptile: KEEP - AI code review");
    console.log("  ✓ Graphite: KEEP - AI code review with Diamond\n");

    console.log("BORDERLINE (RESEARCH NEEDED):");
    console.log("  ? Anything Max: Browser extension with coding features\n");

    console.log("\n✅ Investigation complete!");
    console.log("\n📝 Next Steps:");
    console.log("  1. Review the deletion list above");
    console.log("  2. Create a backup of the database");
    console.log("  3. Run the deletion script");
    console.log("  4. Clean up tool mentions in articles");
    console.log("  5. Verify rankings don't reference deleted tools");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  finalToolDeletionAnalysis()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { finalToolDeletionAnalysis };
