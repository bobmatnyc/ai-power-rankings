import { db } from './lib/db/connection';
import { tools, rankingVersions, articleRankingsChanges, articles } from './lib/db/schema';
import { eq, gte, sql } from 'drizzle-orm';

async function verify() {
  console.log('=== DATABASE INTEGRITY CHECKS ===\n');

  const allTools = await db.select().from(tools);
  console.log('1. TOOLS TABLE:');
  console.log('  Total tools:', allTools.length);
  
  const withBaseline = allTools.filter(t => t.baselineScore != null);
  console.log('  With baseline_score:', withBaseline.length);
  
  const withDelta = allTools.filter(t => t.deltaScore != null && t.deltaScore != 0);
  console.log('  With non-zero delta_score:', withDelta.length);
  
  let errors = 0;
  for (const tool of allTools) {
    const expected = (tool.baselineScore || 0) + (tool.deltaScore || 0);
    if (Math.abs(expected - (tool.currentScore || 0)) > 0.01) {
      console.log('  ERROR:', tool.name, 'expected:', expected, 'got:', tool.currentScore);
      errors++;
    }
  }
  console.log('  Calculation errors:', errors);
  
  console.log('\n  Tools with Deltas:');
  const sorted = withDelta.sort((a, b) => (b.deltaScore || 0) - (a.deltaScore || 0));
  for (const t of sorted) {
    console.log('   -', t.name, '| baseline:', t.baselineScore, '| delta:', t.deltaScore, '| current:', t.currentScore);
  }

  console.log('\n2. RANKING VERSIONS:');
  const baseline = await db.select().from(rankingVersions).where(eq(rankingVersions.versionName, 'baseline-may-2025'));
  if (baseline.length > 0) {
    const snap = baseline[0].rankingsSnapshot;
    console.log('  Baseline snapshot: FOUND');
    console.log('  Date:', baseline[0].snapshotDate);
    console.log('  Tools in snapshot:', Array.isArray(snap) ? snap.length : 0);
    if (Array.isArray(snap) && snap.length > 0) {
      console.log('\n  Sample entries:');
      for (let i = 0; i < Math.min(5, snap.length); i++) {
        console.log('   -', snap[i].name, '| score:', snap[i].score, '| rank:', snap[i].rank);
      }
    }
  } else {
    console.log('  ERROR: No baseline snapshot');
  }

  console.log('\n3. RANKING CHANGES:');
  const changes = await db.select({ count: sql`count(*)` }).from(articleRankingsChanges);
  console.log('  Total changes:', changes[0].count);
  
  const toolChanges = await db.select({
    toolId: articleRankingsChanges.toolId,
    cnt: sql`count(*)`,
    total: sql`sum(${articleRankingsChanges.scoreChange})`
  }).from(articleRankingsChanges).groupBy(articleRankingsChanges.toolId);
  console.log('  Tools with changes:', toolChanges.length);

  console.log('\n4. ARTICLES:');
  const june = await db.select({ count: sql`count(*)` }).from(articles).where(gte(articles.publishedAt, new Date('2025-06-01')));
  console.log('  Articles from June 2025:', june[0].count);
  
  const articlesWithChanges = await db.select({
    articleId: articleRankingsChanges.articleId,
  }).from(articleRankingsChanges).groupBy(articleRankingsChanges.articleId);
  console.log('  Articles with changes:', articlesWithChanges.length);
  
  console.log('\n=== VERIFICATION COMPLETE ===');
}

verify().then(() => process.exit(0)).catch(err => { console.error('Error:', err); process.exit(1); });
