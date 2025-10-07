#!/usr/bin/env tsx

import { getDb } from '../lib/db/connection';
import { articles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// UUID v4 format validation regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Article {
  id: string;
  slug: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  author: string | null;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  locale: string;
  category: string;
  toolsMentioned: string[];
  sentiment: string | null;
  impact: string | null;
  summary: string | null;
  keyTakeaways: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UUIDMapping {
  oldId: string;
  newId: string;
  slug: string;
  title: string;
}

interface RestoreStats {
  totalArticles: number;
  invalidUUIDs: number;
  alreadyExists: number;
  restored: number;
  failed: number;
  skipped: number;
}

function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

async function loadBackupFile(backupPath: string): Promise<Article[]> {
  console.log(`\n📂 Loading backup file: ${backupPath}`);

  try {
    const content = await fs.readFile(backupPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both direct array and {articles: [...]} structure
    const articles = Array.isArray(parsed) ? parsed : parsed.articles;

    if (!Array.isArray(articles)) {
      throw new Error('Backup file does not contain an array of articles');
    }

    console.log(`✅ Loaded ${articles.length} articles from backup`);
    return articles;
  } catch (error) {
    console.error('❌ Failed to load backup file:', error);
    throw error;
  }
}

async function checkExistingArticles(db: any, slugs: string[]): Promise<Set<string>> {
  console.log(`\n🔍 Checking for existing articles in database...`);

  const existingSlugs = new Set<string>();

  // Check in batches of 100
  for (let i = 0; i < slugs.length; i += 100) {
    const batch = slugs.slice(i, i + 100);
    const existing = await db
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.slug, batch[0])); // Will check each individually

    // Better approach: check all slugs individually
    for (const slug of batch) {
      const found = await db
        .select({ slug: articles.slug })
        .from(articles)
        .where(eq(articles.slug, slug))
        .limit(1);

      if (found.length > 0) {
        existingSlugs.add(slug);
      }
    }
  }

  console.log(`📊 Found ${existingSlugs.size} articles already in database`);
  return existingSlugs;
}

function identifyInvalidUUIDs(articles: Article[]): Article[] {
  console.log(`\n🔍 Identifying articles with invalid UUIDs...`);

  const invalid = articles.filter(article => !isValidUUID(article.id));

  console.log(`📊 Found ${invalid.length} articles with invalid UUID format`);

  if (invalid.length > 0) {
    console.log('\n📝 Sample invalid IDs:');
    invalid.slice(0, 5).forEach(article => {
      console.log(`   - ${article.id} (${article.slug})`);
    });
    if (invalid.length > 5) {
      console.log(`   ... and ${invalid.length - 5} more`);
    }
  }

  return invalid;
}

function generateUUIDMappings(articles: Article[]): UUIDMapping[] {
  console.log(`\n🔄 Generating new UUIDs for invalid IDs...`);

  const mappings: UUIDMapping[] = articles.map(article => ({
    oldId: article.id,
    newId: randomUUID(),
    slug: article.slug,
    title: article.title
  }));

  console.log(`✅ Generated ${mappings.length} new UUIDs`);
  return mappings;
}

async function saveMappingsFile(mappings: UUIDMapping[], outputPath: string): Promise<void> {
  console.log(`\n💾 Saving UUID mappings to: ${outputPath}`);

  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Save mappings
    await fs.writeFile(
      outputPath,
      JSON.stringify(mappings, null, 2),
      'utf-8'
    );

    console.log(`✅ Saved ${mappings.length} UUID mappings`);
  } catch (error) {
    console.error('❌ Failed to save mappings file:', error);
    throw error;
  }
}

async function insertArticleBatch(
  db: any,
  articlesToInsert: Article[],
  batchSize: number = 50
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < articlesToInsert.length; i += batchSize) {
    const batch = articlesToInsert.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(articlesToInsert.length / batchSize);

    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

    // Insert articles individually (neon-http doesn't support transactions)
    for (const article of batch) {
      try {
        const now = new Date();
        await db.insert(articles).values({
          id: article.id,
          slug: article.slug,
          title: article.title,
          content: article.content || article.summary || '',
          ingestionType: article.ingestionType || 'url',
          sourceUrl: article.source_url || article.url,
          sourceName: article.source || 'Unknown',
          publishedAt: article.publishedAt || article.date ? new Date(article.publishedAt || article.date) : now,
          locale: article.locale || 'en',
          toolsMentioned: article.tool_mentions || article.toolsMentioned || [],
          sentiment: article.sentiment,
          impact: article.impact,
          summary: article.summary,
          createdAt: article.created_at || article.createdAt ? new Date(article.created_at || article.createdAt) : now,
          updatedAt: article.updated_at || article.updatedAt ? new Date(article.updated_at || article.updatedAt) : now
        });
        success++;
        console.log(`   ✅ Inserted: ${article.slug}`);
      } catch (error: any) {
        failed++;
        console.error(`   ❌ Failed to insert ${article.slug}:`, error.message);
      }
    }
  }

  return { success, failed };
}

