#!/usr/bin/env tsx

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { sql, eq } from "drizzle-orm";
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
  
  // Find test articles in backup
  const testSlugs = [
    "microsoft-announces-intellicode-at-build-2018",
    "tabnine-rebrands-from-codota-expands-ai-capabilities",
    "cursor-reaches-100m-arr-fastest-saas-growth"
  ];
  
  console.log("Checking test articles...\n");
  
  for (const slug of testSlugs) {
    const backupArticle = backupData.articles.find((a: any) => a.slug === slug);
    
    if (!backupArticle) {
      console.log(`✗ ${slug}: Not found in backup`);
      continue;
    }
    
    const dbResult = await db
      .select({ 
        id: articles.id, 
        title: articles.title, 
        toolMentions: articles.toolMentions,
        slug: articles.slug 
      })
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);
    
    if (dbResult.length === 0) {
      console.log(`✗ ${slug}: Not found in database`);
      continue;
    }
    
    const dbArticle = dbResult[0];
    const backupToolMentions = backupArticle.tool_mentions || [];
    const dbToolMentions = dbArticle.toolMentions || [];
    
    console.log(`Article: ${backupArticle.title}`);
    console.log(`  Slug: ${slug}`);
    console.log(`  Backup tool_mentions: ${JSON.stringify(backupToolMentions)}`);
    console.log(`  DB tool_mentions: ${JSON.stringify(dbToolMentions)}`);
    console.log(`  Match: ${backupToolMentions.length === dbToolMentions.length ? '✓' : '✗'}\n`);
  }
  
  // Count total mismatch
  console.log("\nCounting total articles with non-empty backup but empty DB...");
  let mismatchCount = 0;
  
  for (const backupArticle of backupData.articles) {
    const backupToolMentions = backupArticle.tool_mentions || [];
    if (backupToolMentions.length === 0) continue;
    
    const dbResult = await db
      .select({ toolMentions: articles.toolMentions })
      .from(articles)
      .where(eq(articles.id, backupArticle.id))
      .limit(1);
    
    if (dbResult.length === 0) continue;
    
    const dbToolMentions = dbResult[0].toolMentions || [];
    if (dbToolMentions.length === 0) {
      mismatchCount++;
      if (mismatchCount <= 5) {
        console.log(`  ${mismatchCount}. ${backupArticle.slug}: backup has ${backupToolMentions.length} mentions, DB has 0`);
      }
    }
  }
  
  console.log(`\nTotal articles with backup mentions but empty DB: ${mismatchCount}`);
}

main().catch(console.error);
