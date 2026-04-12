#!/usr/bin/env npx tsx

/**
 * Duplicate Articles Investigation Script
 *
 * OBJECTIVE: Comprehensive QA investigation into the duplicate articles issue
 *
 * This script performs a systematic analysis to:
 * 1. Identify duplicate articles by URL and title
 * 2. Assess the scope of the duplication problem
 * 3. Analyze root cause patterns
 * 4. Provide detailed remediation recommendations
 */

import { getDb } from './lib/db/connection';
import { articles } from './lib/db/article-schema';
import { eq, sql, desc, count, and, isNotNull } from 'drizzle-orm';

interface DuplicateAnalysis {
  totalArticles: number;
  duplicateUrls: Array<{
    url: string;
    count: number;
    articleIds: string[];
    titles: string[];
    createdDates: string[];
    discoverySources: string[];
    ingestionTypes: string[];
  }>;
  duplicateTitles: Array<{
    title: string;
    count: number;
    articleIds: string[];
    urls: string[];
    createdDates: string[];
    discoverySources: string[];
  }>;
  recentArticles: Array<{
    id: string;
    title: string;
    url: string;
    createdAt: string;
    discoverySource: string;
    ingestionType: string;
  }>;
  timePatternAnalysis: {
    duplicatesLast24h: number;
    duplicatesLast7days: number;
    duplicatesLast30days: number;
  };
  discoverySourceBreakdown: Record<string, number>;
}

