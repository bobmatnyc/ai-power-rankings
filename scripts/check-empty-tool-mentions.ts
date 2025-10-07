#!/usr/bin/env tsx

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const db = getDb();

  // Get articles with empty tool_mentions
  const emptyArticles = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      toolMentions: articles.toolMentions,
    })
    .from(articles)
    .where(sql`${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL`)
    .limit(10);

  console.log(`\nFound ${emptyArticles.length} articles with empty tool_mentions:\n`);

  emptyArticles.forEach((a, i) => {
    console.log(`${i + 1}. ID: ${a.id}`);
    console.log(`   Slug: ${a.slug}`);
    console.log(`   Title: ${a.title.substring(0, 80)}...`);
    console.log(`   tool_mentions: ${JSON.stringify(a.toolMentions)}`);
    console.log();
  });

  // Check backup file
  const backupPath = path.join(
    process.cwd(),
    "data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z"
  );

  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  console.log(`\nBackup contains ${backupData.articles.length} articles`);

  // Check if these IDs exist in backup
  console.log("\nChecking if empty articles exist in backup:");
  emptyArticles.forEach((dbArticle) => {
    const backupArticle = backupData.articles.find((ba: any) => ba.id === dbArticle.id);
    if (backupArticle) {
      const toolMentions = backupArticle.tool_mentions || backupArticle.toolMentions || [];
      console.log(`  ✓ ${dbArticle.slug}: Found in backup with ${toolMentions.length} tool_mentions`);
      if (toolMentions.length > 0) {
        console.log(`    Tools: ${toolMentions.join(", ")}`);
      }
    } else {
      console.log(`  ✗ ${dbArticle.slug}: NOT found in backup`);
    }
  });
}

main().catch(console.error);
