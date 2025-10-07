#!/usr/bin/env tsx

/**
 * Enhanced Test Article Cleanup Script
 *
 * Removes test articles based on comprehensive detection criteria:
 * - Test author names
 * - Generic/placeholder titles
 * - Duplicate content
 * - Placeholder content patterns
 * - Suspicious metadata (midnight timestamps, Unknown sources)
 */

import { getDb } from '../lib/db/connection';
import { articles } from '../lib/db/article-schema';
import { eq, sql } from 'drizzle-orm';
import * as readline from 'readline';

interface Article {
  id: string;
  title: string;
  author: string | null;
  content: string;
  publishedDate: Date;
  source: string | null;
  locale: string;
  createdAt: Date;
}

interface TestArticle {
  article: Article;
  reasons: string[];
}

// Detection patterns
const TEST_AUTHORS = [
  'Field Length Test',
  'QA Tester',
  'Test Reporter',
  'AI Reporter',
  'John Doe',
  'Jane Doe',
  'Test Author',
  'Test User',
  'Demo Author',
  'Test Writer',
  'Sample Author'
];

const TEST_TITLE_PATTERNS = [
  /^No article/i,
  /^Generic AI/i,
  /^Pre-analyzed Article/i,
  /^Test Article/i,
  /^Breaking News: Claude Code Advances/i,
  /^GitHub Copilot revolutionizes coding/i,
  /^Multiple AI Tools Transforming/i,
  /^AI Code Assistant - Revolutionary/i,
  /^Sample Article/i,
  /^Demo:/i,
  /\[TEST\]/i,
  /\[DEMO\]/i
];

const TEST_CONTENT_PATTERNS = [
  /No article content/i,
  /placeholder text/i,
  /Lorem ipsum/i,
  /This is a test/i,
  /Sample content/i,
  /Test data/i
];

const TEST_SOURCES = ['Unknown', 'Test', 'Demo', 'Sample'];

/**
 * Check if article matches test author criteria
 */
function isTestAuthor(article: Article): boolean {
  if (!article.author) return false;
  return TEST_AUTHORS.some(testAuthor =>
    article.author!.toLowerCase().includes(testAuthor.toLowerCase())
  );
}

/**
 * Check if article has generic/test title
 */
function hasTestTitle(article: Article): boolean {
  return TEST_TITLE_PATTERNS.some(pattern => pattern.test(article.title));
}

/**
 * Check if article has placeholder content
 */
function hasPlaceholderContent(article: Article): boolean {
  return TEST_CONTENT_PATTERNS.some(pattern => pattern.test(article.content));
}

/**
 * Check if article has suspiciously short content
 */
function hasShortContent(article: Article): boolean {
  return article.content.length < 500;
}

/**
 * Check if article was published exactly at midnight (suspicious)
 */
function isExactMidnight(article: Article): boolean {
  const date = new Date(article.publishedDate);
  return date.getHours() === 0 &&
         date.getMinutes() === 0 &&
         date.getSeconds() === 0 &&
         date.getMilliseconds() === 0;
}

/**
 * Check if article has test source
 */
function hasTestSource(article: Article): boolean {
  if (!article.source) return false;
  return TEST_SOURCES.some(testSource =>
    article.source!.toLowerCase().includes(testSource.toLowerCase())
  );
}

/**
 * Detect all test articles with reasons
 */
