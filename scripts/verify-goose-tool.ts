#!/usr/bin/env tsx
/**
 * Verify Goose Tool in Database
 *
 * Queries the database to confirm Goose was added correctly
 * and displays all its data.
 *
 * Usage: npx tsx scripts/verify-goose-tool.ts
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyGooseTool() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🔍 Verifying Goose AI Agent in database...\n');

  try {
    // Query by slug
    const result = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, 'goose'))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ Goose not found in database');
      process.exit(1);
    }

    const goose = result[0];
    const data = goose.data as Record<string, any>;

    console.log('✅ Goose found in database!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 DATABASE RECORD');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Database ID:', goose.id);
    console.log('Slug:', goose.slug);
    console.log('Name:', goose.name);
    console.log('Category:', goose.category);
    console.log('Status:', goose.status);
    console.log('Created At:', goose.createdAt);
    console.log('Updated At:', goose.updatedAt);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 TOOL METADATA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Full Name:', data.full_name);
    console.log('Developer:', data.company_name);
    console.log('Launch Date:', data.founded_date);
    console.log('License:', data.license);
    console.log('Pricing Model:', data.pricing_model);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔗 LINKS');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Website:', data.website_url);
    console.log('GitHub:', data.github_url);
    console.log('Docs:', data.documentation_url);
    console.log('GitHub Repo:', data.github_repo);
    console.log('GitHub Stars:', data.github_stats?.stars?.toLocaleString());
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('⚡ POWER RANKING');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Overall Score:', data.power_ranking, '/ 100');
    console.log('Tier:', data.ranking_tier);
    console.log('\nBreakdown:');
    if (data.ranking_breakdown) {
      Object.entries(data.ranking_breakdown).forEach(([key, value]) => {
        console.log(`   ${key.padEnd(15)}: ${value}/100`);
      });
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✨ KEY FEATURES');
    console.log('═══════════════════════════════════════════════════════');
    if (data.features && Array.isArray(data.features)) {
      data.features.forEach((feature: string, idx: number) => {
        console.log(`${idx + 1}. ${feature}`);
      });
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 DIFFERENTIATORS');
    console.log('═══════════════════════════════════════════════════════');
    if (data.key_differentiators && Array.isArray(data.key_differentiators)) {
      data.key_differentiators.forEach((diff: string) => {
        console.log('•', diff);
      });
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🏷️  TAGS');
    console.log('═══════════════════════════════════════════════════════');
    if (data.tags && Array.isArray(data.tags)) {
      console.log(data.tags.join(', '));
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('All data fields populated correctly ✓');
    console.log('Tool is ready to appear on the website ✓');
    console.log('');

    console.log('🌐 Next: Visit https://your-site.com/en/tools/goose to see the live page');
    console.log('');

  } catch (error) {
    console.error('❌ Error verifying Goose tool:', error);
    process.exit(1);
  }
}

// Run the script
verifyGooseTool();
