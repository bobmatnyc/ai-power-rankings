#!/usr/bin/env tsx

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const db = getDb();

  // Load backup
  const backupPath = path.join(
    process.cwd(),
    "data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z"
  );
  const backupData = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

  // Get articles with tool_mentions from backup
  const backupWithMentions = backupData.articles.filter((a: any) => {
    const tm = a.tool_mentions || a.toolMentions || [];
    return tm.length > 0;
  });

  console.log(`\nBackup has ${backupWithMentions.length} articles with tool_mentions`);
  console.log("\nChecking database state for first 10 articles...\n");

  for (let i = 0; i < Math.min(10, backupWithMentions.length); i++) {
    const backupArticle = backupWithMentions[i];
    const backupToolMentions = backupArticle.tool_mentions || backupArticle.toolMentions || [];

    // Query database for this article
    const dbResult = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        toolMentions: articles.toolMentions,
      })
      .from(articles)
      .where(eq(articles.id, backupArticle.id))
      .limit(1);

    if (dbResult.length === 0) {
      console.log(`${i + 1}. ${backupArticle.slug}`);
      console.log(`   ✗ NOT FOUND in database`);
      console.log(`   Backup has: ${backupToolMentions.join(", ")}`);
    } else {
      const dbArticle = dbResult[0];
      const dbToolMentions = dbArticle.toolMentions as any[] || [];

      console.log(`${i + 1}. ${dbArticle.slug}`);
      console.log(`   Backup tool_mentions (${backupToolMentions.length}): ${backupToolMentions.join(", ")}`);
      console.log(`   DB tool_mentions (${dbToolMentions.length}): ${dbToolMentions.length === 0 ? "[]" : JSON.stringify(dbToolMentions, null, 2).substring(0, 200)}...`);

      if (dbToolMentions.length === 0) {
        console.log(`   → NEEDS MIGRATION`);
      } else {
        console.log(`   → Already has object mentions`);
      }
    }
    console.log();
  }

  // Count how many need migration
  console.log("\nCounting articles that need migration...");
  let needsMigration = 0;
  let alreadyMigrated = 0;
  let notFound = 0;

  for (const backupArticle of backupWithMentions) {
    const backupToolMentions = backupArticle.tool_mentions || backupArticle.toolMentions || [];

    const dbResult = await db
      .select({
        toolMentions: articles.toolMentions,
      })
      .from(articles)
      .where(eq(articles.id, backupArticle.id))
      .limit(1);

    if (dbResult.length === 0) {
      notFound++;
    } else {
      const dbToolMentions = dbResult[0].toolMentions as any[] || [];
      if (dbToolMentions.length === 0 && backupToolMentions.length > 0) {
        needsMigration++;
      } else if (dbToolMentions.length > 0) {
        alreadyMigrated++;
      }
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Backup articles with tool_mentions: ${backupWithMentions.length}`);
  console.log(`  DB articles needing migration: ${needsMigration}`);
  console.log(`  DB articles already migrated: ${alreadyMigrated}`);
  console.log(`  Articles not found in DB: ${notFound}`);
}

main().catch(console.error);
