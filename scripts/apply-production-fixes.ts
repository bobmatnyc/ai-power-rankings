#!/usr/bin/env tsx

/**
 * Apply Production Fixes for Jules Duplicate
 *
 * This script applies the Jules duplicate fix to the production database.
 * It marks the old Jules entry as a redirect and removes its rankings.
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools, rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// Production host fragment that DATABASE_URL must contain; kept out of source.
const PROD_DATABASE_HOST = process.env.PROD_DATABASE_HOST;
if (!PROD_DATABASE_HOST) {
  console.error('❌ PROD_DATABASE_HOST is not set. Export it before running this script.');
  process.exit(1);
}

async function applyProductionFixes(prodHost: string): Promise<void> {
  const db = getDb();

  console.log('\n🚀 Applying Production Fixes...\n');
  console.log('='.repeat(80));

  // Verify we're using the right database
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes(prodHost);

  console.log('\n🔍 Database Connection Check:');
  console.log(`   URL: ${dbUrl.substring(0, 50)}...`);
  console.log(`   Is Production: ${isProduction ? '✅ YES' : '⚠️  NO'}`);

  if (!isProduction) {
    console.log('\n⚠️  WARNING: This does not appear to be the production database!');
    console.log(`   Expected: ${prodHost}`);
    console.log('\n   Continue anyway? (The script will proceed in 3 seconds)');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Step 1: Check current Jules state
  console.log('\n📋 Step 1: Checking Current Jules State\n');

  const allJulesEntries = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      status: tools.status,
    })
    .from(tools)
    .where(eq(tools.name, 'Google Jules'));

  console.log(`Found ${allJulesEntries.length} Jules entries:`);
  allJulesEntries.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.slug} (${entry.status}) - ${entry.id}`);
  });

  const julesOldId = '930730fe-5e58-4f25-b3a2-151bb6121a58';
  const oldJules = allJulesEntries.find(e => e.id === julesOldId);

  if (!oldJules) {
    console.log(`\n⚠️  Old Jules ID ${julesOldId} not found!`);
    console.log('   Listing all Jules entries above. Please verify the correct ID to mark as redirect.');
    await closeDb();
    return;
  }

  console.log(`\n   Old Jules found: ${oldJules.slug} (current status: ${oldJules.status})`);

  // Step 2: Fix Jules duplicate
  console.log('\n🔧 Step 2: Fixing Jules Duplicate Entry\n');

  if (oldJules.status === 'redirect') {
    console.log('   ℹ️  Old Jules already marked as redirect, skipping...');
  } else {
    // Mark old entry as redirect
    await db.update(tools)
      .set({
        status: 'redirect',
        data: { redirect_to: 'google-jules' } as any
      })
      .where(eq(tools.id, julesOldId));

    console.log('   ✅ Marked old Jules as redirect');
  }

  // Note: Rankings table stores complete ranking data in JSONB per period
  // The old Jules will be excluded when rankings are regenerated
  console.log('   ℹ️  Old Jules will be excluded from future ranking regenerations');

  // Step 3: Check if we need to regenerate rankings
  console.log('\n📊 Step 3: Checking Current Rankings State\n');

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  if (currentRankings.length === 0) {
    console.log('   ❌ No current rankings found!');
    console.log('\n   Next steps:');
    console.log('   1. Run: npx tsx scripts/regenerate-october-rankings.ts');
    console.log('   2. Run: npx tsx scripts/set-october-current.ts');
  } else {
    const ranking = currentRankings[0];
    const rankingData = Array.isArray(ranking.data)
      ? ranking.data
      : (ranking.data as any)?.rankings || [];

    const julesInRankings = rankingData.filter((r: any) =>
      r.tool_name === 'Google Jules'
    );

    console.log(`   Current ranking: ${ranking.period} (v${ranking.algorithmVersion})`);
    console.log(`   Jules entries in ranking: ${julesInRankings.length}`);

    if (julesInRankings.length > 1) {
      console.log('\n   ⚠️  Multiple Jules entries found in current rankings!');
      console.log('   Rankings need to be regenerated.');
      console.log('\n   Next steps:');
      console.log('   1. Run: npx tsx scripts/regenerate-october-rankings.ts');
      console.log('   2. Run: npx tsx scripts/set-october-current.ts');
    } else if (julesInRankings.length === 1) {
      console.log('   ✅ Only one Jules entry in current rankings');
      console.log('\n   Rankings look good! Verify at:');
      console.log('   https://aipowerranking.com/en/rankings');
    } else {
      console.log('   ⚠️  No Jules entries in rankings (unexpected)');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Production Fixes Applied Successfully!');
  console.log('='.repeat(80));

  console.log('\n📝 Summary:');
  console.log(`   ✓ Old Jules marked as redirect: ${oldJules.slug} → google-jules`);
  console.log(`   ✓ Database: Production`);
  console.log(`   ✓ Timestamp: ${new Date().toISOString()}`);

  console.log('\n🔄 Next Steps:');
  console.log('   1. Regenerate rankings: npx tsx scripts/regenerate-october-rankings.ts');
  console.log('   2. Set as current: npx tsx scripts/set-october-current.ts');
  console.log('   3. Update logos: npx tsx scripts/update-production-logo-urls.ts');
  console.log('   4. Verify: npx tsx scripts/verify-jules-fix.ts');
  console.log('');
}

applyProductionFixes(PROD_DATABASE_HOST)
  .catch((error) => {
    console.error('\n❌ Production fix error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
