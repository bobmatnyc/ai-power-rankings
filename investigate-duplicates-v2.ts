#!/usr/bin/env npx tsx

/**
 * Fixed Duplicate Articles Investigation Script
 * Addresses the calculation issue and provides accurate duplicate counts
 */

import { getDb } from './lib/db/connection';
import { articles } from './lib/db/article-schema';
import { eq, sql, desc, count, and, isNotNull } from 'drizzle-orm';

async function main() {
  const db = getDb();
  if (!db) {
    throw new Error('Database connection not available');
  }

  console.log('🔍 CORRECTED DUPLICATE ARTICLES INVESTIGATION\n');

  // 1. Get total article count
  const totalCountResult = await db.select({ count: count() }).from(articles);
  const totalArticles = totalCountResult[0]?.count || 0;
  console.log(`Total articles in database: ${totalArticles}\n`);

  // 2. Get most recent 10 articles to check if last 4 are duplicates
  console.log('RECENT ARTICLES ANALYSIS:');
  const recentArticlesResult = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.sourceUrl,
      createdAt: articles.createdAt,
      discoverySource: articles.discoverySource,
    })
    .from(articles)
    .orderBy(desc(articles.createdAt))
    .limit(10);

  console.log('Last 10 articles:');
  recentArticlesResult.forEach((article, index) => {
    const truncatedTitle = article.title.length > 70 ? article.title.substring(0, 70) + '...' : article.title;
    console.log(`${index + 1}. "${truncatedTitle}"`);
    console.log(`   URL: ${article.url || 'No URL'}`);
    console.log(`   Source: ${article.discoverySource} | Created: ${article.createdAt?.toISOString()}\n`);
  });

  // 3. Check for exact URL duplicates
  console.log('DUPLICATE URLs ANALYSIS:');
  const duplicateUrlsQuery = await db.execute(sql`
    SELECT
      source_url,
      COUNT(*) as count,
      array_agg(id::text ORDER BY created_at) as article_ids,
      array_agg(title ORDER BY created_at) as titles,
      array_agg(created_at::text ORDER BY created_at) as created_dates,
      array_agg(discovery_source ORDER BY created_at) as discovery_sources
    FROM articles
    WHERE source_url IS NOT NULL AND source_url != ''
    GROUP BY source_url
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, source_url
  `);

  const duplicateUrls = duplicateUrlsQuery.rows as any[];

  console.log(`Found ${duplicateUrls.length} URLs with duplicates:\n`);

  let totalDuplicateInstances = 0;
  let totalExcessArticles = 0;

  duplicateUrls.slice(0, 10).forEach((row, index) => {
    const url = row.source_url;
    const count = parseInt(row.count);
    const titles = row.titles;
    const dates = row.created_dates;
    const sources = row.discovery_sources;

    totalDuplicateInstances += count;
    totalExcessArticles += (count - 1); // Excess = total - 1 original

    console.log(`${index + 1}. ${url}`);
    console.log(`   Duplicates: ${count} copies`);
    console.log(`   Sources: ${[...new Set(sources)].join(', ')}`);
    console.log(`   First: ${dates[0]} | Last: ${dates[dates.length - 1]}`);

    // Show time gap between first and last
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const timeDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60); // minutes
    console.log(`   Time spread: ${timeDiff.toFixed(1)} minutes\n`);
  });

  // 4. Check if recent 4 articles have duplicates
  console.log('RECENT DUPLICATES VERIFICATION:');
  const last4Articles = recentArticlesResult.slice(0, 4);
  const last4Urls = last4Articles.map(a => a.url).filter(url => url);

  console.log('Checking if last 4 articles are duplicates...');
  let recentDuplicatesFound = 0;

  for (const article of last4Articles) {
    if (!article.url) continue;

    // Count how many times this URL appears
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM articles WHERE source_url = ${article.url}
    `);

    const urlCount = parseInt((countResult.rows[0] as any).count);
    if (urlCount > 1) {
      recentDuplicatesFound++;
      console.log(`✓ DUPLICATE: "${article.title}" appears ${urlCount} times`);
      console.log(`  URL: ${article.url}`);
    }
  }

  if (recentDuplicatesFound === 0) {
    console.log('✓ Last 4 articles appear to be unique (no URL duplicates found)');
  } else {
    console.log(`❌ CONFIRMED: ${recentDuplicatesFound} of last 4 articles are duplicates`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(60));

  console.log(`\n📊 DATABASE STATISTICS:`);
  console.log(`• Total articles: ${totalArticles}`);
  console.log(`• Unique URLs with duplicates: ${duplicateUrls.length}`);
  console.log(`• Total duplicate instances: ${totalDuplicateInstances}`);
  console.log(`• Excess articles needing cleanup: ${totalExcessArticles}`);
  console.log(`• Database bloat percentage: ${((totalExcessArticles / totalArticles) * 100).toFixed(1)}%`);

  console.log(`\n🚨 ISSUE SEVERITY:`);
  let severity = 'LOW';
  if (totalExcessArticles > 20) severity = 'MEDIUM';
  if (totalExcessArticles > 50) severity = 'HIGH';
  if (totalExcessArticles > 100) severity = 'CRITICAL';
  console.log(`• Severity Level: ${severity}`);

  console.log(`\n🔍 ROOT CAUSE ANALYSIS:`);
  // Analyze discovery sources
  const sourceAnalysis: Record<string, number> = {};
  duplicateUrls.forEach((row: any) => {
    const sources = row.discovery_sources;
    sources.forEach((source: string) => {
      sourceAnalysis[source] = (sourceAnalysis[source] || 0) + 1;
    });
  });

  console.log('• Discovery sources creating duplicates:');
  Object.entries(sourceAnalysis).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count} duplicate instances`);
  });

  // Analyze timing patterns
  const raceConditionUrls = duplicateUrls.filter((row: any) => {
    const dates = row.created_dates.map((d: string) => new Date(d).getTime());
    dates.sort();
    for (let i = 1; i < dates.length; i++) {
      if ((dates[i] - dates[i-1]) < 5 * 60 * 1000) { // 5 minutes
        return true;
      }
    }
    return false;
  });

  console.log(`• URLs with potential race conditions: ${raceConditionUrls.length}`);
  console.log(`• Primary cause: ${sourceAnalysis.tavily_backfill ? 'Backfill process' : 'Unknown'}`);

  console.log(`\n💡 RECOMMENDED ACTIONS:`);
  console.log('1. IMMEDIATE:');
  console.log(`   • Backup database`);
  console.log(`   • Remove ${totalExcessArticles} excess duplicate articles`);
  console.log('   • Keep earliest created article for each URL');

  console.log('\n2. SHORT-TERM:');
  console.log('   • Fix backfill process to check for existing URLs');
  console.log('   • Add database constraint: UNIQUE(source_url)');
  console.log('   • Implement URL normalization');

  console.log('\n3. LONG-TERM:');
  console.log('   • Add content similarity detection');
  console.log('   • Implement duplicate monitoring alerts');
  console.log('   • Regular cleanup automation');

  console.log(`\n🛠 SQL COMMANDS FOR CLEANUP:`);
  console.log('-- First, verify what will be deleted:');
  console.log(`WITH duplicates_to_delete AS (
  SELECT id, source_url, title, created_at,
         ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
  FROM articles
  WHERE source_url IS NOT NULL
)
SELECT COUNT(*) as will_delete_count
FROM duplicates_to_delete
WHERE rn > 1;`);

  console.log('\n-- Then delete duplicates (BACKUP FIRST!):');
  console.log(`-- DELETE FROM articles WHERE id IN (
--   SELECT id FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
--     FROM articles
--     WHERE source_url IS NOT NULL
--   ) ranked WHERE rn > 1
-- );`);

  console.log(`\n✅ Investigation completed. Found ${totalExcessArticles} excess articles to clean up.`);
}

if (require.main === module) {
  main().catch(console.error);
}
