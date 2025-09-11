#!/usr/bin/env tsx
/**
 * Migration Script: JSON to PostgreSQL
 * Copies existing JSON data to PostgreSQL with JSONB storage
 */

// Load environment variables from .env files FIRST
import * as dotenv from 'dotenv';

// Load .env.local first (higher priority), then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import * as fs from 'fs';
import * as path from 'path';
import { getDb, testConnection } from '../src/lib/db/connection';
import { tools, rankings, news, migrations } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const DATA_DIR = path.join(process.cwd(), 'data', 'json');
const MODE = process.env["DATABASE_MIGRATION_MODE"] || 'dry-run';

interface MigrationStats {
  tools: { total: number; migrated: number; errors: number };
  rankings: { total: number; migrated: number; errors: number };
  news: { total: number; migrated: number; errors: number };
}

/**
 * Load JSON file safely
 */
function loadJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return null;
  }
}

/**
 * Migrate tools data
 */
async function migrateTools(db: any, stats: MigrationStats): Promise<void> {
  console.log('\n📦 Migrating Tools...');
  
  const toolsPath = path.join(DATA_DIR, 'tools', 'tools.json');
  const toolsData = loadJsonFile<{ tools: any[] }>(toolsPath);
  
  if (!toolsData?.tools) {
    console.warn('No tools data found');
    return;
  }

  stats.tools.total = toolsData.tools.length;
  
  for (const tool of toolsData.tools) {
    try {
      // Check if tool exists
      const existing = await db
        .select()
        .from(tools)
        .where(eq(tools.slug, tool.slug))
        .limit(1);

      if (existing.length > 0 && MODE !== 'sync') {
        console.log(`  ⏭️  Tool exists: ${tool.slug}`);
        continue;
      }

      // Prepare tool data
      const toolRecord = {
        slug: tool.slug,
        name: tool.name,
        category: tool.category || 'uncategorized',
        status: tool.status || 'active',
        companyId: tool.company_id || tool.companyId,
        data: {
          id: tool.id,
          info: tool.info,
          technical: tool.technical,
          pricing: tool.pricing,
          metrics: tool.metrics,
          ecosystem: tool.ecosystem,
          alternatives: tool.alternatives,
          website_url: tool.website_url,
          description: tool.description,
        },
      };

      if (MODE === 'dry-run') {
        console.log(`  🔍 Would migrate: ${tool.name} (${tool.slug})`);
      } else if (MODE === 'migrate' || MODE === 'sync') {
        if (existing.length > 0) {
          // Update existing
          await db
            .update(tools)
            .set(toolRecord)
            .where(eq(tools.slug, tool.slug));
          console.log(`  ✅ Updated: ${tool.name}`);
        } else {
          // Insert new
          await db.insert(tools).values(toolRecord);
          console.log(`  ✅ Migrated: ${tool.name}`);
        }
        stats.tools.migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Error migrating ${tool.slug}:`, error);
      stats.tools.errors++;
    }
  }
}

/**
 * Migrate rankings data
 */
async function migrateRankings(db: any, stats: MigrationStats): Promise<void> {
  console.log('\n📊 Migrating Rankings...');
  
  const rankingsPath = path.join(process.cwd(), 'public', 'data', 'rankings.json');
  const rankingsData = loadJsonFile<{ rankings: any[], metadata?: any }>(rankingsPath);
  
  if (!rankingsData?.rankings) {
    console.warn('No rankings data found');
    return;
  }

  stats.rankings.total = 1; // One ranking period
  
  try {
    const period = rankingsData.metadata?.period || '2025-09';
    
    // Check if ranking exists
    const existing = await db
      .select()
      .from(rankings)
      .where(eq(rankings.period, period))
      .limit(1);

    if (existing.length > 0 && MODE !== 'sync') {
      console.log(`  ⏭️  Rankings exist for period: ${period}`);
      return;
    }

    const rankingRecord = {
      period,
      algorithmVersion: rankingsData.metadata?.algorithm_version || 'v1.0',
      isCurrent: true,
      publishedAt: new Date(),
      data: rankingsData.rankings,
    };

    if (MODE === 'dry-run') {
      console.log(`  🔍 Would migrate rankings for period: ${period} (${rankingsData.rankings.length} tools)`);
    } else if (MODE === 'migrate' || MODE === 'sync') {
      if (existing.length > 0) {
        // Update existing
        await db
          .update(rankings)
          .set(rankingRecord)
          .where(eq(rankings.period, period));
        console.log(`  ✅ Updated rankings for: ${period}`);
      } else {
        // Mark all others as not current
        await db
          .update(rankings)
          .set({ isCurrent: false });
        
        // Insert new
        await db.insert(rankings).values(rankingRecord);
        console.log(`  ✅ Migrated rankings for: ${period}`);
      }
      stats.rankings.migrated++;
    }
  } catch (error) {
    console.error('  ❌ Error migrating rankings:', error);
    stats.rankings.errors++;
  }
}

/**
 * Migrate news data
 */
async function migrateNews(db: any, stats: MigrationStats): Promise<void> {
  console.log('\n📰 Migrating News Articles...');
  
  const newsPath = path.join(DATA_DIR, 'news', 'news.json');
  const newsData = loadJsonFile<{ articles: any[] }>(newsPath);
  
  if (!newsData?.articles) {
    console.warn('No news data found');
    return;
  }

  stats.news.total = newsData.articles.length;
  console.log(`  Found ${stats.news.total} articles to migrate`);
  
  // Process in batches for performance
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < newsData.articles.length; i += BATCH_SIZE) {
    const batch = newsData.articles.slice(i, Math.min(i + BATCH_SIZE, newsData.articles.length));
    
    for (const article of batch) {
      try {
        // Check if article exists
        const existing = await db
          .select()
          .from(news)
          .where(eq(news.slug, article.slug))
          .limit(1);

        if (existing.length > 0 && MODE !== 'sync') {
          continue;
        }

        const newsRecord = {
          slug: article.slug,
          articleId: article.id,
          title: article.title,
          summary: article.summary,
          category: article.category,
          source: article.source,
          sourceUrl: article.source_url,
          publishedAt: new Date(article.published_at || article.created_at),
          date: article.date ? new Date(article.date) : null,
          toolMentions: article.tool_mentions || [],
          importanceScore: article.importance_score || 0,
          data: {
            content: article.content,
            tags: article.tags,
            author: article.author,
            image_url: article.image_url,
            related_tools: article.related_tools,
          },
        };

        if (MODE === 'dry-run') {
          if (i < 5) { // Only show first 5 in dry-run
            console.log(`  🔍 Would migrate: ${article.title.substring(0, 60)}...`);
          }
        } else if (MODE === 'migrate' || MODE === 'sync') {
          if (existing.length > 0) {
            // Update existing
            await db
              .update(news)
              .set(newsRecord)
              .where(eq(news.slug, article.slug));
          } else {
            // Insert new
            await db.insert(news).values(newsRecord);
          }
          stats.news.migrated++;
        }
      } catch (error) {
        console.error(`  ❌ Error migrating article ${article.slug}:`, error);
        stats.news.errors++;
      }
    }
    
    if (MODE !== 'dry-run' && stats.news.migrated > 0) {
      console.log(`  ✅ Migrated batch: ${stats.news.migrated}/${stats.news.total} articles`);
    }
  }
}

/**
 * Record migration status
 */
async function recordMigration(db: any, name: string, status: string, error?: string): Promise<void> {
  if (MODE === 'dry-run') return;
  
  try {
    const existing = await db
      .select()
      .from(migrations)
      .where(eq(migrations.name, name))
      .limit(1);

    const migrationRecord = {
      name,
      status,
      completedAt: status === 'completed' ? new Date() : null,
      error: error || null,
      metadata: {
        mode: MODE,
        timestamp: new Date().toISOString(),
      },
    };

    if (existing.length > 0) {
      await db
        .update(migrations)
        .set(migrationRecord)
        .where(eq(migrations.name, name));
    } else {
      await db.insert(migrations).values({
        ...migrationRecord,
        startedAt: new Date(),
      });
    }
  } catch (err) {
    console.error('Failed to record migration:', err);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting JSON to PostgreSQL Migration');
  console.log(`Mode: ${MODE}`);
  console.log('----------------------------------------');

  // Test database connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Database connection failed. Please check your configuration.');
    process.exit(1);
  }

  const db = getDb();
  if (!db) {
    console.error('❌ Could not get database connection');
    process.exit(1);
  }

  const stats: MigrationStats = {
    tools: { total: 0, migrated: 0, errors: 0 },
    rankings: { total: 0, migrated: 0, errors: 0 },
    news: { total: 0, migrated: 0, errors: 0 },
  };

  const migrationName = `json-to-db-${Date.now()}`;
  
  try {
    // Record migration start
    await recordMigration(db, migrationName, 'running');

    // Run migrations
    await migrateTools(db, stats);
    await migrateRankings(db, stats);
    await migrateNews(db, stats);

    // Record migration completion
    await recordMigration(db, migrationName, 'completed');

    // Print summary
    console.log('\n========================================');
    console.log('📊 Migration Summary');
    console.log('========================================');
    console.log(`Mode: ${MODE}`);
    console.log('\nTools:');
    console.log(`  Total: ${stats.tools.total}`);
    console.log(`  Migrated: ${stats.tools.migrated}`);
    console.log(`  Errors: ${stats.tools.errors}`);
    console.log('\nRankings:');
    console.log(`  Total: ${stats.rankings.total}`);
    console.log(`  Migrated: ${stats.rankings.migrated}`);
    console.log(`  Errors: ${stats.rankings.errors}`);
    console.log('\nNews:');
    console.log(`  Total: ${stats.news.total}`);
    console.log(`  Migrated: ${stats.news.migrated}`);
    console.log(`  Errors: ${stats.news.errors}`);
    console.log('========================================');

    if (MODE === 'dry-run') {
      console.log('\n💡 This was a dry run. To actually migrate data, set DATABASE_MIGRATION_MODE="migrate" in .env.local');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await recordMigration(db, migrationName, 'failed', String(error));
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main().catch(console.error);
}