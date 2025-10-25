#!/usr/bin/env tsx

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { like, or } from 'drizzle-orm';

async function main() {
  console.log('🔍 Searching for missing Phase 2 tools...\n');

  const db = getDb();

  const keywords = ['jetbrains', 'gemini', 'pieces', 'google', 'code assist'];

  for (const keyword of keywords) {
    console.log(`Searching for "${keyword}"...`);
    const results = await db
      .select({ slug: tools.slug, name: tools.name, category: tools.category })
      .from(tools)
      .where(
        or(
          like(tools.name, `%${keyword}%`),
          like(tools.slug, `%${keyword}%`)
        )
      );

    if (results.length > 0) {
      results.forEach(t => console.log(`  ✓ ${t.name} (${t.slug}) [${t.category}]`));
    } else {
      console.log(`  ❌ No matches found`);
    }
    console.log('');
  }

  // List all IDE-assistant and similar category tools
  console.log('📋 All tools in related categories:\n');
  const categoryResults = await db
    .select({ slug: tools.slug, name: tools.name, category: tools.category })
    .from(tools)
    .where(
      or(
        like(tools.category, '%ide%'),
        like(tools.category, '%assistant%'),
        like(tools.category, '%editor%')
      )
    );

  categoryResults.forEach(t => console.log(`  - ${t.name} (${t.slug}) [${t.category}]`));

  closeDb();
}

main().catch(error => {
  console.error('Error:', error);
  closeDb();
  process.exit(1);
});
