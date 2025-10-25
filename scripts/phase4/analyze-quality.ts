import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { inArray } from 'drizzle-orm';

async function analyzeQuality() {
  const db = getDb();
  if (!db) {
    console.log('❌ No database connection');
    return;
  }

  const slugs = [
    'sourcery',
    'diffblue-cover',
    'qodo-gen',
    'gitlab-duo',
    'graphite',
    'greptile',
    'cerebras-code',
    'snyk-code',
    'coderabbit'
  ];

  const toolList = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, slugs));

  console.log('\n📊 Phase 4 Quality Analysis\n');
  console.log('═'.repeat(80));
  console.log(`Found ${toolList.length} tools\n`);

  for (const tool of toolList) {
    if (!tool) continue;
    const data = tool.data as any;

    console.log(`\n📝 ${tool.name} (${tool.slug})`);
    console.log(`   Category: ${tool.sub_category}`);
    console.log(`   Overview Length: ${data?.overview?.length || 0} chars`);
    console.log(`   Features Count: ${Array.isArray(data?.features) ? data.features.length : 0}`);
    console.log(`   Differentiators: ${Array.isArray(data?.differentiators) ? data.differentiators.length : 0}`);

    // Check for specialized content
    const overview = data?.overview || '';
    const hasMetrics = /\d+%|\d+x|ms|seconds|minutes/.test(overview);
    const hasSpecialty = overview.toLowerCase().includes(tool.sub_category?.toLowerCase() || '');

    console.log(`   Has Performance Metrics: ${hasMetrics ? '✅' : '⚠️'}`);
    console.log(`   Mentions Specialty: ${hasSpecialty ? '✅' : '⚠️'}`);

    // Sample differentiators
    if (Array.isArray(data?.differentiators) && data.differentiators.length > 0) {
      console.log(`   Sample Differentiator: "${data.differentiators[0]?.substring(0, 80)}..."`);
    }
  }

  // Calculate aggregates
  const avgFeatures = toolList.reduce((sum, t) => {
    const data = t.data as any;
    return sum + (Array.isArray(data?.features) ? data.features.length : 0);
  }, 0) / toolList.length;

  const avgDiff = toolList.reduce((sum, t) => {
    const data = t.data as any;
    return sum + (Array.isArray(data?.differentiators) ? data.differentiators.length : 0);
  }, 0) / toolList.length;

  const avgOverview = toolList.reduce((sum, t) => {
    const data = t.data as any;
    return sum + (data?.overview?.length || 0);
  }, 0) / toolList.length;

  console.log('\n' + '═'.repeat(80));
  console.log('\n📈 Aggregate Metrics:');
  console.log(`   Average Features: ${avgFeatures.toFixed(1)}`);
  console.log(`   Average Differentiators: ${avgDiff.toFixed(1)}`);
  console.log(`   Average Overview Length: ${avgOverview.toFixed(0)} chars`);
  console.log(`   Total Tools: ${toolList.length}`);
  console.log(`   100% Complete: ${toolList.length === 9 ? '✅' : '❌'}`);
}

analyzeQuality().catch(console.error);