async function restoreArticles(
  backupPath: string,
  dryRun: boolean = false
): Promise<RestoreStats> {
  const stats: RestoreStats = {
    totalArticles: 0,
    invalidUUIDs: 0,
    alreadyExists: 0,
    restored: 0,
    failed: 0,
    skipped: 0
  };

  console.log('🚀 Starting UUID fix and restore process...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE RUN'}`);

  // Load backup file
  const backupArticles = await loadBackupFile(backupPath);
  stats.totalArticles = backupArticles.length;

  // Identify articles with invalid UUIDs
  const invalidUUIDArticles = identifyInvalidUUIDs(backupArticles);
  stats.invalidUUIDs = invalidUUIDArticles.length;

  if (invalidUUIDArticles.length === 0) {
    console.log('\n✅ No invalid UUIDs found. Nothing to fix.');
    return stats;
  }

  // Generate new UUIDs
  const uuidMappings = generateUUIDMappings(invalidUUIDArticles);

  // Save mappings file (even in dry run mode for reference)
  const mappingsPath = path.join(process.cwd(), 'data', 'uuid-mappings.json');
  await saveMappingsFile(uuidMappings, mappingsPath);

  if (dryRun) {
    console.log('\n📋 DRY RUN Summary:');
    console.log(`   - Articles with invalid UUIDs: ${stats.invalidUUIDs}`);
    console.log(`   - New UUIDs generated: ${uuidMappings.length}`);
    console.log(`   - Mappings saved to: ${mappingsPath}`);
    console.log('\n💡 Run without --dry-run to apply changes');
    return stats;
  }

  // Connect to database
  const db = getDb();

  // Check which articles already exist
  const slugsToCheck = invalidUUIDArticles.map(a => a.slug);
  const existingSlugs = await checkExistingArticles(db, slugsToCheck);
  stats.alreadyExists = existingSlugs.size;

  // Create articles to insert with new UUIDs
  const articlesToInsert = invalidUUIDArticles
    .filter(article => !existingSlugs.has(article.slug))
    .map(article => {
      const mapping = uuidMappings.find(m => m.oldId === article.id);
      return {
        ...article,
        id: mapping!.newId
      };
    });

  stats.skipped = stats.alreadyExists;

  console.log(`\n📊 Articles to restore: ${articlesToInsert.length}`);
  console.log(`   - Skipped (already exist): ${stats.skipped}`);

  if (articlesToInsert.length === 0) {
    console.log('\n✅ All articles already exist in database. Nothing to restore.');
    return stats;
  }

  // Insert articles in batches
  console.log('\n🔄 Starting batch inserts...');
  const { success, failed } = await insertArticleBatch(db, articlesToInsert);

  stats.restored = success;
  stats.failed = failed;

  return stats;
}

function printFinalReport(stats: RestoreStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RESTORE REPORT');
  console.log('='.repeat(60));
  console.log(`Total articles in backup:        ${stats.totalArticles}`);
  console.log(`Articles with invalid UUIDs:     ${stats.invalidUUIDs}`);
  console.log(`Articles already in database:    ${stats.alreadyExists}`);
  console.log(`Articles skipped:                ${stats.skipped}`);
  console.log(`Articles successfully restored:  ${stats.restored}`);
  console.log(`Articles failed to restore:      ${stats.failed}`);
  console.log('='.repeat(60));

  if (stats.restored > 0) {
    console.log(`\n✅ Successfully restored ${stats.restored} articles with fixed UUIDs!`);
  }

  if (stats.failed > 0) {
    console.log(`\n⚠️  Warning: ${stats.failed} articles failed to restore`);
  }

  const expectedTotal = 251 + stats.restored;
  console.log(`\n📈 Expected total articles in database: ${expectedTotal}`);
  console.log(`💡 Run this to verify: SELECT COUNT(*) FROM articles;`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const backupPath = '/Users/masa/Projects/managed/aipowerranking/data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z';

  try {
    const stats = await restoreArticles(backupPath, dryRun);
    printFinalReport(stats);

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
