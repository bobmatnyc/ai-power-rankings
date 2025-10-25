import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Verification Script
 * Analyzes quality and completeness of Phase 5 tool updates
 */

const phase5Slugs = [
  'bolt-new',
  'chatgpt-canvas',
  'claude-artifacts',
  'cline',
  'continue-dev',  // Correct slug for Continue
  'lovable',
  'v0-vercel',
  'refact-ai',
  'warp',
  'augment-code'
];

interface QualityMetrics {
  slug: string;
  name: string;
  company: string | null;
  category: string | null;
  featureCount: number;
  useCaseCount: number;
  integrationCount: number;
  differentiatorCount: number;
  hasPricing: boolean;
  pricingTierCount: number;
  hasOverview: boolean;
  overviewWordCount: number;
  has2025Updates: boolean;
  completenessScore: number;
  qualityGrade: string;
}

async function verifyPhase5Updates() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  console.log('\n🔍 Phase 5 Update Verification Report');
  console.log('═'.repeat(80));
  console.log(`Analyzing ${phase5Slugs.length} critical market player tools\n`);

  const results: QualityMetrics[] = [];
  let totalScore = 0;

  for (const slug of phase5Slugs) {
    try {
      const result = await db
        .select()
        .from(tools)
        .where(eq(tools.slug, slug));

      if (result.length === 0) {
        console.log(`⚠️  ${slug}: NOT FOUND in database`);
        continue;
      }

      const tool = result[0];
      const data = tool.data as Record<string, any>;

      // Calculate metrics
      const featureCount = data.features?.length || 0;
      const useCaseCount = data.use_cases?.length || 0;
      const integrationCount = data.integrations?.length || 0;
      const differentiatorCount = data.differentiators?.length || 0;
      const hasPricing = !!data.pricing;
      const pricingTierCount = data.pricing?.tiers?.length || 0;
      const hasOverview = !!data.overview;
      const overviewWordCount = data.overview ? data.overview.split(' ').length : 0;
      const has2025Updates = !!data.recent_updates_2025 || !!data.updated_2025;

      // Calculate completeness score (out of 100)
      let score = 0;

      // Core fields (40 points)
      if (data.company) score += 5;
      if (data.category) score += 5;
      if (hasOverview && overviewWordCount >= 150) score += 15;
      if (data.tagline) score += 5;
      if (data.description) score += 10;

      // Features and content (35 points)
      if (featureCount >= 15) score += 10;
      else if (featureCount >= 10) score += 7;
      else if (featureCount >= 5) score += 4;

      if (useCaseCount >= 10) score += 8;
      else if (useCaseCount >= 5) score += 5;

      if (differentiatorCount >= 10) score += 10;
      else if (differentiatorCount >= 5) score += 7;

      if (integrationCount >= 5) score += 7;
      else if (integrationCount >= 3) score += 4;

      // Pricing (15 points)
      if (hasPricing && pricingTierCount >= 3) score += 15;
      else if (hasPricing && pricingTierCount >= 2) score += 10;
      else if (hasPricing) score += 5;

      // Currency and updates (10 points)
      if (has2025Updates) score += 10;

      const qualityGrade =
        score >= 95 ? 'A+' :
        score >= 90 ? 'A' :
        score >= 85 ? 'A-' :
        score >= 80 ? 'B+' :
        score >= 75 ? 'B' :
        score >= 70 ? 'B-' :
        score >= 65 ? 'C+' :
        score >= 60 ? 'C' :
        'Needs Improvement';

      const metrics: QualityMetrics = {
        slug,
        name: tool.name,
        company: data.company,
        category: data.category,
        featureCount,
        useCaseCount,
        integrationCount,
        differentiatorCount,
        hasPricing,
        pricingTierCount,
        hasOverview,
        overviewWordCount,
        has2025Updates,
        completenessScore: score,
        qualityGrade
      };

      results.push(metrics);
      totalScore += score;

      // Print tool summary
      console.log(`\n${metrics.name} (${slug})`);
      console.log('─'.repeat(80));
      console.log(`  Company: ${metrics.company || 'MISSING'}`);
      console.log(`  Category: ${metrics.category || 'MISSING'}`);
      console.log(`  Features: ${featureCount} | Use Cases: ${useCaseCount} | Integrations: ${integrationCount}`);
      console.log(`  Differentiators: ${differentiatorCount} | Pricing Tiers: ${pricingTierCount}`);
      console.log(`  Overview: ${overviewWordCount} words`);
      console.log(`  2025 Updates: ${has2025Updates ? 'Yes ✓' : 'No ✗'}`);
      console.log(`  Completeness: ${score}/100 (${qualityGrade})`);

    } catch (error) {
      console.error(`❌ Error analyzing ${slug}:`, error);
    }
  }

  // Summary statistics
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 PHASE 5 SUMMARY STATISTICS\n');

  const avgScore = totalScore / results.length;
  const avgFeatures = results.reduce((sum, r) => sum + r.featureCount, 0) / results.length;
  const avgUseCases = results.reduce((sum, r) => sum + r.useCaseCount, 0) / results.length;
  const avgDifferentiators = results.reduce((sum, r) => sum + r.differentiatorCount, 0) / results.length;
  const avgOverviewWords = results.reduce((sum, r) => sum + r.overviewWordCount, 0) / results.length;

  const gradeDistribution = results.reduce((acc, r) => {
    acc[r.qualityGrade] = (acc[r.qualityGrade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`  Tools Analyzed: ${results.length}/${phase5Slugs.length}`);
  console.log(`  Average Completeness Score: ${avgScore.toFixed(1)}/100`);
  console.log(`  Average Features: ${avgFeatures.toFixed(1)}`);
  console.log(`  Average Use Cases: ${avgUseCases.toFixed(1)}`);
  console.log(`  Average Differentiators: ${avgDifferentiators.toFixed(1)}`);
  console.log(`  Average Overview Length: ${avgOverviewWords.toFixed(0)} words`);

  console.log(`\n  Grade Distribution:`);
  Object.entries(gradeDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([grade, count]) => {
      console.log(`    ${grade}: ${count} tool${count > 1 ? 's' : ''}`);
    });

  // Category breakdown
  console.log(`\n  Category Breakdown:`);
  const categoryBreakdown = results.reduce((acc, r) => {
    const cat = r.category || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(categoryBreakdown).forEach(([category, count]) => {
    const toolsInCat = results.filter(r => r.category === category);
    const avgCatScore = toolsInCat.reduce((sum, r) => sum + r.completenessScore, 0) / toolsInCat.length;
    console.log(`    ${category}: ${count} tool${count > 1 ? 's' : ''} (avg score: ${avgCatScore.toFixed(1)})`);
  });

  // Quality benchmarks
  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ QUALITY BENCHMARKS (Phase 5 vs Phase 4)\n');

  console.log(`  Target: 100% completeness on all fields`);
  console.log(`  Target: 15+ features per tool`);
  console.log(`  Target: 10+ use cases per tool`);
  console.log(`  Target: 10+ differentiators per tool`);
  console.log(`  Target: 150+ word overviews`);
  console.log(`  Target: 2025-current data verified`);

  const benchmarks = {
    fullScore: results.filter(r => r.completenessScore === 100).length,
    features15Plus: results.filter(r => r.featureCount >= 15).length,
    useCases10Plus: results.filter(r => r.useCaseCount >= 10).length,
    diff10Plus: results.filter(r => r.differentiatorCount >= 10).length,
    overview150Plus: results.filter(r => r.overviewWordCount >= 150).length,
    has2025: results.filter(r => r.has2025Updates).length
  };

  console.log(`\n  Phase 5 Achievement:`);
  console.log(`    100% completeness: ${benchmarks.fullScore}/${results.length} (${(benchmarks.fullScore/results.length*100).toFixed(0)}%)`);
  console.log(`    15+ features: ${benchmarks.features15Plus}/${results.length} (${(benchmarks.features15Plus/results.length*100).toFixed(0)}%)`);
  console.log(`    10+ use cases: ${benchmarks.useCases10Plus}/${results.length} (${(benchmarks.useCases10Plus/results.length*100).toFixed(0)}%)`);
  console.log(`    10+ differentiators: ${benchmarks.diff10Plus}/${results.length} (${(benchmarks.diff10Plus/results.length*100).toFixed(0)}%)`);
  console.log(`    150+ word overview: ${benchmarks.overview150Plus}/${results.length} (${(benchmarks.overview150Plus/results.length*100).toFixed(0)}%)`);
  console.log(`    2025 data verified: ${benchmarks.has2025}/${results.length} (${(benchmarks.has2025/results.length*100).toFixed(0)}%)`);

  // Final verdict
  console.log('\n' + '═'.repeat(80));
  const passRate = (results.filter(r => r.completenessScore >= 90).length / results.length) * 100;

  if (passRate >= 90) {
    console.log('\n🎉 PHASE 5: EXCELLENT - Ready for production!');
    console.log(`   ${passRate.toFixed(0)}% of tools scored 90+ (A or better)`);
  } else if (passRate >= 75) {
    console.log('\n✅ PHASE 5: GOOD - Minor improvements recommended');
    console.log(`   ${passRate.toFixed(0)}% of tools scored 90+ (A or better)`);
  } else {
    console.log('\n⚠️  PHASE 5: NEEDS IMPROVEMENT - Review flagged tools');
    console.log(`   Only ${passRate.toFixed(0)}% of tools scored 90+`);
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

verifyPhase5Updates().catch(console.error);
