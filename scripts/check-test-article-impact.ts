/**
 * Check Test Article Impact on Rankings
 * Analyzes if test articles created ranking changes
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { inArray, sql, count } from "drizzle-orm";
import { articleRankingsChanges } from "@/lib/db/article-schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Test article IDs
const TEST_ARTICLE_IDS = [
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
];

async function checkTestArticleImpact() {
  console.log("🔍 CHECKING TEST ARTICLE RANKING IMPACT");
  console.log("═".repeat(100));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  try {
    // Check if article_rankings_changes table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'article_rankings_changes'
      );
    `);

    console.log("\n📊 Table Status:");
    console.log(`   article_rankings_changes exists: ${tableExists.rows[0].exists}`);

    if (!tableExists.rows[0].exists) {
      console.log("\n✅ GOOD NEWS: article_rankings_changes table does not exist!");
      console.log("   This means test articles have NOT created any ranking changes.");
      console.log("\n💡 RECOMMENDATION: All test articles can be safely deleted.");
      return;
    }

    // Get total count of ranking changes for test articles
    const totalChanges = await db
      .select({ count: count() })
      .from(articleRankingsChanges)
      .where(inArray(articleRankingsChanges.articleId, TEST_ARTICLE_IDS));

    console.log(`\n📈 Total ranking changes from test articles: ${totalChanges[0].count}`);

    if (totalChanges[0].count === 0) {
      console.log("\n✅ EXCELLENT NEWS: No ranking changes found!");
      console.log("   Test articles have NOT affected the rankings.");
      console.log("\n💡 RECOMMENDATION: All test articles can be safely deleted.");
      return;
    }

    // Get detailed breakdown by article
    const changesByArticle = await db
      .select({
        articleId: articleRankingsChanges.articleId,
        changesCount: count(),
      })
      .from(articleRankingsChanges)
      .where(inArray(articleRankingsChanges.articleId, TEST_ARTICLE_IDS))
      .groupBy(articleRankingsChanges.articleId);

    console.log("\n⚠️  WARNING: Ranking changes detected from test articles!");
    console.log("─".repeat(100));

    for (const article of changesByArticle) {
      console.log(`\nArticle ID: ${article.articleId}`);
      console.log(`Ranking changes: ${article.changesCount}`);

      // Get specific changes for this article
      const changes = await db
        .select({
          toolId: articleRankingsChanges.toolId,
          toolName: articleRankingsChanges.toolName,
          changeType: articleRankingsChanges.changeType,
          oldRank: articleRankingsChanges.oldRank,
          newRank: articleRankingsChanges.newRank,
          rankChange: articleRankingsChanges.rankChange,
          scoreChange: articleRankingsChanges.scoreChange,
          isApplied: articleRankingsChanges.isApplied,
          rolledBack: articleRankingsChanges.rolledBack,
          appliedAt: articleRankingsChanges.appliedAt,
        })
        .from(articleRankingsChanges)
        .where(sql`${articleRankingsChanges.articleId} = ${article.articleId}`)
        .limit(10);

      console.log(`\nTop changes:`);
      changes.forEach((change, idx) => {
        console.log(`  ${idx + 1}. ${change.toolName} (${change.toolId})`);
        console.log(`     Type: ${change.changeType}`);
        console.log(`     Rank: ${change.oldRank} → ${change.newRank} (${change.rankChange})`);
        console.log(`     Score change: ${change.scoreChange}`);
        console.log(`     Applied: ${change.isApplied}, Rolled back: ${change.rolledBack}`);
        console.log(`     Applied at: ${change.appliedAt?.toISOString() || 'N/A'}`);
      });
    }

    // Check if any changes are still applied
    const appliedChanges = await db
      .select({ count: count() })
      .from(articleRankingsChanges)
      .where(
        sql`${articleRankingsChanges.articleId} IN (${sql.join(TEST_ARTICLE_IDS.map(id => sql`${id}`), sql`, `)})
        AND ${articleRankingsChanges.isApplied} = true
        AND ${articleRankingsChanges.rolledBack} = false`
      );

    console.log("\n\n📊 IMPACT SUMMARY:");
    console.log("─".repeat(100));
    console.log(`Total ranking changes: ${totalChanges[0].count}`);
    console.log(`Changes still applied: ${appliedChanges[0].count}`);
    console.log(`Changes rolled back: ${totalChanges[0].count - appliedChanges[0].count}`);

    if (appliedChanges[0].count > 0) {
      console.log("\n⚠️  CRITICAL: Some ranking changes are still active!");
      console.log("\n💡 RECOMMENDATIONS:");
      console.log("   1. Rollback these changes before deleting articles");
      console.log("   2. Or accept that historical rankings will have test data impact");
      console.log("\n   To rollback, you can either:");
      console.log("   - Use your rollback functionality if available");
      console.log("   - Mark changes as rolled back and restore previous rankings");
      console.log("   - Delete the articles (cascade will remove changes, but rankings stay)");
    } else {
      console.log("\n✅ All changes have been rolled back!");
      console.log("   Test articles can be safely deleted.");
    }

    console.log("\n" + "═".repeat(100));

  } catch (error) {
    console.error("❌ Error checking impact:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkTestArticleImpact().catch(console.error);
