#!/usr/bin/env tsx

/**
 * Verify Jules Duplicate Fix
 *
 * Checks:
 * 1. Only one active Jules entry exists in tools table
 * 2. Old Jules entry is marked as redirect
 * 3. Only one Jules appears in current rankings
 * 4. Jules ranking position and score
 */

import { getDb, closeDb } from '../lib/db/connection';
import { rankings, tools } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function verifyJulesFix() {
  const db = getDb();

  console.log('\n🔍 Jules Duplicate Fix Verification\n');
  console.log('='.repeat(80));

  // Check 1: Tools table
  console.log('\n📋 Check 1: Tools Table Status\n');

  const allJulesEntries = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      status: tools.status,
      createdAt: tools.createdAt,
    })
    .from(tools)
    .where(eq(tools.name, 'Google Jules'));

  console.log(`Total Jules entries found: ${allJulesEntries.length}`);
  console.log('');

  allJulesEntries.forEach((entry, i) => {
    console.log(`Entry ${i + 1}:`);
    console.log(`  ID:      ${entry.id}`);
    console.log(`  Slug:    ${entry.slug}`);
    console.log(`  Status:  ${entry.status}`);
    console.log(`  Created: ${entry.createdAt}`);
    console.log('');
  });

  const activeJules = allJulesEntries.filter(e => e.status === 'active');
  const redirectJules = allJulesEntries.filter(e => e.status === 'redirect');

  console.log(`✓ Active entries:   ${activeJules.length} ${activeJules.length === 1 ? '✅' : '❌'}`);
  console.log(`✓ Redirect entries: ${redirectJules.length} ${redirectJules.length === 1 ? '✅' : '❌'}`);

  // Check 2: Current Rankings
  console.log('\n📊 Check 2: Current Rankings (October 2025)\n');

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  let julesInRankings: any[] = [];

  if (currentRankings.length === 0) {
    console.log('❌ No current ranking found');
  } else {
    const rankingData = currentRankings[0];
    console.log(`Period: ${rankingData.period}`);
    console.log(`Algorithm Version: ${rankingData.algorithmVersion}`);
    console.log(`Published: ${rankingData.publishedAt}`);
    console.log('');

    const rankingsList = Array.isArray(rankingData.data)
      ? rankingData.data
      : (rankingData.data as any)?.rankings || [];

    julesInRankings = rankingsList.filter((r: any) =>
      r.tool_name === 'Google Jules'
    );

    console.log(`Jules entries in rankings: ${julesInRankings.length} ${julesInRankings.length === 1 ? '✅' : '❌'}`);
    console.log('');

    if (julesInRankings.length > 0) {
      julesInRankings.forEach((jules: any, i: number) => {
        console.log(`Jules Entry ${i + 1}:`);
        console.log(`  Rank:  #${jules.rank}`);
        console.log(`  Score: ${jules.score}`);
        console.log(`  Slug:  ${jules.tool_slug}`);
        console.log(`  Tier:  ${jules.tier}`);

        if (jules.movement) {
          console.log(`  Movement:`);
          console.log(`    Direction: ${jules.movement.direction}`);
          console.log(`    Change:    ${jules.movement.change > 0 ? '+' : ''}${jules.movement.change}`);
          if (jules.movement.previous_position) {
            console.log(`    Previous:  #${jules.movement.previous_position}`);
          }
        }
        console.log('');
      });
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('📝 Verification Summary\n');

  const allChecks = [
    { check: 'Only 1 active Jules in tools table', passed: activeJules.length === 1 },
    { check: 'Only 1 redirect Jules in tools table', passed: redirectJules.length === 1 },
    { check: 'Only 1 Jules in current rankings', passed: currentRankings.length > 0 ? julesInRankings.length === 1 : false },
  ];

  let allPassed = true;
  allChecks.forEach(({ check, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
    if (!passed) allPassed = false;
  });

  console.log('');
  if (allPassed) {
    console.log('🎉 All checks passed! Jules duplicate is fixed.\n');
  } else {
    console.log('⚠️  Some checks failed. Please review the output above.\n');
  }

  // Additional info
  if (activeJules.length === 1 && redirectJules.length === 1) {
    console.log('📌 Active Jules:');
    console.log(`   Slug: ${activeJules[0].slug}`);
    console.log(`   ID:   ${activeJules[0].id}`);
    console.log('');
    console.log('🔀 Redirect Jules:');
    console.log(`   Slug: ${redirectJules[0].slug}`);
    console.log(`   ID:   ${redirectJules[0].id}`);
    console.log('   → Should redirect to: /tools/google-jules');
    console.log('');
  }
}

verifyJulesFix()
  .catch((error) => {
    console.error('\n❌ Verification error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
