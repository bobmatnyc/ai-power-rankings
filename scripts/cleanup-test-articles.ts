/**
 * Cleanup Test Articles Script
 * Identifies and removes test articles from the staging database
 *
 * Usage:
 *   tsx scripts/cleanup-test-articles.ts                # Interactive mode with confirmation
 *   tsx scripts/cleanup-test-articles.ts --dry-run      # Preview changes without deletion
 *   tsx scripts/cleanup-test-articles.ts --auto-confirm # Skip confirmation prompt
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { inArray, sql, count } from "drizzle-orm";
import { articles, articleRankingsChanges } from "@/lib/db/article-schema";
import * as readline from "readline";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoConfirm = args.includes('--auto-confirm');

interface TestArticle {
  id: string;
  slug: string;
  title: string;
  publishedDate: Date | null;
  toolMentions: any;
  sourceName: string | null;
  content: string;
}

/**
 * Patterns to identify test articles based on previous research
 */
const TEST_PATTERNS = {
  titles: [
    /test/i,
    /demo/i,
    /sample/i,
    /placeholder/i,
    /^(GPT-5|Claude|AI|OpenAI|Anthropic)\s+(launches|releases|announces)/i, // Generic announcement patterns
    /Show HN:/i, // Hacker News test posts
    /Octofriend/i, // Known test tool
    /^Breaking:/i, // Generic breaking news pattern
  ],
  toolMentions: [
    'test-tool',
    'demo-tool',
    'sample-tool',
  ],
  slugs: [
    /^news-test/i,
    /^news-demo/i,
    /^news-sample/i,
  ],
  // Known test article IDs from previous research
  knownTestIds: [
    '3b1d9f14-b95f-435e-ac67-f11b13033281',
    '550c2646-b1f5-4e2a-aedb-a9d978746827',
    'dc2f72a3-0232-407d-917e-c3c7a9fef3bd',
    '6574a193-cfc1-421e-b1ce-f67f327ff5c4',
    'a64eaff5-3522-4c0f-b474-d90b4836ab2a',
    '3d7dd34a-6108-40f3-82fe-909518058635',
    '6f472fc6-8c6d-4353-933c-73e3e9b433a6',
    'e7d1c357-79b6-4419-94e5-95a6d5d9b936',
    '93ad1818-70c9-4b2a-804a-d563a9fcd19a',
    '475e7950-56f3-4ae7-bfe1-a5d02c46c4f5',
    'b59f197b-639b-4ede-8e35-dc53592d2dc2',
    'd561dd79-4413-474a-9eb3-834bae82dc7b',
    'd9fbeea4-e6bf-42c3-8dc0-7ae84f9d1bd4',
    'ef7d930d-99fa-4c94-ab53-fec77093ee31',
    'd8eca3fa-1d0d-498f-ae4e-1629c703fa4c',
    '9075e195-5cd9-4aae-9f5e-3630f778f774',
  ]
};

/**
 * Check if an article is a test article based on multiple criteria
 */