async function investigateDuplicates(): Promise<DuplicateAnalysis> {
  const db = getDb();
  if (!db) {
    throw new Error('Database connection not available');
  }

  console.log('🔍 Starting duplicate articles investigation...\n');

  // 1. Get total article count
  console.log('1. Analyzing total article count...');
  const totalCountResult = await db.select({ count: count() }).from(articles);
  const totalArticles = totalCountResult[0]?.count || 0;
  console.log(`   Total articles in database: ${totalArticles}\n`);

  // 2. Find duplicate URLs
  console.log('2. Identifying duplicate URLs...');
  const duplicateUrlsQuery = await db.execute(sql`
    SELECT
      source_url,
      COUNT(*) as count,
      array_agg(id::text) as article_ids,
      array_agg(title) as titles,
      array_agg(created_at::text) as created_dates,
      array_agg(discovery_source) as discovery_sources,
      array_agg(ingestion_type) as ingestion_types
    FROM articles
    WHERE source_url IS NOT NULL AND source_url != ''
    GROUP BY source_url
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  const duplicateUrls = duplicateUrlsQuery.rows.map((row: any) => ({
    url: row.source_url as string,
    count: row.count as number,
    articleIds: row.article_ids as string[],
    titles: row.titles as string[],
    createdDates: row.created_dates as string[],
    discoverySources: row.discovery_sources as string[],
    ingestionTypes: row.ingestion_types as string[],
  }));

  console.log(`   Found ${duplicateUrls.length} URLs with duplicates`);

  // Show top 5 most duplicated URLs
  duplicateUrls.slice(0, 5).forEach((dup, index) => {
    console.log(`   ${index + 1}. ${dup.url} (${dup.count} copies)`);
  });
  console.log();

  // 3. Find duplicate titles
  console.log('3. Identifying duplicate titles...');
  const duplicateTitlesQuery = await db.execute(sql`
    SELECT
      title,
      COUNT(*) as count,
      array_agg(id::text) as article_ids,
      array_agg(source_url) as urls,
      array_agg(created_at::text) as created_dates,
      array_agg(discovery_source) as discovery_sources
    FROM articles
    WHERE title IS NOT NULL AND title != ''
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  const duplicateTitles = duplicateTitlesQuery.rows.map((row: any) => ({
    title: row.title as string,
    count: row.count as number,
    articleIds: row.article_ids as string[],
    urls: row.urls as string[],
    createdDates: row.created_dates as string[],
    discoverySources: row.discovery_sources as string[],
  }));

  console.log(`   Found ${duplicateTitles.length} titles with duplicates`);

  // Show top 5 most duplicated titles
  duplicateTitles.slice(0, 5).forEach((dup, index) => {
    const truncatedTitle = dup.title.length > 80 ? dup.title.substring(0, 80) + '...' : dup.title;
    console.log(`   ${index + 1}. "${truncatedTitle}" (${dup.count} copies)`);
  });
  console.log();

  // 4. Get recent articles (last 10)
  console.log('4. Analyzing most recent articles...');
  const recentArticlesResult = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.sourceUrl,
      createdAt: articles.createdAt,
      discoverySource: articles.discoverySource,
      ingestionType: articles.ingestionType,
    })
    .from(articles)
    .orderBy(desc(articles.createdAt))
    .limit(10);

  const recentArticles = recentArticlesResult.map(article => ({
    id: article.id,
    title: article.title,
    url: article.url || 'No URL',
    createdAt: article.createdAt?.toISOString() || 'Unknown',
    discoverySource: article.discoverySource || 'Unknown',
    ingestionType: article.ingestionType,
  }));

  console.log('   Last 10 articles:');
  recentArticles.forEach((article, index) => {
    const truncatedTitle = article.title.length > 60 ? article.title.substring(0, 60) + '...' : article.title;
    console.log(`   ${index + 1}. "${truncatedTitle}"`);
    console.log(`      Source: ${article.discoverySource} | Type: ${article.ingestionType}`);
    console.log(`      Created: ${article.createdAt}`);
    console.log();
  });

  // 5. Time pattern analysis for duplicates
  console.log('5. Analyzing temporal patterns of duplicates...');

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Count duplicates in different time periods
  const duplicatesLast24hQuery = await db.execute(sql`
    WITH duplicate_urls AS (
      SELECT source_url
      FROM articles
      WHERE source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
    )
    SELECT COUNT(*) as count
    FROM articles a
    JOIN duplicate_urls d ON a.source_url = d.source_url
    WHERE a.created_at >= ${last24h.toISOString()}
  `);

  const duplicatesLast7daysQuery = await db.execute(sql`
    WITH duplicate_urls AS (
      SELECT source_url
      FROM articles
      WHERE source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
    )
    SELECT COUNT(*) as count
    FROM articles a
    JOIN duplicate_urls d ON a.source_url = d.source_url
    WHERE a.created_at >= ${last7days.toISOString()}
  `);

  const duplicatesLast30daysQuery = await db.execute(sql`
    WITH duplicate_urls AS (
      SELECT source_url
      FROM articles
      WHERE source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
    )
    SELECT COUNT(*) as count
    FROM articles a
    JOIN duplicate_urls d ON a.source_url = d.source_url
    WHERE a.created_at >= ${last30days.toISOString()}
  `);

  const timePatternAnalysis = {
    duplicatesLast24h: duplicatesLast24hQuery.rows[0]?.count as number || 0,
    duplicatesLast7days: duplicatesLast7daysQuery.rows[0]?.count as number || 0,
    duplicatesLast30days: duplicatesLast30daysQuery.rows[0]?.count as number || 0,
  };

  console.log(`   Duplicates in last 24h: ${timePatternAnalysis.duplicatesLast24h}`);
  console.log(`   Duplicates in last 7 days: ${timePatternAnalysis.duplicatesLast7days}`);
  console.log(`   Duplicates in last 30 days: ${timePatternAnalysis.duplicatesLast30days}\n`);

  // 6. Discovery source breakdown
  console.log('6. Analyzing discovery source patterns...');
  const discoverySourceQuery = await db.execute(sql`
    SELECT
      discovery_source,
      COUNT(*) as count
    FROM articles
    GROUP BY discovery_source
    ORDER BY COUNT(*) DESC
  `);

  const discoverySourceBreakdown: Record<string, number> = {};
  discoverySourceQuery.rows.forEach((row: any) => {
    const source = (row.discovery_source as string) || 'unknown';
    discoverySourceBreakdown[source] = row.count as number;
  });

  console.log('   Discovery source breakdown:');
  Object.entries(discoverySourceBreakdown).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} articles`);
  });
  console.log();

  return {
    totalArticles,
    duplicateUrls,
    duplicateTitles,
    recentArticles,
    timePatternAnalysis,
    discoverySourceBreakdown,
  };
}

async function analyzeRootCause(analysis: DuplicateAnalysis): Promise<void> {
  console.log('🔬 ROOT CAUSE ANALYSIS\n');

  // Analyze patterns in duplicate creation
  console.log('1. Duplicate Creation Patterns:');

  // Check if duplicates have different timestamps (indicating race conditions)
  const urlsWithTimeGaps = analysis.duplicateUrls.filter(dup => {
    if (dup.createdDates.length < 2) return false;

    const dates = dup.createdDates.map(d => new Date(d).getTime()).sort();
    const timeDiffs = [];
    for (let i = 1; i < dates.length; i++) {
      timeDiffs.push(dates[i] - dates[i-1]);
    }

    // If any duplicates were created within 1 minute of each other, likely race condition
    return timeDiffs.some(diff => diff < 60 * 1000);
  });

  console.log(`   URLs with potential race condition duplicates: ${urlsWithTimeGaps.length}`);

  // Check discovery source patterns
  const sourcePatterns: Record<string, number> = {};
  analysis.duplicateUrls.forEach(dup => {
    dup.discoverySources.forEach(source => {
      sourcePatterns[source] = (sourcePatterns[source] || 0) + 1;
    });
  });

  console.log('   Discovery sources creating duplicates:');
  Object.entries(sourcePatterns).forEach(([source, count]) => {
    console.log(`     ${source}: ${count} duplicate instances`);
  });

  // Check ingestion type patterns
  const ingestionPatterns: Record<string, number> = {};
  analysis.duplicateUrls.forEach(dup => {
    dup.ingestionTypes.forEach(type => {
      ingestionPatterns[type] = (ingestionPatterns[type] || 0) + 1;
    });
  });

  console.log('   Ingestion types creating duplicates:');
  Object.entries(ingestionPatterns).forEach(([type, count]) => {
    console.log(`     ${type}: ${count} duplicate instances`);
  });
  console.log();

  // Check if recent articles (last 4) are duplicates
  console.log('2. Recent Articles Duplication Status:');
  const recentUrls = analysis.recentArticles.slice(0, 4).map(a => a.url).filter(url => url !== 'No URL');
  const recentDuplicates = analysis.duplicateUrls.filter(dup => recentUrls.includes(dup.url));

  console.log(`   Last 4 articles: ${analysis.recentArticles.slice(0, 4).length}`);
  console.log(`   URLs found in duplicate list: ${recentDuplicates.length}`);

  if (recentDuplicates.length > 0) {
    console.log('   CONFIRMED: Recent articles contain duplicates');
    recentDuplicates.forEach((dup, index) => {
      console.log(`     ${index + 1}. ${dup.url} (${dup.count} total copies)`);
    });
  } else {
    console.log('   Recent articles appear to be unique');
  }
  console.log();
}

async function generateReport(analysis: DuplicateAnalysis): Promise<void> {
  console.log('📊 QUALITY ASSURANCE INVESTIGATION REPORT\n');
  console.log('='*60 + '\n');

  // Executive Summary
  console.log('EXECUTIVE SUMMARY:');
  const totalDuplicateArticles = analysis.duplicateUrls.reduce((sum, dup) => sum + dup.count, 0);
  const uniqueUrls = analysis.duplicateUrls.length;
  const excessArticles = totalDuplicateArticles - uniqueUrls; // Subtract 1 original per URL

  console.log(`• Total articles in database: ${analysis.totalArticles}`);
  console.log(`• Unique URLs with duplicates: ${uniqueUrls}`);
  console.log(`• Total duplicate article instances: ${totalDuplicateArticles}`);
  console.log(`• Excess articles (need cleanup): ${excessArticles}`);
  console.log(`• Database bloat: ${((excessArticles / analysis.totalArticles) * 100).toFixed(1)}%`);
  console.log();

  // Risk Assessment
  console.log('RISK ASSESSMENT:');
  let riskLevel = '🟢 LOW';
  if (excessArticles > 50) riskLevel = '🟡 MEDIUM';
  if (excessArticles > 100) riskLevel = '🔴 HIGH';
  if (excessArticles > 200) riskLevel = '🚨 CRITICAL';

  console.log(`• Overall Risk Level: ${riskLevel}`);
  console.log(`• Database Performance Impact: ${excessArticles > 100 ? 'SIGNIFICANT' : 'MINIMAL'}`);
  console.log(`• User Experience Impact: ${analysis.duplicateUrls.length > 10 ? 'VISIBLE' : 'HIDDEN'}`);
  console.log(`• Data Integrity Impact: ${analysis.duplicateTitles.length > 5 ? 'DEGRADED' : 'INTACT'}`);
  console.log();

  // Worst Offenders
  console.log('WORST OFFENDERS (Most Duplicated):');
  const topDuplicates = analysis.duplicateUrls.slice(0, 10);
  topDuplicates.forEach((dup, index) => {
    const truncatedUrl = dup.url.length > 80 ? dup.url.substring(0, 80) + '...' : dup.url;
    console.log(`${index + 1}. ${truncatedUrl}`);
    console.log(`   Copies: ${dup.count} | Sources: ${[...new Set(dup.discoverySources)].join(', ')}`);
  });
  console.log();

  // Recommended Actions
  console.log('RECOMMENDED ACTIONS:');
  console.log('1. IMMEDIATE (< 1 hour):');
  if (excessArticles > 0) {
    console.log(`   • Review and cleanup ${excessArticles} duplicate articles`);
    console.log(`   • Preserve the earliest created article for each URL`);
  } else {
    console.log('   • No immediate cleanup required');
  }
  console.log();

  console.log('2. SHORT TERM (< 1 day):');
  console.log('   • Implement URL normalization before storage');
  console.log('   • Add unique constraint on source_url column');
  console.log('   • Review ingestion process for duplicate prevention');
  console.log();

  console.log('3. LONG TERM (< 1 week):');
  console.log('   • Add database-level duplicate detection');
  console.log('   • Implement content similarity checking');
  console.log('   • Add monitoring for duplicate creation');
  console.log();

  // SQL Cleanup Commands
  if (excessArticles > 0) {
    console.log('SQL CLEANUP COMMANDS:');
    console.log('-- WARNING: Test in development first!');
    console.log('-- Backup database before running these commands');
    console.log();
    console.log('-- 1. Identify duplicates to delete (keep earliest per URL)');
    console.log(`WITH duplicates_to_delete AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
    FROM articles
    WHERE source_url IS NOT NULL
  ) ranked
  WHERE rn > 1
)
SELECT COUNT(*) as articles_to_delete FROM duplicates_to_delete;`);
    console.log();
    console.log('-- 2. Delete duplicates (DANGEROUS - backup first!)');
    console.log(`-- DELETE FROM articles WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
