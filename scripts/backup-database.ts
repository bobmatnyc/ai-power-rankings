/**
 * Create backup before duplicate cleanup
 * Safety measure for duplicate cleanup implementation
 */

import { sql } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";
import * as fs from "fs";
import * as path from "path";

async function createBackup() {
  const db = getDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'tmp', 'backups');

  try {
    // Ensure backup directory exists
    await fs.promises.mkdir(backupDir, { recursive: true });

    console.log("📋 Creating database backup before duplicate cleanup...");

    // Export all articles
    const allArticles = await db.select().from(articles);
    console.log(`📊 Backing up ${allArticles.length} articles`);

    const backupFile = path.join(backupDir, `articles-backup-${timestamp}.json`);
    await fs.promises.writeFile(
      backupFile,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        total_articles: allArticles.length,
        backup_reason: "duplicate_cleanup_safety",
        articles: allArticles
      }, null, 2)
    );

    // Verify backup file
    const backupData = JSON.parse(await fs.promises.readFile(backupFile, 'utf-8'));
    const backupCount = backupData.articles.length;

    if (backupCount !== allArticles.length) {
      throw new Error(`Backup verification failed: Expected ${allArticles.length} articles, got ${backupCount}`);
    }

    console.log(`✅ Backup created successfully: ${backupFile}`);
    console.log(`📊 Backup contains ${backupCount} articles`);

    // Create verification hash
    const articleIds = allArticles.map(a => a.id).sort();
    const verificationHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(articleIds))
      .digest('hex');

    const hashFile = path.join(backupDir, `articles-backup-${timestamp}.hash`);
    await fs.promises.writeFile(hashFile, verificationHash);

    console.log(`🔐 Verification hash: ${verificationHash}`);
    console.log(`📁 Hash file: ${hashFile}`);

    return {
      backupFile,
      hashFile,
      articleCount: backupCount,
      verificationHash
    };

  } catch (error) {
    console.error("❌ Error creating backup:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const result = await createBackup();
    console.log(`\n🎯 Backup complete. Safe to proceed with duplicate cleanup.`);
    console.log(`📋 Backup details:`, result);
    process.exit(0);
  } catch (error) {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  }
}

main();
