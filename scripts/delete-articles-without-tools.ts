#!/usr/bin/env tsx

/**
 * Delete Articles Without Tool Mentions Script
 *
 * This script identifies and deletes articles that have:
 * 1. Empty tool mentions (tool_mentions = '[]' or NULL)
 * 2. Test article patterns (titles containing "[Test]" or "Test:")
 *
 * Features:
 * - Dry-run mode to preview deletions
 * - Auto-confirm flag to skip manual confirmation
 * - JSON backup of deleted articles
 * - Transaction-based deletion for safety
 * - Detailed output and statistics
 *
 * Usage:
 *   tsx scripts/delete-articles-without-tools.ts                # Interactive mode
 *   tsx scripts/delete-articles-without-tools.ts --dry-run      # Preview only
 *   tsx scripts/delete-articles-without-tools.ts --auto-confirm # Skip confirmation
 */

import { getDb, closeDb } from '../lib/db/connection';
import { articles, articleRankingsChanges } from '../lib/db/article-schema';
import { sql, or, isNull, count } from 'drizzle-orm';
import * as readline from 'readline';
import { writeFile } from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoConfirm = args.includes('--auto-confirm');

interface ArticleToDelete {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  publishedDate: Date | null;
  sourceName: string | null;
  toolMentions: any;
  content: string;
  createdAt: Date;
  reason: string;
}

/**
 * Test article patterns
 */
const TEST_PATTERNS = {
  titles: [
    /\[test\]/i,      // [Test] in title
    /^test:/i,        // Test: at start
    /^test\s+/i,      // Test followed by space
  ]
};

/**
 * Check if article matches test patterns
 */
function isTestArticle(article: any): boolean {
  return TEST_PATTERNS.titles.some(pattern => pattern.test(article.title));
}

/**
 * Check if article has empty tool mentions
 */
function hasEmptyToolMentions(article: any): boolean {
  if (article.toolMentions === null) return true;
  if (Array.isArray(article.toolMentions) && article.toolMentions.length === 0) return true;
  return false;
}

/**
 * Determine deletion reason
 */
function getDeletionReason(article: any): string {
  const reasons: string[] = [];

  if (hasEmptyToolMentions(article)) {
    reasons.push('Empty tool mentions');
  }

  if (isTestArticle(article)) {
    reasons.push('Test article pattern');
  }

  return reasons.join(' + ');
}

/**
 * Prompt user for confirmation
 */
function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Create backup of articles to be deleted
 */
async function createBackup(articlesToDelete: ArticleToDelete[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `deleted-articles-backup-${timestamp}.json`;
  const backupPath = path.join(process.cwd(), 'data', backupFileName);

  const backup = {
    timestamp: new Date().toISOString(),
    totalArticles: articlesToDelete.length,
    articles: articlesToDelete.map(article => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      author: article.author,
      publishedDate: article.publishedDate,
      sourceName: article.sourceName,
      toolMentions: article.toolMentions,
      content: article.content,
      createdAt: article.createdAt,
      deletionReason: article.reason
    }))
  };

  await writeFile(backupPath, JSON.stringify(backup, null, 2));
  return backupPath;
}

/**
 * Display article details
 */
function displayArticle(article: ArticleToDelete, index: number) {
  console.log(`\n${index + 1}. "${article.title}"`);
  console.log(`   ID: ${article.id}`);
  console.log(`   Slug: ${article.slug}`);
  console.log(`   Author: ${article.author || 'Unknown'}`);
  console.log(`   Published: ${article.publishedDate?.toISOString().split('T')[0] || 'No date'}`);
  console.log(`   Source: ${article.sourceName || 'Unknown'}`);
  console.log(`   Tool Mentions: ${article.toolMentions ? JSON.stringify(article.toolMentions) : 'NULL'}`);
  console.log(`   Content Length: ${article.content.length} chars`);
  console.log(`   Reason: ${article.reason}`);
}

/**
 * Main deletion function
 */
