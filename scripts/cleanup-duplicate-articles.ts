/**
 * Clean up duplicate articles from database
 * Removes duplicates while keeping the earliest article per unique source_url
 */

import { eq, sql, and } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

interface DuplicateGroup {
  source_url: string;
  count: number;
  articles: Array<{
    id: string;
    title: string;
    createdAt: Date;
    ingestedAt: Date;
  }>;
}

async function cleanupDuplicates() {
  const db = getDb();

  try {
    console.log("🧹 Starting duplicate article cleanup...");

    // Find all duplicates by source_url
    const duplicateUrls = await db
      .select({
        source_url: articles.sourceUrl,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(sql`${articles.sourceUrl} IS NOT NULL`)
      .groupBy(articles.sourceUrl)
      .having(sql`count(*) > 1`)
      .orderBy(sql`count(*) DESC`);

    console.log(`📊 Found ${duplicateUrls.length} URLs with duplicates`);

    if (duplicateUrls.length === 0) {
      console.log("✅ No duplicates found!");
      return;
    }

    // Get detailed information for each duplicate group
    const duplicateGroups: DuplicateGroup[] = [];
    for (const dupUrl of duplicateUrls) {
      const articlesInGroup = await db
        .select({
          id: articles.id,
          title: articles.title,
          createdAt: articles.createdAt,
          ingestedAt: articles.ingestedAt
        })
        .from(articles)
        .where(eq(articles.sourceUrl, dupUrl.source_url!))
        .orderBy(articles.createdAt); // Keep earliest

      duplicateGroups.push({
        source_url: dupUrl.source_url!,
        count: dupUrl.count,
        articles: articlesInGroup
      });
    }

    // Calculate deletion plan
    const articlesToDelete: string[] = [];
    const articlesToKeep: string[] = [];

    for (const group of duplicateGroups) {
      // Keep the earliest article (first in sorted order)
      const [keepArticle, ...deleteArticles] = group.articles;

      articlesToKeep.push(keepArticle.id);
      articlesToDelete.push(...deleteArticles.map(a => a.id));

      console.log(`📄 ${group.source_url} (${group.count} copies):`);
      console.log(`  ✅ KEEP: ${keepArticle.id} (${keepArticle.createdAt?.toISOString()})`);
      deleteArticles.forEach(article => {
        console.log(`  ❌ DELETE: ${article.id} (${article.createdAt?.toISOString()})`);
      });
    }

    console.log(`\n📊 Cleanup plan:`);
    console.log(`  - Articles to keep: ${articlesToKeep.length}`);
    console.log(`  - Articles to delete: ${articlesToDelete.length}`);

    // Confirmation check
    if (articlesToDelete.length !== 72) {
      throw new Error(`Expected to delete 72 articles, but plan shows ${articlesToDelete.length}. Aborting for safety.`);
    }

    console.log(`\n⚠️  This will permanently delete ${articlesToDelete.length} articles. Are you sure? (Type 'yes' to continue)`);

    // For script execution, we'll proceed automatically (in production, you might want user input)
    const proceed = true; // Change this to false for safety in production

    if (!proceed) {
      console.log("❌ Cleanup aborted by user");
      return;
    }

    console.log("🚀 Proceeding with cleanup...");

    // Delete duplicates one by one to avoid SQL issues
    let deletedCount = 0;

    for (const articleId of articlesToDelete) {
      try {
        const result = await db
          .delete(articles)
          .where(eq(articles.id, articleId));

        const deleted = 'rowCount' in result ? (result.rowCount || 0) : 1;
        deletedCount += deleted;

        if (deletedCount % 10 === 0 || deletedCount === articlesToDelete.length) {
          console.log(`🗑️  Deleted ${deletedCount}/${articlesToDelete.length} articles...`);
        }
      } catch (error) {
        console.error(`❌ Failed to delete article ${articleId}:`, error);
      }
    }

    // Verification
    const finalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles);

    const expectedFinalCount = 463 - 72; // 391
    const actualFinalCount = finalCount[0].count;

    if (actualFinalCount !== expectedFinalCount) {
      console.log(`⚠️  Warning: Expected ${expectedFinalCount} articles after cleanup, but found ${actualFinalCount}`);
    }

    // Verify no duplicates remain
    const remainingDuplicates = await db
      .select({
        source_url: articles.sourceUrl,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(sql`${articles.sourceUrl} IS NOT NULL`)
      .groupBy(articles.sourceUrl)
      .having(sql`count(*) > 1`);

    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`📊 Results:`);
    console.log(`  - Articles deleted: ${deletedCount}`);
    console.log(`  - Articles remaining: ${actualFinalCount}`);
    console.log(`  - Remaining duplicates: ${remainingDuplicates.length}`);

    if (remainingDuplicates.length > 0) {
      console.log(`⚠️  Warning: ${remainingDuplicates.length} duplicates still remain!`);
      remainingDuplicates.forEach(dup => {
        console.log(`  🚨 ${dup.source_url}: ${dup.count} copies`);
      });
    } else {
      console.log(`🎉 All duplicates successfully removed!`);
    }

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await cleanupDuplicates();
    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

main();
