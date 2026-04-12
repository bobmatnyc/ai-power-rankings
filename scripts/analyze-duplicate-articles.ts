/**
 * Analyze duplicate articles in the database
 * Part of duplicate cleanup implementation
 */

import { eq, sql } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";

async function analyzeDuplicates() {
  const db = getDb();

  try {
    console.log("🔍 Analyzing duplicate articles...");

    // Count total articles
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles);

    console.log(`📊 Total articles: ${totalCount[0].count}`);

    // Find duplicates by source_url
    const duplicates = await db
      .select({
        source_url: articles.sourceUrl,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(sql`${articles.sourceUrl} IS NOT NULL`)
      .groupBy(articles.sourceUrl)
      .having(sql`count(*) > 1`)
      .orderBy(sql`count(*) DESC`);

    console.log(`\n🚨 Found ${duplicates.length} URLs with duplicates:`);

    let totalDuplicateArticles = 0;
    for (const dup of duplicates) {
      console.log(`  📄 ${dup.source_url}: ${dup.count} copies`);
      totalDuplicateArticles += dup.count - 1; // -1 because we keep one copy
    }

    console.log(`\n📈 Summary:`);
    console.log(`  - URLs with duplicates: ${duplicates.length}`);
    console.log(`  - Total duplicate articles to remove: ${totalDuplicateArticles}`);
    console.log(`  - Database after cleanup: ${totalCount[0].count - totalDuplicateArticles} articles`);
    console.log(`  - Duplicate percentage: ${((totalDuplicateArticles / totalCount[0].count) * 100).toFixed(1)}%`);

    // Show details for worst duplicates
    console.log(`\n🔍 Detailed analysis for worst duplicates:`);
    for (const dup of duplicates.slice(0, 5)) {
      const articleDetails = await db
        .select({
          id: articles.id,
          title: articles.title,
          createdAt: articles.createdAt,
          ingestedAt: articles.ingestedAt
        })
        .from(articles)
        .where(eq(articles.sourceUrl, dup.source_url!))
        .orderBy(articles.createdAt);

      console.log(`\n  📄 ${dup.source_url} (${dup.count} copies):`);
      articleDetails.forEach((article, index) => {
        const isKeep = index === 0;
        console.log(`    ${isKeep ? '✅ KEEP' : '❌ DELETE'}: ${article.id.slice(0, 8)}... ${article.title?.slice(0, 50)}... (${article.createdAt?.toISOString()})`);
      });
    }

    // Recent articles check
    const recentArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        sourceUrl: articles.sourceUrl,
        createdAt: articles.createdAt
      })
      .from(articles)
      .orderBy(sql`${articles.createdAt} DESC`)
      .limit(10);

    console.log(`\n⏰ Most recent 10 articles (checking for duplicates):`);
    for (const article of recentArticles) {
      if (article.sourceUrl) {
        const count = await db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(eq(articles.sourceUrl, article.sourceUrl));

        const isDuplicate = count[0].count > 1;
        console.log(`  ${isDuplicate ? '🚨 DUP' : '✅ OK '}: ${article.id.slice(0, 8)}... ${article.title?.slice(0, 50)}...`);
      }
    }

  } catch (error) {
    console.error("❌ Error analyzing duplicates:", error);
    process.exit(1);
  }

  process.exit(0);
}

analyzeDuplicates();
