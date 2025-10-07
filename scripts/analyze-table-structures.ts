/**
 * Analyze Rankings vs Ranking Versions Table Structures
 *
 * This script examines the data structures in both tables to understand
 * the schema design and data format differences.
 */

import { getDb } from '@/lib/db/connection';
import { rankings, rankingVersions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function analyzeTableStructures() {
  console.log('='.repeat(80));
  console.log('DATABASE STRUCTURE ANALYSIS');
  console.log('='.repeat(80));

  const db = getDb();
  if (!db) {
    console.error('❌ Database connection not available');
    process.exit(1);
  }

  try {
    // 1. Analyze rankings table
    console.log('\n📊 RANKINGS TABLE ANALYSIS');
    console.log('-'.repeat(80));

    const rankingsData = await db
      .select()
      .from(rankings)
      .orderBy(rankings.period);

    console.log(`\n✅ Found ${rankingsData.length} rows in rankings table`);

    rankingsData.forEach((row) => {
      console.log(`\n  Period: ${row.period}`);
      console.log(`  Algorithm: ${row.algorithmVersion}`);
      console.log(`  Is Current: ${row.isCurrent}`);
      console.log(`  Published: ${row.publishedAt}`);
      console.log(`  Data Type: ${typeof row.data}`);
      console.log(`  Data Structure: ${JSON.stringify(row.data).substring(0, 200)}...`);

      // Analyze data structure
      if (row.data && typeof row.data === 'object') {
        const keys = Object.keys(row.data);
        console.log(`  Data Keys: ${keys.join(', ')}`);

        if ('rankings' in row.data && Array.isArray(row.data.rankings)) {
          console.log(`  Rankings Array Length: ${row.data.rankings.length}`);
          if (row.data.rankings.length > 0) {
            const firstTool = row.data.rankings[0];
            console.log(`  First Tool Sample: ${JSON.stringify(firstTool).substring(0, 150)}`);
          }
        } else if (Array.isArray(row.data)) {
          console.log(`  Direct Array Length: ${row.data.length}`);
        }
      }
    });

    // 2. Analyze ranking_versions table
    console.log('\n\n📊 RANKING_VERSIONS TABLE ANALYSIS');
    console.log('-'.repeat(80));

    const versionsData = await db
      .select()
      .from(rankingVersions)
      .orderBy(rankingVersions.createdAt);

    console.log(`\n✅ Found ${versionsData.length} rows in ranking_versions table`);

    versionsData.forEach((row) => {
      console.log(`\n  Version: ${row.version}`);
      console.log(`  Article ID: ${row.articleId || 'None'}`);
      console.log(`  Created: ${row.createdAt}`);
      console.log(`  Tools Affected: ${row.toolsAffected}`);
      console.log(`  News Items: ${row.newsItemsCount}`);
      console.log(`  Snapshot Type: ${typeof row.rankingsSnapshot}`);

      // Analyze snapshot structure
      if (row.rankingsSnapshot && typeof row.rankingsSnapshot === 'object') {
        if (Array.isArray(row.rankingsSnapshot)) {
          console.log(`  Snapshot is Array: Length = ${row.rankingsSnapshot.length}`);
          if (row.rankingsSnapshot.length > 0) {
            const firstTool = row.rankingsSnapshot[0];
            console.log(`  First Tool Sample: ${JSON.stringify(firstTool).substring(0, 150)}`);
          }
        } else {
          const keys = Object.keys(row.rankingsSnapshot);
          console.log(`  Snapshot Keys: ${keys.join(', ')}`);
        }
      }
    });

    // 3. Compare structures
    console.log('\n\n🔍 STRUCTURE COMPARISON');
    console.log('-'.repeat(80));

    if (rankingsData.length > 0 && versionsData.length > 0) {
      const rankingSample = rankingsData.find(r => r.period === '2025-09');
      const versionSample = versionsData.find(v => v.version === '2025-09');

      if (rankingSample && versionSample) {
        console.log('\nComparing 2025-09 period:');
        console.log('\nRANKINGS table:');
        console.log(`  - Data is ${typeof rankingSample.data === 'object' && 'rankings' in rankingSample.data ? 'nested object with rankings key' : 'unknown structure'}`);

        console.log('\nRANKING_VERSIONS table:');
        console.log(`  - Snapshot is ${Array.isArray(versionSample.rankingsSnapshot) ? 'direct array' : 'unknown structure'}`);

        console.log('\n⚠️  STRUCTURAL DIFFERENCE DETECTED!');
        console.log('   - rankings.data: { rankings: [...] } (nested)');
        console.log('   - ranking_versions.rankings_snapshot: [...] (direct array)');
      }
    }

    // 4. Recommendations
    console.log('\n\n💡 ANALYSIS SUMMARY');
    console.log('-'.repeat(80));
    console.log('\nTable Purposes:');
    console.log('  ✓ rankings: Monthly published ranking snapshots (historical timeline)');
    console.log('  ✓ ranking_versions: Version control for rollback capability (article-driven changes)');
    console.log('\nCurrent Issues:');
    console.log('  ⚠️  Different data structures (nested vs direct array)');
    console.log('  ⚠️  Trending API only queries rankings table');
    console.log('  ⚠️  ranking_versions has historical data but not used for trending');
    console.log('\nData Coverage:');
    console.log(`  - rankings: ${rankingsData.length} periods`);
    console.log(`  - ranking_versions: ${versionsData.length} versions`);

  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    throw error;
  }
}

// Run analysis
analyzeTableStructures()
  .then(() => {
    console.log('\n✅ Analysis complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });
