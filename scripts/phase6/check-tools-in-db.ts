#!/usr/bin/env tsx

import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { inArray } from 'drizzle-orm';

async function checkTools() {
  const db = await getDb();

  const slugs = [
    'google-jules',
    'jetbrains-ai-assistant',
    'devin',
    'microsoft-intellicode',
    'coderabbit',
    'snyk-code',
    'zed'
  ];

  console.log('🔍 Checking Phase 6 tools in database...\n');

  const results = await db
    .select({
      slug: tools.slug,
      name: tools.name,
      data: tools.data
    })
    .from(tools)
    .where(inArray(tools.slug, slugs));

  console.log(`Found ${results.length}/7 tools:\n`);

  for (const tool of results) {
    const data = tool.data as any;
    console.log(`✅ ${tool.name} (${tool.slug})`);
    console.log(`   Company: ${data?.company || 'N/A'}`);
    console.log(`   Features: ${data?.features?.length || 0}`);
    console.log(`   Use Cases: ${data?.use_cases?.length || 0}`);
    console.log(`   Category: ${data?.category || 'N/A'}`);
    console.log('');
  }

  const foundSlugs = results.map(r => r.slug);
  const missing = slugs.filter(s => !foundSlugs.includes(s));

  if (missing.length > 0) {
    console.log(`\n❌ Missing tools (${missing.length}):`);
    missing.forEach(s => console.log(`   - ${s}`));
  }

  process.exit(0);
}

checkTools().catch(console.error);
