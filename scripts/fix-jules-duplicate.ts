#!/usr/bin/env tsx

/**
 * Fix Jules Duplicate Entry
 *
 * Problem: Google Jules exists twice in database
 * - ID: 87f7c508-daf1-4b20-a0b6-f76b22139408 (slug: google-jules, newer, active)
 * - ID: 930730fe-5e58-4f25-b3a2-151bb6121a58 (slug: jules, older, active)
 *
 * Solution:
 * 1. Keep the newer 'google-jules' entry (canonical)
 * 2. Mark the older 'jules' entry as redirect to 'google-jules'
 * 3. This preserves historical data while preventing duplicate rankings
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// IDs from database query
const CANONICAL_JULES_ID = '87f7c508-daf1-4b20-a0b6-f76b22139408'; // google-jules (keep)
const OLD_JULES_ID = '930730fe-5e58-4f25-b3a2-151bb6121a58';       // jules (redirect)

async function fixJulesDuplicate() {
  const db = getDb();

  console.log('🔧 Fixing Jules Duplicate Entry\n');
  console.log('='.repeat(80));

  // Step 1: Verify both entries exist
  console.log('\n📋 Step 1: Verifying Jules entries...\n');

  const julesEntries = await db
    .select()
    .from(tools)
    .where(eq(tools.name, 'Google Jules'));

  console.log(`Found ${julesEntries.length} Jules entries:`);
  julesEntries.forEach(entry => {
    console.log(`  - ID: ${entry.id}`);
    console.log(`    Slug: ${entry.slug}`);
    console.log(`    Status: ${entry.status}`);
    console.log(`    Created: ${entry.createdAt}`);
    console.log('');
  });

  if (julesEntries.length !== 2) {
    console.error(`❌ Expected 2 Jules entries, found ${julesEntries.length}`);
    process.exit(1);
  }

  // Step 2: Mark old entry as redirect
  console.log('🔄 Step 2: Marking old Jules entry as redirect...\n');

  const oldEntry = julesEntries.find(e => e.id === OLD_JULES_ID);
  if (!oldEntry) {
    console.error('❌ Could not find old Jules entry');
    process.exit(1);
  }

  // Preserve the old data but add redirect info
  const oldData = oldEntry.data as any;
  const updatedData = {
    ...oldData,
    redirect_to: 'google-jules',
    redirect_reason: 'Consolidated to canonical google-jules entry',
    original_slug: 'jules',
  };

  await db
    .update(tools)
    .set({
      status: 'redirect',
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.id, OLD_JULES_ID));

  console.log('✅ Old Jules entry (slug: jules) marked as redirect');
  console.log(`   → Redirects to: google-jules`);
  console.log(`   → Status changed: active → redirect`);

  // Step 3: Verify the change
  console.log('\n✅ Step 3: Verifying changes...\n');

  const verifyEntries = await db
    .select()
    .from(tools)
    .where(eq(tools.name, 'Google Jules'));

  console.log('Current state of Jules entries:');
  verifyEntries.forEach(entry => {
    console.log(`  - ID: ${entry.id}`);
    console.log(`    Slug: ${entry.slug}`);
    console.log(`    Status: ${entry.status}`);
    const redirectTo = (entry.data as any)?.redirect_to;
    if (redirectTo) {
      console.log(`    Redirects to: ${redirectTo}`);
    }
    console.log('');
  });

  const activeCount = verifyEntries.filter(e => e.status === 'active').length;
  const redirectCount = verifyEntries.filter(e => e.status === 'redirect').length;

  console.log('='.repeat(80));
  console.log('✅ Jules Duplicate Fixed Successfully!\n');
  console.log(`   Active entries:   ${activeCount} (expected: 1)`);
  console.log(`   Redirect entries: ${redirectCount} (expected: 1)`);
  console.log('\n📝 Next Steps:');
  console.log('   1. Run: npx tsx scripts/generate-v72-rankings.ts');
  console.log('   2. Verify only one Jules appears in rankings');
  console.log('   3. Check that old /jules URL redirects properly\n');
}

fixJulesDuplicate()
  .catch((error) => {
    console.error('\n❌ Error fixing Jules duplicate:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