function detectTestArticles(allArticles: Article[]): {
  testArticles: TestArticle[];
  legitimateArticles: Article[];
  duplicateGroups: Map<string, Article[]>;
} {
  const testArticlesMap = new Map<number, TestArticle>();
  const duplicateGroups = new Map<string, Article[]>();

  // First pass: detect by individual criteria
  allArticles.forEach(article => {
    const reasons: string[] = [];

    if (isTestAuthor(article)) {
      reasons.push(`Test author: "${article.author}"`);
    }

    if (hasTestTitle(article)) {
      reasons.push(`Generic/test title pattern`);
    }

    if (hasPlaceholderContent(article)) {
      reasons.push(`Placeholder content detected`);
    }

    if (hasShortContent(article)) {
      reasons.push(`Suspiciously short content (${article.content.length} chars)`);
    }

    if (isExactMidnight(article)) {
      reasons.push(`Published exactly at midnight (00:00:00.000Z)`);
    }

    if (hasTestSource(article)) {
      reasons.push(`Test source: "${article.source}"`);
    }

    if (reasons.length > 0) {
      testArticlesMap.set(article.id, { article, reasons });
    }

    // Group by title for duplicate detection
    const titleKey = article.title.toLowerCase().trim();
    if (!duplicateGroups.has(titleKey)) {
      duplicateGroups.set(titleKey, []);
    }
    duplicateGroups.get(titleKey)!.push(article);
  });

  // Second pass: detect duplicates
  duplicateGroups.forEach((group, title) => {
    if (group.length > 1) {
      // Sort by published date (oldest first)
      const sorted = group.sort((a, b) =>
        new Date(a.publishedDate).getTime() - new Date(b.publishedDate).getTime()
      );

      // Mark all but the first as duplicates
      sorted.slice(1).forEach(article => {
        const existing = testArticlesMap.get(article.id);
        const reason = `Duplicate title (${group.length} copies, keeping oldest from ${sorted[0].publishedDate.toISOString().split('T')[0]})`;

        if (existing) {
          existing.reasons.push(reason);
        } else {
          testArticlesMap.set(article.id, {
            article,
            reasons: [reason]
          });
        }
      });
    }
  });

  const testArticles = Array.from(testArticlesMap.values());
  const testArticleIds = new Set(testArticles.map(t => t.article.id));
  const legitimateArticles = allArticles.filter(a => !testArticleIds.has(a.id));

  return { testArticles, legitimateArticles, duplicateGroups };
}

/**
 * Display analysis results
 */