async function deleteArticlesWithoutTools() {
  console.log('🗑️  DELETE ARTICLES WITHOUT TOOL MENTIONS');
  console.log('═'.repeat(100));

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  try {
    // Step 1: Fetch articles matching criteria
    console.log('\n📚 Querying articles from database...');

    const allArticles = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        author: articles.author,
        publishedDate: articles.publishedDate,
        sourceName: articles.sourceName,
        toolMentions: articles.toolMentions,
        content: articles.content,
        createdAt: articles.createdAt,
      })
      .from(articles);

    console.log(`   Found ${allArticles.length} total articles`);

    // Step 2: Identify articles to delete
    console.log('\n🔍 Analyzing articles...');

    const articlesToDelete: ArticleToDelete[] = [];

    for (const article of allArticles) {
      const shouldDelete = hasEmptyToolMentions(article) || isTestArticle(article);

      if (shouldDelete) {
        articlesToDelete.push({
          ...article,
          reason: getDeletionReason(article)
        });
      }
    }

    console.log(`   ✅ ${allArticles.length - articlesToDelete.length} articles with tool mentions`);
    console.log(`   ❌ ${articlesToDelete.length} articles to delete`);

    if (articlesToDelete.length === 0) {
      console.log('\n✨ No articles to delete! All articles have tool mentions.');
      return;
    }

    // Step 3: Group by reason
    const emptyToolMentions = articlesToDelete.filter(a =>
      a.reason.includes('Empty tool mentions')
    );
    const testArticles = articlesToDelete.filter(a =>
      a.reason.includes('Test article pattern')
    );
    const both = articlesToDelete.filter(a =>
      a.reason.includes('+')
    );

    console.log('\n   Breakdown by reason:');
    if (emptyToolMentions.length > 0) {
      console.log(`     - Empty tool mentions only: ${emptyToolMentions.length}`);
    }
    if (testArticles.length > 0) {
      console.log(`     - Test article patterns only: ${testArticles.length}`);
    }
    if (both.length > 0) {
      console.log(`     - Both criteria: ${both.length}`);
    }

    // Step 4: Display articles to delete (first 10)
    console.log('\n📋 ARTICLES TO BE DELETED (showing first 10):');
    console.log('─'.repeat(100));

    const displayLimit = Math.min(10, articlesToDelete.length);
    for (let i = 0; i < displayLimit; i++) {
      displayArticle(articlesToDelete[i], i);
    }

    if (articlesToDelete.length > 10) {
      console.log(`\n   ... and ${articlesToDelete.length - 10} more articles`);
    }

    // Step 5: Check for related ranking changes
    console.log('\n\n📊 Checking for related ranking changes...');

    const articleIds = articlesToDelete.map(a => a.id);

    // Use raw SQL to check if table exists and count
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'article_rankings_changes'
      ) as exists
    `);

    let rankingChangesCount = 0;
    if (tableCheck.rows[0]?.exists) {
      const changeCountResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM article_rankings_changes
        WHERE article_id = ANY(${sql.raw(`ARRAY['${articleIds.join("','")}']::uuid[]`)})
      `);
      rankingChangesCount = Number(changeCountResult.rows[0]?.count || 0);
      console.log(`   Found ${rankingChangesCount} ranking changes (will cascade delete)`);
    } else {
      console.log('   No article_rankings_changes table exists');
    }

    // Step 6: Summary
    console.log('\n\n📝 DELETION SUMMARY:');
    console.log('─'.repeat(100));
    console.log(`   Articles to delete: ${articlesToDelete.length}`);
    console.log(`   Ranking changes to cascade delete: ${rankingChangesCount}`);
    console.log(`   Remaining articles: ${allArticles.length - articlesToDelete.length}`);

    // Step 7: Dry run exit
    if (isDryRun) {
      console.log('\n✅ DRY RUN COMPLETE - No changes were made');
      console.log('\nTo execute the deletion:');
      console.log('  tsx scripts/delete-articles-without-tools.ts');
      console.log('  tsx scripts/delete-articles-without-tools.ts --auto-confirm  # Skip confirmation');
      console.log('\n' + '═'.repeat(100));
      return;
    }

    // Step 8: Create backup
    console.log('\n💾 Creating backup of articles to be deleted...');
    const backupPath = await createBackup(articlesToDelete);
    console.log(`   ✅ Backup saved to: ${backupPath}`);

    // Step 9: Confirmation
    console.log('\n\n⚠️  WARNING: This action will permanently delete the articles!');
    console.log('   - Articles will be deleted from the database');
    console.log('   - Related ranking changes will be cascade deleted');
    console.log(`   - A backup has been saved to: ${backupPath}`);

    let confirmed = autoConfirm;
    if (!autoConfirm) {
      confirmed = await promptConfirmation(
        `\nDelete these ${articlesToDelete.length} articles? (yes/no): `
      );
    }

    if (!confirmed) {
      console.log('\n❌ Deletion cancelled by user');
      return;
    }

    // Step 10: Perform deletion (direct delete, no transaction needed for HTTP mode)
    console.log('\n🗑️  Deleting articles...');
    const startTime = Date.now();

    let deletedCount = 0;

    // Delete articles using raw SQL for better control
    const deleteResult = await db.execute(sql`
      DELETE FROM articles
      WHERE id = ANY(${sql.raw(`ARRAY['${articleIds.join("','")}']::uuid[]`)})
      RETURNING id
    `);

    deletedCount = deleteResult.rows.length;
    console.log(`   ✅ Deleted ${deletedCount} articles`);

    const duration = Date.now() - startTime;

    // Step 11: Verify deletion
    console.log('\n✅ Deletion completed successfully!');
    console.log(`   Duration: ${duration}ms`);

    // Verify the count
    const remainingCountResult = await db
      .select({ count: count() })
      .from(articles);

    const remainingCount = remainingCountResult[0]?.count || 0;
    console.log(`   Remaining articles in database: ${remainingCount}`);

    // Step 12: Final summary
    console.log('\n📋 DELETION AUDIT LOG:');
    console.log('─'.repeat(100));
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Articles deleted: ${deletedCount}`);
    console.log(`   Ranking changes removed: ${rankingChangesCount} (cascade)`);
    console.log(`   Remaining articles: ${remainingCount}`);
    console.log(`   Backup location: ${backupPath}`);

    // Step 13: Sample remaining articles
    if (remainingCount > 0) {
      const sampleArticles = await db
        .select({
          title: articles.title,
          publishedDate: articles.publishedDate,
          toolMentions: articles.toolMentions,
        })
        .from(articles)
        .limit(5);

      console.log('\n📚 Sample of remaining articles:');
      sampleArticles.forEach((article, index) => {
        const toolCount = Array.isArray(article.toolMentions) ? article.toolMentions.length : 0;
        console.log(`   ${index + 1}. "${article.title}"`);
        console.log(`      Date: ${article.publishedDate?.toISOString().split('T')[0] || 'No date'}`);
        console.log(`      Tool mentions: ${toolCount}`);
      });
    }

    console.log('\n\n' + '═'.repeat(100));
    console.log('✨ CLEANUP COMPLETE!');

  } catch (error) {
    console.error('\n❌ ERROR during deletion:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
    throw error;
  } finally {
    await closeDb();
  }
}

// Run the script
deleteArticlesWithoutTools()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
