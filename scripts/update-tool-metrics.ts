#!/usr/bin/env tsx

import path from "node:path";
import fs from "fs-extra";

interface NewsArticle {
  id: string;
  tool_mentions?: string[];
}

interface Tool {
  id: string;
  slug: string;
  name: string;
  info: {
    metrics?: {
      news_mentions?: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

async function countToolMentions(): Promise<Map<string, number>> {
  const mentionCounts = new Map<string, number>();
  const newsDir = path.join(process.cwd(), "data", "json", "news", "articles");

  try {
    // Read all news article files
    const monthFiles = await fs.readdir(newsDir);
    const jsonFiles = monthFiles.filter((f) => f.endsWith(".json"));

    console.log(`Found ${jsonFiles.length} news article files`);

    for (const file of jsonFiles) {
      const filepath = path.join(newsDir, file);
      try {
        const fileContent = await fs.readJson(filepath);

        // Handle both array and non-array content
        const articles = Array.isArray(fileContent) ? fileContent : [fileContent];

        for (const article of articles) {
          if (article.tool_mentions && Array.isArray(article.tool_mentions)) {
            for (const toolId of article.tool_mentions) {
              const currentCount = mentionCounts.get(toolId) || 0;
              mentionCounts.set(toolId, currentCount + 1);
            }
          }
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    }

    return mentionCounts;
  } catch (error) {
    console.error("Failed to count tool mentions", error);
    throw error;
  }
}

async function updateToolMetrics(mentionCounts: Map<string, number>): Promise<void> {
  const toolsDir = path.join(process.cwd(), "data", "json", "tools", "individual");

  try {
    // Get all tool files
    const toolFiles = await fs.readdir(toolsDir);
    const jsonFiles = toolFiles.filter((f) => f.endsWith(".json"));

    console.log(`Updating metrics for ${jsonFiles.length} tools`);

    let updatedCount = 0;

    for (const file of jsonFiles) {
      const filepath = path.join(toolsDir, file);
      const tool = (await fs.readJson(filepath)) as Tool;

      // Get mention count for this tool
      const mentions = mentionCounts.get(tool.id) || 0;

      // Initialize metrics object if it doesn't exist
      if (!tool.info.metrics) {
        tool.info.metrics = {};
      }

      // Update news mentions
      const oldMentions = tool.info.metrics.news_mentions || 0;
      if (mentions !== oldMentions) {
        tool.info.metrics.news_mentions = mentions;

        // Update the tool file
        await fs.writeJson(filepath, tool, { spaces: 2 });
        updatedCount++;

        console.log(`Updated ${tool.name} (ID: ${tool.id}): ${oldMentions} → ${mentions} mentions`);
      }
    }

    console.log(`Updated ${updatedCount} tools with new mention counts`);

    // Log tools with the most mentions
    const topTools = Array.from(mentionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log("Top 10 tools by news mentions:");
    for (const [toolId, count] of topTools) {
      console.log(`  Tool ${toolId}: ${count} mentions`);
    }
  } catch (error) {
    console.error("Failed to update tool metrics", error);
    throw error;
  }
}

async function regenerateCaches(): Promise<void> {
  console.log("Regenerating all cache files...");

  try {
    // We'll use the rebuild-caches script
    const { execSync } = await import("node:child_process");

    // Run the rebuild caches script
    execSync("pnpm tsx scripts/rebuild-caches.ts", { stdio: "inherit" });

    console.log("All caches regenerated successfully");
  } catch (error) {
    console.error("Failed to regenerate caches", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("Starting tool metrics update after Kiro news integration...");

    // Count all tool mentions in news articles
    console.log("Counting tool mentions in news articles...");
    const mentionCounts = await countToolMentions();

    console.log(`Found mentions for ${mentionCounts.size} different tools`);

    // Log specific tools we're interested in
    const kiroMentions = mentionCounts.get("31") || 0;
    const claudeCodeMentions = mentionCounts.get("4") || 0;

    console.log(`Kiro (ID: 31) mentions: ${kiroMentions}`);
    console.log(`Claude Code (ID: 4) mentions: ${claudeCodeMentions}`);

    // Update tool metrics
    console.log("Updating tool metrics...");
    await updateToolMetrics(mentionCounts);

    // Regenerate all caches
    await regenerateCaches();

    console.log("Tool metrics update completed successfully!");
    console.log("Next step: Restart the development server with 'pnpm run dev:pm2 restart'");
  } catch (error) {
    console.error("Failed to update tool metrics", error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
