import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function listToolsByCategory() {
  const db = getDb();
  if (db === null) {
    console.log('No DB connection');
    return;
  }

  // Get all tools
  const allTools = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      category: tools.category,
      status: tools.status,
      data: tools.data
    })
    .from(tools)
    .orderBy(tools.category, tools.name);

  console.log(`\n=== ALL TOOLS BY CATEGORY ===`);
  console.log(`Total tools: ${allTools.length}\n`);

  // Group by category
  const byCategory: Record<string, any[]> = {};
  allTools.forEach(tool => {
    if (!byCategory[tool.category]) {
      byCategory[tool.category] = [];
    }

    const data = tool.data as any;
    const hasFullContent = !!(
      (data?.description || data?.info?.product?.description) &&
      (data?.tagline || data?.info?.product?.tagline) &&
      data?.info?.product?.features &&
      data?.info?.business?.pricing_details
    );

    byCategory[tool.category].push({
      name: tool.name,
      slug: tool.slug,
      status: tool.status,
      hasFullContent,
      hasInfo: !!data?.info,
      hasDescription: !!(data?.description || data?.info?.product?.description),
      hasTagline: !!(data?.tagline || data?.info?.product?.tagline),
      hasFeatures: !!(data?.info?.product?.features || data?.features),
      hasPricing: !!(data?.info?.business?.pricing_details || data?.business?.pricing_details)
    });
  });

  // Print by category
  const specializedCategories = [
    'code-review',
    'testing-tool',
    'devops-assistant',
    'code-assistant',
    'proprietary-ide',
    'other'
  ];

  console.log('=== SPECIALIZED TOOLS (Phase 4 Candidates) ===\n');

  specializedCategories.forEach(category => {
    if (byCategory[category]) {
      console.log(`\n📁 ${category.toUpperCase()} (${byCategory[category].length} tools)`);
      console.log('─'.repeat(80));

      byCategory[category].forEach((tool: any) => {
        const status = tool.hasFullContent ? '✅ COMPLETE' : '❌ NEEDS UPDATE';
        console.log(`\n${status} ${tool.name} (${tool.slug})`);
        console.log(`  Status: ${tool.status}`);
        console.log(`  Has Description: ${tool.hasDescription ? '✓' : '✗'}`);
        console.log(`  Has Tagline: ${tool.hasTagline ? '✓' : '✗'}`);
        console.log(`  Has Features: ${tool.hasFeatures ? '✓' : '✗'}`);
        console.log(`  Has Pricing: ${tool.hasPricing ? '✓' : '✗'}`);
        console.log(`  Has Full Info: ${tool.hasInfo ? '✓' : '✗'}`);
      });
    }
  });

  console.log('\n\n=== OTHER CATEGORIES ===\n');

  const otherCategories = Object.keys(byCategory).filter(
    cat => !specializedCategories.includes(cat)
  );

  otherCategories.forEach(category => {
    console.log(`\n📁 ${category.toUpperCase()} (${byCategory[category].length} tools)`);
    byCategory[category].forEach((tool: any) => {
      const status = tool.hasFullContent ? '✅' : '❌';
      console.log(`  ${status} ${tool.name} (${tool.slug})`);
    });
  });

  // Summary
  console.log('\n\n=== PHASE 4 SUMMARY ===');
  const phase4Tools = specializedCategories.flatMap(cat => byCategory[cat] || []);
  const needsUpdate = phase4Tools.filter(t => !t.hasFullContent);

  console.log(`Total specialized tools: ${phase4Tools.length}`);
  console.log(`Needs update: ${needsUpdate.length}`);
  console.log(`Already complete: ${phase4Tools.length - needsUpdate.length}`);

  console.log('\n=== TOOLS NEEDING UPDATE ===');
  needsUpdate.forEach(tool => {
    console.log(`  - ${tool.name} (${tool.slug})`);
  });
}

listToolsByCategory();
