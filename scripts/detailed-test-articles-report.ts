/**
 * Detailed Test Articles Report
 * Provides granular breakdown of test articles with processing status
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { inArray } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Test article IDs identified in the analysis
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

async function generateDetailedReport() {
  console.log("📋 DETAILED TEST ARTICLES REPORT");
  console.log("═".repeat(100));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  try {
    const testArticles = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        status: articles.status,
        isProcessed: articles.isProcessed,
        processedAt: articles.processedAt,
        createdAt: articles.createdAt,
        ingestedAt: articles.ingestedAt,
        toolMentions: articles.toolMentions,
        companyMentions: articles.companyMentions,
        rankingsSnapshot: articles.rankingsSnapshot,
      })
      .from(articles)
      .where(inArray(articles.id, TEST_ARTICLE_IDS));

    console.log(`\nFound ${testArticles.length} test articles in database\n`);

    // Group by status
    const byStatus = testArticles.reduce((acc, article) => {
      const status = article.status || 'unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(article);
      return acc;
    }, {} as Record<string, typeof testArticles>);

    // Summary statistics
    console.log("📊 STATUS SUMMARY:");
    console.log("─".repeat(100));
    Object.entries(byStatus).forEach(([status, articles]) => {
      const processed = articles.filter(a => a.isProcessed).length;
      const unprocessed = articles.filter(a => !a.isProcessed).length;
      console.log(`  ${status.toUpperCase()}: ${articles.length} total (${processed} processed, ${unprocessed} unprocessed)`);
    });

    // Processing impact analysis
    const processedCount = testArticles.filter(a => a.isProcessed).length;
    const withToolMentions = testArticles.filter(
      a => a.toolMentions && Array.isArray(a.toolMentions) && a.toolMentions.length > 0
    ).length;
    const withRankings = testArticles.filter(a => a.rankingsSnapshot).length;

    console.log("\n⚠️  IMPACT ASSESSMENT:");
    console.log("─".repeat(100));
    console.log(`  Processed articles (may have affected rankings): ${processedCount}/${testArticles.length}`);
    console.log(`  Articles with tool mentions: ${withToolMentions}/${testArticles.length}`);
    console.log(`  Articles with rankings snapshots: ${withRankings}/${testArticles.length}`);

    if (processedCount > 0) {
      console.log("\n  ⚠️  WARNING: These test articles were PROCESSED and may have affected rankings!");
      console.log("  Consider reviewing ranking history for these dates.");
    }

    // Detailed breakdown
    console.log("\n\n📝 DETAILED ARTICLE BREAKDOWN:");
    console.log("═".repeat(100));

    for (const [status, statusArticles] of Object.entries(byStatus)) {
      console.log(`\n${status.toUpperCase()} ARTICLES (${statusArticles.length}):`);
      console.log("─".repeat(100));

      statusArticles.forEach((article, idx) => {
        console.log(`\n${idx + 1}. ${article.title}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Created: ${article.createdAt?.toISOString() || 'N/A'}`);
        console.log(`   Status: ${article.status}`);
        console.log(`   Processed: ${article.isProcessed ? 'YES ⚠️' : 'No'}`);

        if (article.isProcessed && article.processedAt) {
          console.log(`   Processed At: ${article.processedAt.toISOString()}`);
        }

        if (article.toolMentions && Array.isArray(article.toolMentions)) {
          console.log(`   Tool Mentions: ${article.toolMentions.length} tools`);
        }

        if (article.companyMentions && Array.isArray(article.companyMentions)) {
          console.log(`   Company Mentions: ${article.companyMentions.length} companies`);
        }

        if (article.rankingsSnapshot) {
          console.log(`   Rankings Snapshot: Present ⚠️`);
        }
      });
    }

    // Deletion strategy
    console.log("\n\n💡 DELETION STRATEGY:");
    console.log("═".repeat(100));

    const activeTest = byStatus['active'] || [];
    const deletedTest = byStatus['deleted'] || [];
    const archivedTest = byStatus['archived'] || [];

    console.log("\n1. ALREADY DELETED:");
    console.log(`   ${deletedTest.length} articles already marked as deleted`);
    if (deletedTest.length > 0) {
      deletedTest.forEach(a => console.log(`   - ${a.id}: "${a.title}"`));
      console.log("\n   💡 These can be permanently removed with hard delete.");
    }

    console.log("\n2. ACTIVE TEST ARTICLES (Need deletion):");
    console.log(`   ${activeTest.length} articles currently active`);
    if (activeTest.length > 0) {
      const processedActive = activeTest.filter(a => a.isProcessed);
      const unprocessedActive = activeTest.filter(a => !a.isProcessed);

      if (processedActive.length > 0) {
        console.log(`\n   ⚠️  ${processedActive.length} PROCESSED active test articles:`);
        processedActive.forEach(a => {
          console.log(`   - ${a.id}: "${a.title}"`);
          console.log(`     Created: ${a.createdAt?.toISOString()}, Processed: ${a.processedAt?.toISOString()}`);
        });
        console.log("\n   ⚠️  IMPORTANT: These articles were processed and may have created ranking changes.");
        console.log("   Consider checking article_rankings_changes table before deletion.");
      }

      if (unprocessedActive.length > 0) {
        console.log(`\n   ✅ ${unprocessedActive.length} UNPROCESSED active test articles (safe to delete):`);
        unprocessedActive.forEach(a => console.log(`   - ${a.id}: "${a.title}"`));
      }
    }

    if (archivedTest.length > 0) {
      console.log("\n3. ARCHIVED TEST ARTICLES:");
      console.log(`   ${archivedTest.length} articles archived`);
      archivedTest.forEach(a => console.log(`   - ${a.id}: "${a.title}"`));
    }

    // Safe deletion command
    console.log("\n\n🔧 RECOMMENDED DELETION COMMANDS:");
    console.log("═".repeat(100));

    const unprocessedIds = testArticles
      .filter(a => !a.isProcessed)
      .map(a => a.id);

    if (unprocessedIds.length > 0) {
      console.log("\n1. SAFE DELETE (Unprocessed articles - no ranking impact):");
      console.log("   ```sql");
      console.log("   DELETE FROM articles WHERE id IN (");
      unprocessedIds.forEach((id, idx) => {
        console.log(`     '${id}'${idx < unprocessedIds.length - 1 ? ',' : ''}`);
      });
      console.log("   );");
      console.log("   ```");
    }

    const processedIds = testArticles
      .filter(a => a.isProcessed)
      .map(a => a.id);

    if (processedIds.length > 0) {
      console.log("\n2. CAUTIOUS DELETE (Processed articles - may have ranking impact):");
      console.log("   ⚠️  Check article_rankings_changes first!");
      console.log("\n   -- Check impact:");
      console.log("   SELECT article_id, COUNT(*) as changes_count");
      console.log("   FROM article_rankings_changes");
      console.log("   WHERE article_id IN (");
      processedIds.forEach((id, idx) => {
        console.log(`     '${id}'${idx < processedIds.length - 1 ? ',' : ''}`);
      });
      console.log("   )");
      console.log("   GROUP BY article_id;");
      console.log("\n   -- If no rankings changes, safe to delete:");
      console.log("   DELETE FROM articles WHERE id IN (");
      processedIds.forEach((id, idx) => {
        console.log(`     '${id}'${idx < processedIds.length - 1 ? ',' : ''}`);
      });
      console.log("   );");
      console.log("   ```");
    }

    console.log("\n" + "═".repeat(100));
    console.log("✅ Report complete!");
    console.log("═".repeat(100));

  } catch (error) {
    console.error("❌ Error generating report:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

generateDetailedReport().catch(console.error);
