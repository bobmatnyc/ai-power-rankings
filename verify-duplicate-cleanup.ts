#!/usr/bin/env npx tsx

/**
 * Verification Script for Duplicate Cleanup
 * Shows exactly which articles would be deleted and which would be kept
 */

import { getDb } from './lib/db/connection';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  if (!db) {
    throw new Error('Database connection not available');
  }

  console.log('🔍 DUPLICATE CLEANUP VERIFICATION\n');

  // Get the duplicates that would be deleted (keep earliest per URL)
  const duplicatesToDelete = await db.execute(sql`
    WITH ranked_articles AS (
      SELECT id, source_url, title, created_at,
             ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
      FROM articles
      WHERE source_url IS NOT NULL
    )
    SELECT
      id, source_url, title, created_at,
      rn as rank_within_url
    FROM ranked_articles
    WHERE rn > 1
    ORDER BY source_url, created_at
  `);

  const duplicatesToKeep = await db.execute(sql`
    WITH ranked_articles AS (
      SELECT id, source_url, title, created_at,
             ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
      FROM articles
      WHERE source_url IS NOT NULL
    )
    SELECT
      id, source_url, title, created_at,
      rn as rank_within_url
    FROM ranked_articles
    WHERE rn = 1
    AND source_url IN (
      SELECT source_url
      FROM articles
      WHERE source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
    )
    ORDER BY source_url
  `);

  console.log(`📋 CLEANUP SUMMARY:`);
  console.log(`• Articles to DELETE: ${duplicatesToDelete.rows.length}`);
  console.log(`• Articles to KEEP: ${duplicatesToKeep.rows.length}`);
  console.log(`• URLs affected: ${duplicatesToKeep.rows.length}`);

  console.log(`\n🗑️  ARTICLES TO BE DELETED (keeping earliest for each URL):`);

  let currentUrl = '';
  duplicatesToDelete.rows.forEach((row: any, index) => {
    const url = row.source_url;
    const title = row.title;
    const created = new Date(row.created_at).toISOString();

    if (url !== currentUrl) {
      if (currentUrl !== '') console.log(); // Add spacing between URLs
      console.log(`\n📄 URL: ${url}`);
      currentUrl = url;
    }

    console.log(`   ${index + 1}. DELETE: "${title.substring(0, 70)}..."`);
    console.log(`      Created: ${created}`);
  });

  console.log(`\n\n✅ ARTICLES TO BE KEPT (earliest for each URL):`);
  duplicatesToKeep.rows.forEach((row: any, index) => {
    const url = row.source_url;
    const title = row.title;
    const created = new Date(row.created_at).toISOString();

    console.log(`\n${index + 1}. KEEP: "${title.substring(0, 70)}..."`);
    console.log(`   URL: ${url}`);
    console.log(`   Created: ${created}`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('VERIFICATION COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total articles to delete: ${duplicatesToDelete.rows.length}`);
  console.log(`Total articles to keep: ${duplicatesToKeep.rows.length}`);
  console.log(`Net articles removed: ${duplicatesToDelete.rows.length}`);
  console.log(`Database size reduction: ${((duplicatesToDelete.rows.length / (duplicatesToDelete.rows.length + duplicatesToKeep.rows.length)) * 100).toFixed(1)}%`);

  // Verify recent articles
  console.log(`\n🔍 RECENT ARTICLES STATUS:`);
  const recentCheck = await db.execute(sql`
    SELECT id, title, source_url, created_at
    FROM articles
    ORDER BY created_at DESC
    LIMIT 4
  `);

  recentCheck.rows.forEach((row: any, index) => {
    const isToBeDeleted = duplicatesToDelete.rows.some((dup: any) => dup.id === row.id);
    const status = isToBeDeleted ? '❌ WILL BE DELETED' : '✅ WILL BE KEPT';
    console.log(`${index + 1}. ${status}: "${row.title.substring(0, 50)}..."`);
  });

  console.log(`\n⚠️  IMPORTANT:`);
  console.log('1. Backup database before running cleanup');
  console.log('2. Test cleanup in development environment first');
  console.log('3. Verify no critical articles are accidentally deleted');
  console.log('4. Run this verification again after cleanup (should show 0 deletions)');
}

if (require.main === module) {
  main().catch(console.error);
}