function isTestArticle(article: TestArticle): { isTest: boolean; reason: string } {
  // Check if in known test IDs
  if (TEST_PATTERNS.knownTestIds.includes(article.id)) {
    return { isTest: true, reason: 'Known test article ID' };
  }

  // Check title patterns
  for (const pattern of TEST_PATTERNS.titles) {
    if (pattern.test(article.title)) {
      return { isTest: true, reason: `Title matches test pattern: ${pattern}` };
    }
  }

  // Check slug patterns
  for (const pattern of TEST_PATTERNS.slugs) {
    if (pattern.test(article.slug)) {
      return { isTest: true, reason: `Slug matches test pattern: ${pattern}` };
    }
  }

  // Check tool mentions
  const toolMentionsArray = Array.isArray(article.toolMentions) ? article.toolMentions : [];
  for (const testTool of TEST_PATTERNS.toolMentions) {
    if (toolMentionsArray.some((tm: any) =>
      typeof tm === 'string'
        ? tm.toLowerCase().includes(testTool.toLowerCase())
        : tm.tool_name?.toLowerCase().includes(testTool.toLowerCase())
    )) {
      return { isTest: true, reason: `Contains test tool mention: ${testTool}` };
    }
  }

  // Check for very short content (likely placeholder)
  if (article.content && article.content.length < 200) {
    return { isTest: true, reason: 'Content too short (< 200 chars)' };
  }

  return { isTest: false, reason: '' };
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
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
 * Main cleanup function
 */
async function cleanupTestArticles() {
  console.log("🧹 TEST ARTICLE CLEANUP SCRIPT");
  console.log("═".repeat(100));

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  try {
    // Step 1: Fetch all articles
    console.log("\n📚 Fetching all articles from database...");
    const allArticles = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        publishedDate: articles.publishedDate,
        toolMentions: articles.toolMentions,
        sourceName: articles.sourceName,
        content: articles.content,
      })
      .from(articles);

    console.log(`   Found ${allArticles.length} total articles`);

    // Step 2: Identify test articles
    console.log("\n🔍 Analyzing articles for test patterns...");
    const testArticles: Array<TestArticle & { reason: string }> = [];
    const legitimateArticles: TestArticle[] = [];

    for (const article of allArticles) {
      const { isTest, reason } = isTestArticle(article);
      if (isTest) {
        testArticles.push({ ...article, reason });
      } else {
        legitimateArticles.push(article);
      }
    }

    console.log(`   ✅ ${legitimateArticles.length} legitimate articles`);
    console.log(`   ❌ ${testArticles.length} test articles identified`);

    if (testArticles.length === 0) {
      console.log("\n✨ No test articles found! Database is clean.");
      return;
    }

    // Step 3: Display test articles
    console.log("\n📋 TEST ARTICLES TO BE DELETED:");
    console.log("─".repeat(100));

    testArticles.forEach((article, index) => {
      const toolMentionsArray = Array.isArray(article.toolMentions) ? article.toolMentions : [];
      const toolNames = toolMentionsArray.map((tm: any) =>
        typeof tm === 'string' ? tm : tm.tool_name || 'unknown'
      ).join(', ');

      console.log(`\n${index + 1}. ${article.title}`);
      console.log(`   ID: ${article.id}`);
      console.log(`   Slug: ${article.slug}`);
      console.log(`   Date: ${article.publishedDate?.toISOString() || 'No date'}`);
      console.log(`   Source: ${article.sourceName || 'Unknown'}`);
      console.log(`   Tool Mentions: ${toolNames || 'None'}`);
      console.log(`   Reason: ${article.reason}`);
    });

    // Step 4: Check for related ranking changes
    console.log("\n\n📊 Checking for related ranking changes...");

    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'article_rankings_changes'
      );
    `);

    let rankingChangesCount = 0;
    if (tableExists.rows[0].exists) {
      const testArticleIds = testArticles.map(a => a.id);
      const changes = await db
        .select({ count: count() })
        .from(articleRankingsChanges)
        .where(inArray(articleRankingsChanges.articleId, testArticleIds));

      rankingChangesCount = changes[0]?.count || 0;
      console.log(`   Found ${rankingChangesCount} ranking changes from test articles`);
    } else {
      console.log(`   No article_rankings_changes table exists`);
    }

    // Step 5: Show summary
    console.log("\n\n📝 DELETION SUMMARY:");
    console.log("─".repeat(100));
    console.log(`   Articles to delete: ${testArticles.length}`);
    console.log(`   Ranking changes to cascade delete: ${rankingChangesCount}`);
    console.log(`   Legitimate articles to preserve: ${legitimateArticles.length}`);

    // Step 6: Dry run exit
    if (isDryRun) {
      console.log("\n✅ DRY RUN COMPLETE - No changes were made");
      console.log("\nTo actually delete these articles, run without --dry-run flag");
      console.log("\n" + "═".repeat(100));
      return;
    }

    // Step 7: Confirmation
    console.log("\n\n⚠️  WARNING: This action will permanently delete the test articles!");
    console.log("   The deletion will CASCADE to related records in article_rankings_changes");

    let confirmed = autoConfirm;
    if (!autoConfirm) {
      confirmed = await askConfirmation(`\nDelete these ${testArticles.length} test articles? (yes/no): `);
    }

    if (!confirmed) {
      console.log("\n❌ Deletion cancelled by user");
      return;
    }

    // Step 8: Perform deletion in transaction
    console.log("\n🗑️  Deleting test articles...");
    const startTime = Date.now();

    await db.transaction(async (tx) => {
      const testArticleIds = testArticles.map(a => a.id);

      // Delete articles (cascade will handle related records)
      const deleted = await tx
        .delete(articles)
        .where(inArray(articles.id, testArticleIds))
        .returning({ id: articles.id });

      console.log(`   ✅ Deleted ${deleted.length} articles`);

      // Log each deleted article
      deleted.forEach((article, index) => {
        const testArticle = testArticles.find(ta => ta.id === article.id);
        console.log(`      ${index + 1}. ${testArticle?.title || article.id}`);
      });
    });

    const duration = Date.now() - startTime;

    // Step 9: Verify deletion
    console.log("\n✅ Deletion completed successfully!");
    console.log(`   Duration: ${duration}ms`);

    // Verify the count
    const remainingCount = await db
      .select({ count: count() })
      .from(articles);

    console.log(`   Remaining articles in database: ${remainingCount[0].count}`);

    // Step 10: Audit log
    console.log("\n📋 DELETION AUDIT LOG:");
    console.log("─".repeat(100));
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Articles deleted: ${testArticles.length}`);
    console.log(`   Ranking changes removed: ${rankingChangesCount} (cascade)`);
    console.log(`   Remaining articles: ${remainingCount[0].count}`);

    console.log("\n\n" + "═".repeat(100));
    console.log("✨ CLEANUP COMPLETE!");

  } catch (error) {
    console.error("\n❌ ERROR during cleanup:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack?.substring(0, 500));
    }
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
cleanupTestArticles().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
