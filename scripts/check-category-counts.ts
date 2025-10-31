#!/usr/bin/env tsx
import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function checkCategories() {
  const db = getDb();
  if (!db) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  // Get all categories with counts
  const categoryResults = await db
    .select({
      category: tools.category,
      count: sql<number>`count(*)::int`
    })
    .from(tools)
    .groupBy(tools.category)
    .orderBy(sql`count(*) desc`);

  console.log('\n📊 Category Counts:\n');
  categoryResults.forEach(r => {
    console.log(`   ${r.category.padEnd(25)}: ${r.count} tool(s)`);
  });

  // Check Goose specifically
  console.log('\n🦆 Goose Tool:');
  const goose = await db.select().from(tools).where(eq(tools.slug, 'goose')).limit(1);
  if (goose.length > 0) {
    console.log('   ✓ Found');
    console.log('   Category:', goose[0].category);
    console.log('   Name:', goose[0].name);
  } else {
    console.log('   ✗ Not found');
  }

  // List all tools in code-assistant category
  console.log('\n📋 Tools in "code-assistant" category:');
  const codeAssistants = await db.select().from(tools).where(eq(tools.category, 'code-assistant'));
  codeAssistants.forEach(t => {
    console.log(`   • ${t.name} (${t.slug})`);
  });

  console.log('');
}

checkCategories();
