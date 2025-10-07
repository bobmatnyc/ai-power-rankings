#!/usr/bin/env tsx

import { getDb } from "../lib/db/connection";
import { articles, articleRankingsChanges } from "../lib/db/article-schema";
import { sql, count, inArray } from "drizzle-orm";

async function main() {
  const db = getDb();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("       ARTICLE DELETION ANALYSIS - FULL REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Total articles count
  const totalResult = await db.select({ count: count() }).from(articles);
  const totalArticles = totalResult[0].count;
  console.log(`📊 Total articles in database: ${totalArticles}\n`);

  // 2. Articles with empty tool_mentions
  const emptyToolMentionsResult = await db
    .select({ count: count() })
    .from(articles)
    .where(sql`${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL`);
  const emptyToolMentionsCount = emptyToolMentionsResult[0].count;

  console.log(`🔍 Articles with 0 tool mentions: ${emptyToolMentionsCount}`);

  // Get sample of articles with empty tool mentions
  const emptySample = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      author: articles.author,
      publishedDate: articles.publishedDate,
      sourceName: articles.sourceName,
    })
    .from(articles)
    .where(sql`${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL`)
    .limit(5);

  console.log("\n   Sample articles with 0 tool mentions:");
  emptySample.forEach((article, i) => {
    console.log(`   ${i + 1}. "${article.title}"`);
    console.log(`      Slug: ${article.slug}`);
    console.log(`      Author: ${article.author || 'Unknown'}`);
    console.log(`      Source: ${article.sourceName || 'Unknown'}`);
    console.log(`      Published: ${article.publishedDate?.toISOString().split('T')[0] || 'Unknown'}`);
  });

  // 3. Test articles patterns
  console.log("\n\n🔍 Test articles detection:\n");

  // Test authors
  const testAuthors = [
    'Field Length Test', 'QA Tester', 'Test Reporter', 'AI Reporter',
    'John Doe', 'Jane Doe', 'Test Author', 'Test User', 'Demo Author'
  ];

  const testAuthorConditions = testAuthors.map(author =>
    sql`LOWER(${articles.author}) LIKE LOWER('%' || ${author} || '%')`
  );
  const testAuthorWhere = sql`(${sql.join(testAuthorConditions, sql` OR `)})`;

  const testAuthorResult = await db
    .select({ count: count() })
    .from(articles)
    .where(testAuthorWhere);
  console.log(`   By test authors: ${testAuthorResult[0].count} articles`);

  // Test titles
  const testTitleResult = await db
    .select({ count: count() })
    .from(articles)
    .where(sql`
      ${articles.title} ~* '^(No article|Generic AI|Pre-analyzed|Test Article|Breaking News: Claude Code|GitHub Copilot revolutionizes|Multiple AI Tools|AI Code Assistant|Sample Article|Demo:|\\[TEST\\]|\\[DEMO\\])'
    `);
  console.log(`   By test title patterns: ${testTitleResult[0].count} articles`);

  // Short content
  const shortContentResult = await db
    .select({ count: count() })
    .from(articles)
    .where(sql`LENGTH(${articles.content}) < 500`);
  console.log(`   By short content (<500 chars): ${shortContentResult[0].count} articles`);

  // Duplicate titles
  const duplicatesQuery = await db.execute(sql`
    SELECT COUNT(*) as dup_count
    FROM (
      SELECT LOWER(TRIM(title)) as title_key, COUNT(*) as cnt
      FROM articles
      GROUP BY LOWER(TRIM(title))
      HAVING COUNT(*) > 1
    ) dups
  `);
  const duplicateGroups = duplicatesQuery.rows[0]?.dup_count || 0;
  console.log(`   Duplicate title groups: ${duplicateGroups} groups`);

  // 4. Check known test article IDs from cleanup script
  const knownTestIds = [
    '3b1d9f14-b95f-435e-ac67-f11b13033281',
    '550c2646-b1f5-4e2a-aedb-a9d978746827',
    'dc2f72a3-0232-407d-917e-c3c7a9fef3bd',
    '6574a193-cfc1-421e-b1ce-f67f327ff5c4',
  ];

  const knownTestResult = await db
    .select({ count: count() })
    .from(articles)
    .where(inArray(articles.id, knownTestIds));
  console.log(`   Known test IDs (from cleanup script): ${knownTestResult[0].count} articles\n`);

  // 5. Overlap analysis
  console.log("\n📊 Overlap Analysis:\n");

  const emptyAndTestAuthor = await db
    .select({ count: count() })
    .from(articles)
    .where(sql`
      (${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL)
      AND ${testAuthorWhere}
    `);
  console.log(`   Empty tool_mentions + Test authors: ${emptyAndTestAuthor[0].count}`);

  const emptyAndShortContent = await db
    .select({ count: count() })
    .from(articles)
    .where(sql`
      (${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL)
      AND LENGTH(${articles.content}) < 500
    `);
  console.log(`   Empty tool_mentions + Short content: ${emptyAndShortContent[0].count}`);

  // 6. Foreign key constraints check
  console.log("\n\n🔗 Foreign Key Dependencies:\n");

  const rankingChangesForEmpty = await db
    .select({ count: count() })
    .from(articleRankingsChanges)
    .where(sql`
      ${articleRankingsChanges.articleId} IN (
        SELECT id FROM articles
        WHERE ${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL
      )
    `);
  console.log(`   Ranking changes for empty articles: ${rankingChangesForEmpty[0].count} records`);
  console.log(`   (Will be CASCADE deleted automatically)\n`);

  // 7. Database schema check
  console.log("\n📋 Schema Information:\n");

  const schemaInfo = await db.execute(sql`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'articles'
    AND column_name IN ('id', 'status', 'tool_mentions', 'is_processed')
    ORDER BY ordinal_position
  `);

  console.log("   Articles table key columns:");
  schemaInfo.rows.forEach((col: any) => {
    console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
  });

  // Check for any test-related columns
  const allColumns = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'articles'
    AND (column_name LIKE '%test%' OR column_name LIKE '%demo%')
  `);

  if (allColumns.rows.length > 0) {
    console.log("\n   Test-related columns found:");
    allColumns.rows.forEach((col: any) => {
      console.log(`     - ${col.column_name}`);
    });
  } else {
    console.log("\n   ℹ️  No test-related flag columns (isTest, testFlag, etc.) found");
  }

  // 8. Summary
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("                    DELETION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`📌 PRIMARY DELETION TARGET:`);
  console.log(`   Articles with 0 tool mentions: ${emptyToolMentionsCount}`);
  console.log(`   (These articles have no value for ranking calculations)\n`);

  console.log(`🎯 ADDITIONAL CLEANUP OPPORTUNITIES:`);
  console.log(`   Test articles (by patterns): ~${testAuthorResult[0].count + testTitleResult[0].count} (may overlap)`);
  console.log(`   Short content articles: ${shortContentResult[0].count}`);
  console.log(`   Duplicate title groups: ${duplicateGroups}\n`);

  console.log(`⚠️  IMPACT:`);
  console.log(`   Ranking changes to cascade delete: ${rankingChangesForEmpty[0].count}`);
  console.log(`   Remaining articles after deletion: ${totalArticles - emptyToolMentionsCount}\n`);

  console.log(`✅ EXISTING CLEANUP SCRIPTS:`);
  console.log(`   - scripts/cleanup-test-articles.ts (test pattern detection)`);
  console.log(`   - scripts/cleanup-remaining-test-articles.ts (enhanced detection)`);
  console.log(`   - scripts/check-empty-tool-mentions.ts (empty mentions analysis)\n`);

  console.log(`📝 RECOMMENDED APPROACH:`);
  console.log(`   1. Use SQL query to identify articles with empty tool_mentions`);
  console.log(`   2. Review sample before deletion (dry-run mode)`);
  console.log(`   3. Delete with CASCADE to handle foreign keys automatically`);
  console.log(`   4. Verify remaining article count\n`);

  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
