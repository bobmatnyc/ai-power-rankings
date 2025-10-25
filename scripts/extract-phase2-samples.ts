#!/usr/bin/env tsx

/**
 * Extract Sample Content from Phase 2 Tools
 *
 * Generates content samples for QA evidence
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';

const PHASE2_TOOLS = [
  'jetbrains-ai',
  'amazon-q-developer',
  'gemini-code-assist',
  'sourcegraph-cody',
  'tabnine',
  'windsurf'
];

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  📋 Phase 2 Content Samples                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const db = getDb();

  const results = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, PHASE2_TOOLS));

  for (const tool of results) {
    const toolData = (tool.data || {}) as Record<string, any>;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔧 ${tool.name.toUpperCase()}`);
    console.log(`${'═'.repeat(70)}\n`);

    console.log(`📌 Company: ${toolData.company || 'N/A'}`);
    console.log(`🌐 Website: ${toolData.website || 'N/A'}\n`);

    console.log(`📝 Overview (first 300 chars):`);
    const overview = toolData.overview || '';
    console.log(`   "${overview.substring(0, 300)}${overview.length > 300 ? '...' : ''}"\n`);

    console.log(`🎯 Enterprise Features (sample):`);
    const features = toolData.features || [];
    const enterpriseFeatures = features.filter((f: string) =>
      f.toLowerCase().includes('enterprise') ||
      f.toLowerCase().includes('security') ||
      f.toLowerCase().includes('compliance') ||
      f.toLowerCase().includes('team') ||
      f.toLowerCase().includes('admin')
    ).slice(0, 5);

    if (enterpriseFeatures.length > 0) {
      enterpriseFeatures.forEach((f: string) => console.log(`   • ${f}`));
    } else {
      console.log(`   • (First 5 features):`);
      features.slice(0, 5).forEach((f: string) => console.log(`   • ${f}`));
    }

    console.log(`\n💰 Pricing Tiers:`);
    const pricingTiers = toolData.pricing?.tiers || [];
    pricingTiers.forEach((tier: any) => {
      const price = tier.price || 'Custom pricing';
      console.log(`   • ${tier.name}: ${price}`);
      if (tier.description) {
        console.log(`     ${tier.description.substring(0, 80)}${tier.description.length > 80 ? '...' : ''}`);
      }
    });

    console.log(`\n📊 Stats:`);
    console.log(`   • Overview: ${overview.length} characters`);
    console.log(`   • Features: ${features.length} total`);
    console.log(`   • Pricing Tiers: ${pricingTiers.length}`);
    console.log(`   • Enterprise Tier: ${pricingTiers.some((t: any) => t.name?.toLowerCase().includes('enterprise')) ? 'Yes ✅' : 'No ⚠️'}`);
  }

  console.log(`\n${'═'.repeat(70)}\n`);
  console.log(`✅ Sample extraction complete!\n`);

  closeDb();
}

main().catch(error => {
  console.error('❌ Error:', error);
  closeDb();
  process.exit(1);
});
