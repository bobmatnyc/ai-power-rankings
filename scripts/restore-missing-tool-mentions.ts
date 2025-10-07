#!/usr/bin/env tsx

/**
 * Restore Missing Tool Mentions from Backup
 * 
 * This script restores tool_mentions for articles that:
 * 1. Have tool_mentions in the backup file
 * 2. Currently have 0 tool_mentions in the database
 * 3. Have valid UUIDs (can be matched to database records)
 */

import { getDb } from "@/lib/db/connection";
import { articles } from "@/lib/db/article-schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import type { ValidatedToolMention } from "@/lib/types/article-analysis";

const BACKUP_PATH = path.join(
  process.cwd(),
  "data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z"
);

const UUID_MAPPINGS_PATH = path.join(
  process.cwd(),
  "data/uuid-mappings.json"
);

interface UuidMapping {
  oldId: string;
  newId: string;
  slug: string;
  title: string;
}

function transformToolMentions(toolMentions: string[]): ValidatedToolMention[] {
  return toolMentions.map((toolName) => ({
    name: toolName,
    relevance: 0.5,
    sentiment: 0,
    context: "Restored from backup",
  }));
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const autoConfirm = process.argv.includes("--auto-confirm");

  console.log("Loading backup file...");
  const backupData = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));

  console.log("Loading UUID mappings...");
  const uuidMappingsArray = JSON.parse(fs.readFileSync(UUID_MAPPINGS_PATH, "utf-8")) as UuidMapping[];

  // Create a map from old IDs to new IDs
  const uuidMap = new Map<string, string>();
  for (const mapping of Object.values(uuidMappingsArray)) {
    if (mapping && typeof mapping === 'object' && 'oldId' in mapping && 'newId' in mapping) {
      uuidMap.set(mapping.oldId, mapping.newId);
    }
  }

  console.log(`UUID mappings loaded: ${uuidMap.size} mappings`);

  const db = getDb();

  let restoredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let skippedNoMapping = 0;
  let skippedNoToolMentions = 0;
  let skippedAlreadyHasMentions = 0;

  console.log(`\nProcessing ${backupData.articles.length} articles from backup...`);
  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  } else if (!autoConfirm) {
    console.log("⚠️  LIVE MODE - Changes will be applied\n");
  }

  for (const backupArticle of backupData.articles) {
    const backupToolMentions = backupArticle.tool_mentions || [];

    // Skip if backup has no tool mentions
    if (backupToolMentions.length === 0) {
      skippedNoToolMentions++;
      continue;
    }

    // Get the new UUID from the mapping
    const oldId = backupArticle.id;
    const newId = uuidMap.get(oldId);

    if (!newId) {
      // Check if it's already a valid UUID (newer articles)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(oldId)) {
        // Use the old ID as-is since it's already valid
        // Continue with oldId
      } else {
        skippedNoMapping++;
        continue;
      }
    }

    const articleId = newId || oldId;

    try {
      // Check current database state
      const dbResult = await db
        .select({ toolMentions: articles.toolMentions, title: articles.title })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);

      if (dbResult.length === 0) {
        skippedCount++;
        continue;
      }

      const dbToolMentions = dbResult[0].toolMentions || [];

      // Only restore if database currently has 0 mentions
      if (dbToolMentions.length === 0) {
        const transformed = transformToolMentions(backupToolMentions);

        if (isDryRun) {
          console.log(`[DRY RUN] Would restore: ${backupArticle.slug}`);
          console.log(`          Tool mentions: ${JSON.stringify(backupToolMentions)}`);
        } else {
          await db
            .update(articles)
            .set({
              toolMentions: transformed as any,
              updatedAt: new Date(),
            })
            .where(eq(articles.id, articleId));

          console.log(`✓ Restored: ${backupArticle.slug} (${backupToolMentions.length} mentions)`);
        }

        restoredCount++;
      } else {
        skippedAlreadyHasMentions++;
      }
    } catch (error) {
      errorCount++;
      console.error(`✗ Error: ${backupArticle.slug}:`, error);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Summary:");
  console.log(`  ${isDryRun ? 'Would restore' : 'Restored'}: ${restoredCount} articles`);
  console.log(`  Skipped (no tool mentions in backup): ${skippedNoToolMentions} articles`);
  console.log(`  Skipped (no UUID mapping): ${skippedNoMapping} articles`);
  console.log(`  Skipped (already has mentions): ${skippedAlreadyHasMentions} articles`);
  console.log(`  Skipped (not in DB): ${skippedCount} articles`);
  console.log(`  Errors: ${errorCount} articles`);
  console.log("=".repeat(80));

  if (isDryRun) {
    console.log("\n✅ Dry run complete. Run with --auto-confirm to apply changes.");
  }
}

main().catch(console.error);
