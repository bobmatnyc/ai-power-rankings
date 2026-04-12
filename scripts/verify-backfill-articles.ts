#!/usr/bin/env npx tsx
/**
 * Verify backfill process: Check articles from March 20-27, 2026 with tavily_backfill source
 * This script validates the successful completion of the backfill recovery process
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../lib/db/connection";
import { articles } from "../lib/db/schema";

async function verifyBackfillArticles() {
  console.log("=== BACKFILL VERIFICATION REPORT ===\n");
  console.log("Checking articles from March 20-27, 2026 with tavily_backfill discovery source");
  console.log("This verifies the successful completion of the 9-day gap recovery\n");

  const db = getDb();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }

  try {
    // Define the backfill date range (March 20-27, 2026)
    const startDate = new Date('2026-03-20T00:00:00Z');
    const endDate = new Date('2026-03-28T00:00:00Z'); // Exclusive end date

    console.log("1. BACKFILL ARTICLES COUNT BY DATE");
    console.log("=" .repeat(50));

    // Get articles by date in the backfill range
    const backfillArticlesByDate = await db
      .select({
        date: sql<string>`DATE(published_date) as date`,
        count: sql<number>`count(*)`,
      })
      .from(articles)
      .where(
        and(
          eq(articles.discoverySource, 'tavily_backfill'),
          gte(articles.publishedDate, startDate),
          lte(articles.publishedDate, endDate)
        )
      )
      .groupBy(sql`DATE(published_date)`)
      .orderBy(sql`DATE(published_date)`);

    let totalBackfillArticles = 0;
    for (const day of backfillArticlesByDate) {
      console.log(`   ${day.date}: ${day.count} articles`);
      totalBackfillArticles += Number(day.count);
    }

    console.log(`\n   TOTAL BACKFILLED ARTICLES: ${totalBackfillArticles}`);

    // Expected: 82 articles across 8 days (March 20-27)
    console.log(`   EXPECTED: ~82 articles across 8 days`);
    console.log(`   STATUS: ${totalBackfillArticles >= 70 ? "✅ SUCCESS" : "❌ INSUFFICIENT"}`);

    console.log("\n2. BACKFILL QUALITY VERIFICATION");
    console.log("=" .repeat(50));

    // Check for complete metadata
    const metadataQuality = await db
      .select({
        total: sql<number>`count(*)`,
        withTitles: sql<number>`sum(case when title is not null and title != '' then 1 else 0 end)`,
        withSummaries: sql<number>`sum(case when summary is not null and summary != '' then 1 else 0 end)`,
        withImportanceScores: sql<number>`sum(case when importance_score is not null then 1 else 0 end)`,
        withToolMentions: sql<number>`sum(case when tool_mentions is not null and tool_mentions != '[]' then 1 else 0 end)`,
        activeStatus: sql<number>`sum(case when status = 'active' then 1 else 0 end)`,
      })
      .from(articles)
      .where(
        and(
          eq(articles.discoverySource, 'tavily_backfill'),
          gte(articles.publishedDate, startDate),
          lte(articles.publishedDate, endDate)
        )
      );

    const quality = metadataQuality[0];
    if (quality) {
      console.log(`   Total backfilled articles: ${quality.total}`);
      console.log(`   With titles: ${quality.withTitles}/${quality.total} (${((quality.withTitles/quality.total)*100).toFixed(1)}%)`);
      console.log(`   With summaries: ${quality.withSummaries}/${quality.total} (${((quality.withSummaries/quality.total)*100).toFixed(1)}%)`);
      console.log(`   With importance scores: ${quality.withImportanceScores}/${quality.total} (${((quality.withImportanceScores/quality.total)*100).toFixed(1)}%)`);
      console.log(`   With tool mentions: ${quality.withToolMentions}/${quality.total} (${((quality.withToolMentions/quality.total)*100).toFixed(1)}%)`);
      console.log(`   Active status: ${quality.activeStatus}/${quality.total} (${((quality.activeStatus/quality.total)*100).toFixed(1)}%)`);

      const qualityScore = (Number(quality.withTitles) + Number(quality.withSummaries) + Number(quality.withImportanceScores) + Number(quality.activeStatus)) / (Number(quality.total) * 4) * 100;
      console.log(`   QUALITY SCORE: ${qualityScore.toFixed(1)}% (should be >90%)`);
      console.log(`   QUALITY STATUS: ${qualityScore >= 90 ? "✅ EXCELLENT" : qualityScore >= 75 ? "⚠️ ACCEPTABLE" : "❌ POOR"}`);
    }

    console.log("\n3. DUPLICATE DETECTION");
    console.log("=" .repeat(50));

    // Check for potential duplicates by URL
    const duplicateUrls = await db
      .select({
        sourceUrl: articles.sourceUrl,
        count: sql<number>`count(*)`,
        discoverySource: sql<string>`string_agg(distinct discovery_source, ', ')`,
      })
      .from(articles)
      .where(
        and(
          gte(articles.publishedDate, startDate),
          lte(articles.publishedDate, endDate)
        )
      )
      .groupBy(articles.sourceUrl)
      .having(sql`count(*) > 1`)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    if (duplicateUrls.length === 0) {
      console.log("   ✅ NO DUPLICATES FOUND - Articles are unique by URL");
    } else {
      console.log(`   ⚠️ Found ${duplicateUrls.length} URLs with multiple articles:`);
      for (const dup of duplicateUrls) {
        console.log(`   ${dup.sourceUrl}: ${dup.count} articles (sources: ${dup.discoverySource})`);
      }
    }

    console.log("\n4. SAMPLE BACKFILLED ARTICLES");
    console.log("=" .repeat(50));

    // Get a sample of backfilled articles
    const sampleArticles = await db
      .select({
        title: articles.title,
        sourceName: articles.sourceName,
        publishedDate: articles.publishedDate,
        ingestedAt: articles.ingestedAt,
        importanceScore: articles.importanceScore,
        toolMentions: articles.toolMentions,
        status: articles.status,
      })
      .from(articles)
      .where(
        and(
          eq(articles.discoverySource, 'tavily_backfill'),
          gte(articles.publishedDate, startDate),
          lte(articles.publishedDate, endDate)
        )
      )
      .orderBy(desc(articles.importanceScore), desc(articles.publishedDate))
      .limit(5);

    for (let i = 0; i < sampleArticles.length; i++) {
      const article = sampleArticles[i];
      console.log(`   ${i + 1}. ${article.title?.substring(0, 60)}...`);
      console.log(`      Source: ${article.sourceName || 'Unknown'}`);
      console.log(`      Published: ${article.publishedDate?.toISOString().split('T')[0]}`);
      console.log(`      Ingested: ${article.ingestedAt?.toISOString().split('T')[0]}`);
      console.log(`      Quality Score: ${article.importanceScore || 'N/A'}`);
      let toolCount = 0;
      try {
        if (article.toolMentions && article.toolMentions !== '[]') {
          toolCount = JSON.parse(article.toolMentions).length;
        }
      } catch {
        toolCount = 0; // Handle invalid JSON
      }
      console.log(`      Tool Mentions: ${toolCount} tools`);
      console.log(`      Status: ${article.status}`);
      console.log("");
    }

    console.log("5. CURRENT SYSTEM STATUS");
    console.log("=" .repeat(50));

    // Check recent articles (last 24 hours) to verify ongoing system health
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await db
      .select({
        count: sql<number>`count(*)`,
        sources: sql<string>`string_agg(distinct discovery_source, ', ')`,
      })
      .from(articles)
      .where(gte(articles.ingestedAt, last24Hours));

    const recent = recentArticles[0];
    if (recent) {
      console.log(`   Articles in last 24 hours: ${recent.count}`);
      console.log(`   Discovery sources: ${recent.sources || 'None'}`);
      console.log(`   System Status: ${recent.count >= 1 ? "✅ OPERATIONAL" : "⚠️ NO RECENT ARTICLES"}`);
    }

    console.log("\n6. VERIFICATION SUMMARY");
    console.log("=" .repeat(50));

    const summary = {
      backfillComplete: totalBackfillArticles >= 70,
      qualityAcceptable: quality && ((Number(quality.withTitles) + Number(quality.withSummaries) + Number(quality.withImportanceScores) + Number(quality.activeStatus)) / (Number(quality.total) * 4) * 100) >= 75,
      noDuplicates: duplicateUrls.length === 0,
      systemOperational: recent && Number(recent.count) >= 1,
    };

    console.log(`   ✅ Backfill Complete: ${summary.backfillComplete ? "YES" : "NO"}`);
    console.log(`   ✅ Quality Acceptable: ${summary.qualityAcceptable ? "YES" : "NO"}`);
    console.log(`   ✅ No Duplicates: ${summary.noDuplicates ? "YES" : "NO"}`);
    console.log(`   ✅ System Operational: ${summary.systemOperational ? "YES" : "NO"}`);

    const allChecks = Object.values(summary).every(check => check);
    console.log(`\n   OVERALL STATUS: ${allChecks ? "✅ BACKFILL SUCCESSFUL" : "❌ ISSUES DETECTED"}`);

    if (!allChecks) {
      console.log("\n   RECOMMENDED ACTIONS:");
      if (!summary.backfillComplete) console.log("   - Investigate missing backfill articles");
      if (!summary.qualityAcceptable) console.log("   - Review article quality and metadata");
      if (!summary.noDuplicates) console.log("   - Remove duplicate articles");
      if (!summary.systemOperational) console.log("   - Check cron job and daily ingestion");
    }

  } catch (error) {
    console.error("Error during verification:", error);
    process.exit(1);
  }

  console.log("\n=== VERIFICATION COMPLETE ===");
  process.exit(0);
}

verifyBackfillArticles();
