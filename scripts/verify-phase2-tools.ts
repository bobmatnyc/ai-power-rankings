#!/usr/bin/env tsx

/**
 * Verify Phase 2 Enterprise Tools Content Updates
 *
 * Checks that all 7 Phase 2 tools have been properly updated with:
 * - Company information
 * - Website
 * - Overview (100+ words)
 * - Features
 * - Pricing
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';

const PHASE2_TOOLS = [
  { slug: 'jetbrains-ai', name: 'JetBrains AI Assistant' },
  { slug: 'amazon-q-developer', name: 'Amazon Q Developer' },
  { slug: 'gemini-code-assist', name: 'Google Gemini Code Assist' },
  { slug: 'sourcegraph-cody', name: 'Sourcegraph Cody' },
  { slug: 'tabnine', name: 'Tabnine' },
  { slug: 'pieces-for-developers', name: 'Pieces for Developers' },
  { slug: 'windsurf', name: 'Windsurf' }
];

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║  📊 Phase 2 Enterprise Tools Verification                      ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🔗 Connecting to database...\n');
  const db = getDb();

  const phase2Slugs = PHASE2_TOOLS.map(t => t.slug);

  const results = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, phase2Slugs));

  console.log(`📋 Tools found in database: ${results.length}/7\n`);

  let successCount = 0;
  let failCount = 0;

  for (const expectedTool of PHASE2_TOOLS) {
    const tool = results.find(r => r.slug === expectedTool.slug);

    if (!tool) {
      console.log(`❌ ${expectedTool.name}`);
      console.log(`   Slug: ${expectedTool.slug}`);
      console.log(`   Status: NOT FOUND IN DATABASE\n`);
      failCount++;
      continue;
    }

    // Access data from JSONB field
    const toolData = (tool.data || {}) as Record<string, any>;

    const hasCompany = toolData.company && toolData.company.length > 0;
    const hasWebsite = toolData.website && toolData.website.length > 0;
    const hasOverview = toolData.overview && toolData.overview.length > 100;
    const hasFeatures = toolData.features && Array.isArray(toolData.features) && toolData.features.length >= 10;
    const hasPricing = toolData.pricing?.tiers && Array.isArray(toolData.pricing.tiers) && toolData.pricing.tiers.length >= 2;

    const allGood = hasCompany && hasWebsite && hasOverview && hasFeatures && hasPricing;

    if (allGood) {
      console.log(`✅ ${tool.name}`);
      successCount++;
    } else {
      console.log(`⚠️  ${tool.name}`);
      failCount++;
    }

    console.log(`   Slug: ${tool.slug}`);
    console.log(`   Company: ${hasCompany ? '✅' : '❌'} ${hasCompany ? toolData.company?.substring(0, 40) : 'MISSING'}`);
    console.log(`   Website: ${hasWebsite ? '✅' : '❌'} ${hasWebsite ? toolData.website?.substring(0, 50) : 'MISSING'}`);
    console.log(`   Overview: ${hasOverview ? '✅' : '❌'} ${hasOverview ? `(${toolData.overview?.length} chars)` : 'MISSING or too short'}`);
    console.log(`   Features: ${hasFeatures ? '✅' : '❌'} ${hasFeatures ? `(${toolData.features?.length} features)` : 'MISSING or too few'}`);
    console.log(`   Pricing: ${hasPricing ? '✅' : '❌'} ${hasPricing ? `(${toolData.pricing?.tiers?.length} tiers)` : 'MISSING or too few'}`);
    console.log('');
  }

  const notFound = phase2Slugs.filter(slug => !results.find(r => r.slug === slug));
  if (notFound.length > 0) {
    console.log('❌ Tools not found in database:');
    notFound.forEach(slug => {
      const toolName = PHASE2_TOOLS.find(t => t.slug === slug)?.name || slug;
      console.log(`   - ${toolName} (${slug})`);
    });
    console.log('');
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Summary                                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Successfully updated: ${successCount}/7`);
  console.log(`❌ Failed or incomplete: ${failCount}/7`);
  console.log('');

  closeDb();

  if (successCount === 7) {
    console.log('🎉 All Phase 2 tools verified successfully!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tools need attention. See details above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Verification error:', error);
  closeDb();
  process.exit(1);
});
