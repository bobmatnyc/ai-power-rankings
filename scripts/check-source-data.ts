#!/usr/bin/env tsx
/**
 * Check Source Data for Duplicate Score Tools
 *
 * Examine the raw tool data for Google Jules, Refact.ai, and Devin
 * to understand why they're getting identical scores
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';

async function checkSourceData() {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection not available');
    process.exit(1);
  }

  console.log('🔍 Checking source data for duplicate score tools...\n');

  try {
    const suspectSlugs = ['google-jules', 'refact-ai', 'devin'];

    const toolsData = await db
      .select()
      .from(tools)
      .where(inArray(tools.slug, suspectSlugs));

    console.log(`Found ${toolsData.length} tools\n`);
    console.log('='.repeat(80));

    for (const tool of toolsData) {
      console.log(`\n📦 ${tool.slug}:`);
      console.log(`   ID: ${tool.id}`);
      console.log(`   Name: ${tool.name}`);
      console.log(`   Status: ${tool.status}`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Created: ${tool.createdAt}`);
      console.log(`   Updated: ${tool.updatedAt}`);
      console.log();

      const data = tool.data as any;

      // Check critical metrics used in ranking
      console.log('   📊 Ranking Metrics:');
      console.log(`      GitHub Stars: ${data.github?.stars || 'N/A'}`);
      console.log(`      GitHub Forks: ${data.github?.forks || 'N/A'}`);
      console.log(`      Open Issues: ${data.github?.openIssues || 'N/A'}`);
      console.log(`      Last Commit: ${data.github?.lastCommit || 'N/A'}`);
      console.log(`      NPM Downloads: ${data.npm?.downloads || 'N/A'}`);
      console.log(`      PyPI Downloads: ${data.pypi?.downloads || 'N/A'}`);
      console.log(`      Website Traffic: ${data.website?.monthlyVisits || 'N/A'}`);
      console.log(`      HN Score: ${data.hackernews?.score || 'N/A'}`);
      console.log(`      Reddit Karma: ${data.reddit?.karma || 'N/A'}`);

      // Show raw data structure
      console.log('\n   📋 Raw Data Keys:');
      console.log(`      ${Object.keys(data).join(', ')}`);
      console.log();
      console.log('='.repeat(80));
    }

    // Check if data objects are identical
    console.log('\n🔍 Comparing Data Objects:\n');
    const dataObjects = toolsData.map(t => ({
      slug: t.slug,
      dataJson: JSON.stringify(t.data)
    }));

    const uniqueDataSets = new Set(dataObjects.map(d => d.dataJson));
    console.log(`Unique data sets: ${uniqueDataSets.size}`);

    if (uniqueDataSets.size === 1) {
      console.log('❌ ALL THREE TOOLS HAVE IDENTICAL DATA!');
      console.log('   This is the root cause of identical scores.\n');
    } else {
      console.log('✅ Tools have different data');
      console.log('   The scoring algorithm may have a bug.\n');
    }

    // Show which tools share data
    const dataSimilarity = new Map<string, string[]>();
    for (const obj of dataObjects) {
      if (!dataSimilarity.has(obj.dataJson)) {
        dataSimilarity.set(obj.dataJson, []);
      }
      dataSimilarity.get(obj.dataJson)!.push(obj.slug);
    }

    if (dataSimilarity.size < dataObjects.length) {
      console.log('🔍 Data Sharing Detected:\n');
      for (const [_, slugs] of dataSimilarity.entries()) {
        if (slugs.length > 1) {
          console.log(`   ❌ These tools share identical data:`);
          console.log(`      ${slugs.join(', ')}`);
        }
      }
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error checking data:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

checkSourceData();
