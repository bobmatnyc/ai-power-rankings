#!/usr/bin/env tsx

/**
 * Fix npm Package Mappings
 * Removes incorrect npm data and updates with correct packages
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { eq } from "drizzle-orm";

interface Correction {
  slug: string;
  toolName: string;
  action: "remove" | "update" | "verify";
  currentPackage: string;
  correctPackage?: string;
  reason: string;
  downloads: number;
}

const corrections: Correction[] = [
  // CRITICAL FIXES - Generic SDKs masquerading as tool-specific packages
  {
    slug: "chatgpt-canvas",
    toolName: "ChatGPT Canvas",
    action: "remove",
    currentPackage: "canvas",
    reason: "Generic HTML5 Canvas library, not ChatGPT Canvas (web-based feature)",
    downloads: 17164336,
  },
  {
    slug: "gemini-code-assist",
    toolName: "Google Gemini Code Assist",
    action: "remove",
    currentPackage: "@google/generative-ai",
    reason: "Generic Google AI SDK used by all Google AI products, not code-assist specific",
    downloads: 5212976,
  },

  // IDE PLUGINS - No standalone npm packages
  {
    slug: "jetbrains-ai",
    toolName: "JetBrains AI Assistant",
    action: "remove",
    currentPackage: "@n8n_io/ai-assistant-sdk",
    reason: "Wrong package (n8n SDK). JetBrains AI is an IDE plugin only",
    downloads: 396255,
  },
  {
    slug: "gitlab-duo-agent-platform",
    toolName: "GitLab Duo Agent Platform",
    action: "remove",
    currentPackage: "@gitlab/cluster-client",
    reason: "Wrong package (Kubernetes client). Agent Platform is IDE-based",
    downloads: 111049,
  },

  // DESKTOP APPLICATIONS - No npm packages
  {
    slug: "warp",
    toolName: "Warp",
    action: "remove",
    currentPackage: "warp",
    reason: "Wrong package (ScaleDynamics SDK). Warp is a desktop terminal app",
    downloads: 6999,
  },
  {
    slug: "zed",
    toolName: "Zed",
    action: "remove",
    currentPackage: "@schoolai/spicedb-zed-schema-parser",
    reason: "Wrong package (SpiceDB parser). Zed is a desktop editor",
    downloads: 5866,
  },

  // WEB-BASED PLATFORMS - No npm packages
  {
    slug: "lovable",
    toolName: "Lovable",
    action: "remove",
    currentPackage: "@mockdetector/widget",
    reason: "Wrong package (mock detector). Lovable is web-based",
    downloads: 4363,
  },
  {
    slug: "bolt-new",
    toolName: "Bolt.new",
    action: "remove",
    currentPackage: "selah-cli",
    reason: "Wrong package (third-party deployment tool). Bolt.new is web-based",
    downloads: 110,
  },
  {
    slug: "replit-agent",
    toolName: "Replit Agent",
    action: "remove",
    currentPackage: "replit-agent",
    reason: "Wrong package (unofficial OpenRouter TUI). Replit Agent is web-based",
    downloads: 18,
  },

  // COMPLETELY WRONG TOOLS
  {
    slug: "trae-ai",
    toolName: "Trae AI",
    action: "remove",
    currentPackage: "@andrebuzeli/git-mcp",
    reason: "Wrong package (Git MCP server). No connection to Trae AI",
    downloads: 9931,
  },
  {
    slug: "qoder",
    toolName: "Qoder",
    action: "remove",
    currentPackage: "brave-real-browser-mcp-server",
    reason: "Wrong package (Brave browser MCP). No connection to Qoder",
    downloads: 8186,
  },
  {
    slug: "kiro",
    toolName: "Kiro",
    action: "remove",
    currentPackage: "amazonq-sdd",
    reason: "Wrong package (Amazon Q extension). No connection to Kiro",
    downloads: 351,
  },
  {
    slug: "microsoft-agentic-devops",
    toolName: "Microsoft Agent Framework",
    action: "remove",
    currentPackage: "@ddse/acm-adapters",
    reason: "Wrong package (ACM adapters). Not official Microsoft package",
    downloads: 112,
  },
  {
    slug: "refact-ai",
    toolName: "Refact.ai",
    action: "remove",
    currentPackage: "react-expo-refact-ai",
    reason: "Wrong package (React Native template). No connection to Refact.ai",
    downloads: 7,
  },

  // PACKAGE CORRECTIONS
  {
    slug: "graphite",
    toolName: "Graphite",
    action: "update",
    currentPackage: "graphite",
    correctPackage: "@withgraphite/graphite-cli",
    reason: "Current package is Graphite metrics client. Correct is Graphite code review CLI",
    downloads: 15995,
  },

  // VERIFICATION NEEDED - Flagged but not automatically fixed
  {
    slug: "goose",
    toolName: "Goose",
    action: "verify",
    currentPackage: "ai-sdk-provider-goose-web",
    reason: "Provider adapter, not the main Goose CLI. Needs manual research for correct package",
    downloads: 2751,
  },
];

async function main() {
  console.log("=== NPM PACKAGE MAPPING CORRECTIONS ===\n");

  const dryRun = !process.argv.includes("--apply");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
    console.log("   Use --apply to apply corrections\n");
  } else {
    console.log("⚠️  LIVE MODE - Database will be updated\n");
  }

  const db = getDb();

  // Statistics
  const toRemove = corrections.filter((c) => c.action === "remove");
  const toUpdate = corrections.filter((c) => c.action === "update");
  const toVerify = corrections.filter((c) => c.action === "verify");

  console.log("Summary:");
  console.log(`  Remove: ${toRemove.length} tools`);
  console.log(`  Update: ${toUpdate.length} tools`);
  console.log(`  Verify: ${toVerify.length} tools (manual action needed)`);
  console.log(`  Total: ${corrections.length} corrections\n`);

  const totalIncorrectDownloads = toRemove.reduce((sum, c) => sum + c.downloads, 0);
  console.log(`Total downloads being removed: ${totalIncorrectDownloads.toLocaleString()}\n`);

  // Process removals
  if (toRemove.length > 0) {
    console.log("=== REMOVING INCORRECT NPM DATA ===\n");

    for (const correction of toRemove) {
      console.log(`${correction.toolName} (${correction.slug})`);
      console.log(`  Package: ${correction.currentPackage}`);
      console.log(`  Downloads: ${correction.downloads.toLocaleString()}`);
      console.log(`  Reason: ${correction.reason}`);

      if (!dryRun) {
        try {
          const [tool] = await db.select().from(tools).where(eq(tools.slug, correction.slug)).limit(1);

          if (tool) {
            const data = tool.data as any;

            if (data?.metrics?.npm) {
              // Remove npm metrics
              delete data.metrics.npm;

              // If metrics is now empty, remove it too
              if (Object.keys(data.metrics).length === 0) {
                delete data.metrics;
              }

              await db
                .update(tools)
                .set({
                  data: data as any,
                  updatedAt: new Date(),
                })
                .where(eq(tools.slug, correction.slug));

              console.log(`  ✅ Removed npm data from database`);
            } else {
              console.log(`  ⚠️  No npm data found (already removed?)`);
            }
          } else {
            console.log(`  ❌ Tool not found in database`);
          }
        } catch (error) {
          console.log(`  ❌ Error: ${error}`);
        }
      } else {
        console.log(`  📝 Would remove npm data`);
      }

      console.log("");
    }
  }

  // Process updates
  if (toUpdate.length > 0) {
    console.log("=== UPDATING NPM PACKAGES ===\n");

    for (const correction of toUpdate) {
      console.log(`${correction.toolName} (${correction.slug})`);
      console.log(`  Current: ${correction.currentPackage}`);
      console.log(`  Correct: ${correction.correctPackage}`);
      console.log(`  Reason: ${correction.reason}`);

      if (!dryRun) {
        console.log(`  ⚠️  Package update requires re-running collection script`);
        console.log(`  ℹ️  Removing old data first...`);

        try {
          const [tool] = await db.select().from(tools).where(eq(tools.slug, correction.slug)).limit(1);

          if (tool) {
            const data = tool.data as any;

            if (data?.metrics?.npm) {
              delete data.metrics.npm;

              await db
                .update(tools)
                .set({
                  data: data as any,
                  updatedAt: new Date(),
                })
                .where(eq(tools.slug, correction.slug));

              console.log(`  ✅ Removed old npm data`);
              console.log(`  📝 Run: npx tsx scripts/collect-npm-metrics.ts --package ${correction.correctPackage}`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Error: ${error}`);
        }
      } else {
        console.log(`  📝 Would remove old data and prepare for new collection`);
      }

      console.log("");
    }
  }

  // List verification needed
  if (toVerify.length > 0) {
    console.log("=== MANUAL VERIFICATION NEEDED ===\n");

    toVerify.forEach((correction) => {
      console.log(`${correction.toolName} (${correction.slug})`);
      console.log(`  Package: ${correction.currentPackage}`);
      console.log(`  Issue: ${correction.reason}`);
      console.log(`  Action: Manual research required\n`);
    });
  }

  // Final summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 CORRECTION SUMMARY");
  console.log("=".repeat(80));

  if (dryRun) {
    console.log("\nDry run complete. Review the changes above.");
    console.log("\nTo apply these corrections, run:");
    console.log("  npx tsx scripts/fix-npm-package-mappings.ts --apply\n");
  } else {
    console.log("\n✅ Corrections applied successfully!\n");

    console.log("Next steps:");
    console.log("  1. For updated packages, run collection script with new package names");
    console.log("  2. Verify manual cases (goose)");
    console.log("  3. Regenerate rankings: npx tsx scripts/generate-v73-rankings.ts");
    console.log("  4. Compare before/after rankings\n");
  }

  console.log("Impact:");
  console.log(`  Downloads removed: ${totalIncorrectDownloads.toLocaleString()}`);
  console.log(
    `  Tools corrected: ${toRemove.length + toUpdate.length} of ${corrections.length} total`
  );

  // Calculate expected ranking impact
  console.log("\n=== EXPECTED RANKING IMPACT ===\n");

  const impactCases = [
    {
      tool: "ChatGPT Canvas",
      before: "17.2M npm downloads",
      after: "No npm data",
      impact: "Large drop in Developer Adoption score",
    },
    {
      tool: "Google Gemini Code Assist",
      before: "5.2M npm downloads",
      after: "No npm data",
      impact: "Expected to drop from #4 to #5-6",
    },
    {
      tool: "Claude Code",
      before: "13K npm downloads",
      after: "13K npm downloads (unchanged)",
      impact: "Relative ranking should improve vs Gemini",
    },
    {
      tool: "Graphite",
      before: "16K downloads (wrong package)",
      after: "~XXK downloads (@withgraphite/graphite-cli)",
      impact: "May change slightly depending on correct package",
    },
  ];

  impactCases.forEach((impact) => {
    console.log(`${impact.tool}:`);
    console.log(`  Before: ${impact.before}`);
    console.log(`  After: ${impact.after}`);
    console.log(`  Impact: ${impact.impact}\n`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