function displayAnalysis(
  testArticles: TestArticle[],
  legitimateArticles: Article[],
  totalArticles: number
) {
  console.log('\n🔍 ENHANCED TEST ARTICLE CLEANUP');
  console.log('═'.repeat(80));

  console.log('\n📊 Analysis Results:');
  console.log(`   Total articles: ${totalArticles}`);
  console.log(`   Test articles to delete: ${testArticles.length}`);
  console.log(`   Legitimate articles to keep: ${legitimateArticles.length}`);

  // Group by reason type
  const byTestAuthor = testArticles.filter(t =>
    t.reasons.some(r => r.includes('Test author'))
  );
  const byGenericTitle = testArticles.filter(t =>
    t.reasons.some(r => r.includes('Generic/test title'))
  );
  const byDuplicate = testArticles.filter(t =>
    t.reasons.some(r => r.includes('Duplicate'))
  );
  const byPlaceholder = testArticles.filter(t =>
    t.reasons.some(r => r.includes('Placeholder'))
  );
  const byShortContent = testArticles.filter(t =>
    t.reasons.some(r => r.includes('short content'))
  );
  const byMidnight = testArticles.filter(t =>
    t.reasons.some(r => r.includes('midnight'))
  );
  const byTestSource = testArticles.filter(t =>
    t.reasons.some(r => r.includes('Test source'))
  );

  console.log('\n   Test articles by criteria:');
  if (byTestAuthor.length > 0) {
    console.log(`     - Test authors: ${byTestAuthor.length}`);
  }
  if (byGenericTitle.length > 0) {
    console.log(`     - Generic/test titles: ${byGenericTitle.length}`);
  }
  if (byDuplicate.length > 0) {
    console.log(`     - Duplicate content: ${byDuplicate.length}`);
  }
  if (byPlaceholder.length > 0) {
    console.log(`     - Placeholder content: ${byPlaceholder.length}`);
  }
  if (byShortContent.length > 0) {
    console.log(`     - Short content: ${byShortContent.length}`);
  }
  if (byMidnight.length > 0) {
    console.log(`     - Midnight timestamps: ${byMidnight.length}`);
  }
  if (byTestSource.length > 0) {
    console.log(`     - Test sources: ${byTestSource.length}`);
  }

  // Show detailed list of test articles
  console.log('\n📋 Articles to Delete:');
  console.log('─'.repeat(80));

  testArticles.forEach((testArticle, index) => {
    const { article, reasons } = testArticle;
    console.log(`\n${index + 1}. "${article.title}"`);
    console.log(`   Author: ${article.author || 'Unknown'}`);
    console.log(`   Published: ${article.publishedDate.toISOString().split('T')[0]}`);
    console.log(`   Source: ${article.source || 'Unknown'}`);
    console.log(`   Content length: ${article.content.length} chars`);
    console.log(`   Reasons:`);
    reasons.forEach(reason => {
      console.log(`     • ${reason}`);
    });
  });

  // Show legitimate articles that will be kept
  if (legitimateArticles.length > 0) {
    console.log('\n✅ Legitimate Articles to Keep:');
    console.log('─'.repeat(80));

    legitimateArticles.forEach((article, index) => {
      console.log(`\n${index + 1}. "${article.title}"`);
      console.log(`   Author: ${article.author || 'Unknown'}`);
      console.log(`   Published: ${article.publishedDate.toISOString().split('T')[0]}`);
      console.log(`   Source: ${article.source || 'Unknown'}`);
      console.log(`   Content length: ${article.content.length} chars`);
    });
  }
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
 * Delete test articles and their related data
 */
async function deleteTestArticles(testArticles: TestArticle[]): Promise<number> {
  const db = getDb();
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  let deletedCount = 0;

  for (const { article } of testArticles) {
    try {
      // Delete article (cascade will handle related data)
      await db.delete(articles)
        .where(eq(articles.id, article.id));

      deletedCount++;
      console.log(`   ✓ Deleted: "${article.title}"`);
    } catch (error) {
      console.error(`   ✗ Failed to delete "${article.title}":`, error);
    }
  }

  return deletedCount;
}

/**
 * Verify cleanup results
 */
async function verifyCleanup() {
  const db = getDb();
  if (!db) {
    throw new Error('Failed to connect to database');
  }

  const remaining = await db.select().from(articles);

  console.log('\n✅ Cleanup Complete!');
  console.log(`   Articles remaining: ${remaining.length}`);

  if (remaining.length > 0) {
    console.log('\n📚 Sample of Remaining Articles:');
    remaining.slice(0, 10).forEach((article, index) => {
      console.log(`   ${index + 1}. "${article.title}"`);
      console.log(`      Author: ${article.author || 'Unknown'}`);
      console.log(`      Published: ${article.publishedDate.toISOString().split('T')[0]}`);
    });

    if (remaining.length > 10) {
      console.log(`   ... and ${remaining.length - 10} more`);
    }
  }

  // Create audit log
  const auditLog = {
    timestamp: new Date().toISOString(),
    remainingArticles: remaining.length,
    articles: remaining.map(a => ({
      id: a.id,
      title: a.title,
      author: a.author,
      publishedDate: a.publishedDate
    }))
  };

  const fs = await import('fs').then(m => m.promises);
  await fs.writeFile(
    '/Users/masa/Projects/managed/aipowerranking/cleanup-audit.json',
    JSON.stringify(auditLog, null, 2)
  );

  console.log('\n📄 Audit log saved to: cleanup-audit.json');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Loading articles from database...');

    // Get database connection
    const db = getDb();
    if (!db) {
      throw new Error('Failed to connect to database');
    }

    // Load all articles
    const allArticles = await db.select().from(articles);
    console.log(`   Found ${allArticles.length} articles`);

    if (allArticles.length === 0) {
      console.log('\n✅ No articles found. Database is clean.');
      return;
    }

    // Detect test articles
    console.log('\n🔎 Analyzing articles for test patterns...');
    const { testArticles, legitimateArticles, duplicateGroups } =
      detectTestArticles(allArticles);

    // Display analysis
    displayAnalysis(testArticles, legitimateArticles, allArticles.length);

    if (testArticles.length === 0) {
      console.log('\n✅ No test articles detected. Database is clean!');
      return;
    }

    // Prompt for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete the test articles listed above.');
    const confirmed = await promptConfirmation('\nProceed with deletion? (yes/no): ');

    if (!confirmed) {
      console.log('\n❌ Cleanup cancelled by user.');
      return;
    }

    // Perform deletion
    console.log('\n🗑️  Deleting test articles...');
    const deletedCount = await deleteTestArticles(testArticles);

    console.log(`\n✓ Successfully deleted ${deletedCount} of ${testArticles.length} test articles`);

    // Verify results
    await verifyCleanup();

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n✅ Cleanup script completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