--     FROM articles
--     WHERE source_url IS NOT NULL
--   ) ranked
--   WHERE rn > 1
-- );`);
    console.log();
  }

  // Prevention Measures
  console.log('PREVENTION MEASURES:');
  console.log('1. Database Schema:');
  console.log('   • Add unique constraint: UNIQUE(source_url)');
  console.log('   • Add partial unique index for URL normalization');
  console.log();
  console.log('2. Application Logic:');
  console.log('   • Implement URL canonicalization');
  console.log('   • Add duplicate check before insert');
  console.log('   • Use INSERT ... ON CONFLICT DO NOTHING');
  console.log();
  console.log('3. Monitoring:');
  console.log('   • Daily duplicate detection reports');
  console.log('   • Alert on high duplicate rates');
  console.log('   • Track ingestion source effectiveness');
  console.log();
}

async function main() {
  try {
    console.log('🚀 DUPLICATE ARTICLES QA INVESTIGATION');
    console.log('=====================================\n');

    const analysis = await investigateDuplicates();
    await analyzeRootCause(analysis);
    await generateReport(analysis);

    console.log('✅ Investigation completed successfully');
    console.log('\nNext steps:');
    console.log('1. Review the findings above');
    console.log('2. Backup database before any cleanup');
    console.log('3. Test cleanup commands in development first');
    console.log('4. Implement prevention measures');

  } catch (error) {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
