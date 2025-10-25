import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Verify Phase 4 specialized tools content updates
 */

const phase4Slugs = [
  'coderabbit',
  'snyk-code',
  'sourcery',
  'diffblue-cover',
  'qodo-gen',
  'gitlab-duo',
  'graphite',
  'greptile',
  'cerebras-code'
];

async function verifyPhase4Updates() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  console.log('\n🔍 Verifying Phase 4 Specialized Tools Content Updates\n');
  console.log('═'.repeat(80));

  const phase4Tools = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, phase4Slugs));

  console.log(`\n📊 Found ${phase4Tools.length}/${phase4Slugs.length} Phase 4 tools\n`);

  let allPassed = true;

  for (const tool of phase4Tools) {
    const data = tool.data as any;
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 ${tool.name} (${tool.slug})`);
    console.log(`${'─'.repeat(80)}`);

    // Check required fields
    const checks = {
      'Company': !!data?.company,
      'Tagline': !!data?.tagline,
      'Description': !!data?.description,
      'Overview': !!data?.overview,
      'Website': !!data?.website,
      'Features': Array.isArray(data?.features) && data.features.length >= 10,
      'Use Cases': Array.isArray(data?.use_cases) && data.use_cases.length >= 8,
      'Integrations': Array.isArray(data?.integrations) && data.integrations.length >= 3,
      'Pricing Info': !!data?.pricing,
      'Differentiators': Array.isArray(data?.differentiators) && data.differentiators.length >= 8,
      'Target Audience': !!data?.target_audience,
      'Updated 2025': data?.updated_2025 === true
    };

    let passedChecks = 0;
    let totalChecks = Object.keys(checks).length;

    for (const [field, passed] of Object.entries(checks)) {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${field}`);
      if (passed) passedChecks++;
      else allPassed = false;
    }

    // Additional metrics
    console.log(`\n   📈 Content Metrics:`);
    console.log(`      - Features: ${data?.features?.length || 0}`);
    console.log(`      - Use Cases: ${data?.use_cases?.length || 0}`);
    console.log(`      - Integrations: ${data?.integrations?.length || 0}`);
    console.log(`      - Differentiators: ${data?.differentiators?.length || 0}`);
    console.log(`      - Description Length: ${data?.description?.length || 0} chars`);
    console.log(`      - Overview Length: ${data?.overview?.length || 0} chars`);

    const completeness = ((passedChecks / totalChecks) * 100).toFixed(1);
    console.log(`\n   📊 Completeness: ${passedChecks}/${totalChecks} (${completeness}%)`);

    if (passedChecks === totalChecks) {
      console.log(`   ✅ ALL CHECKS PASSED`);
    } else {
      console.log(`   ⚠️  NEEDS ATTENTION: ${totalChecks - passedChecks} checks failed`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📋 Phase 4 Summary:');
  console.log(`   - Total tools verified: ${phase4Tools.length}`);
  console.log(`   - Status: ${allPassed ? '✅ ALL TOOLS COMPLETE' : '⚠️  SOME TOOLS NEED ATTENTION'}`);

  // Specialization breakdown
  const byCategory: Record<string, string[]> = {};
  phase4Tools.forEach(tool => {
    const category = tool.category || 'uncategorized';
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(tool.name);
  });

  console.log('\n📁 By Specialization:');
  for (const [category, toolNames] of Object.entries(byCategory)) {
    console.log(`   - ${category}: ${toolNames.join(', ')}`);
  }

  console.log('\n✅ Verification complete!\n');
}

verifyPhase4Updates();
