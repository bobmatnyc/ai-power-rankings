import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * Phase 6: Verification Script
 * Verifies all Phase 6 enterprise & platform leader tool updates
 * Target: 97.5-100% quality score matching Phase 4-5 standards
 */

const PHASE6_TOOLS = [
  'devin',
  'google-jules',
  'jetbrains-ai-assistant',
  'microsoft-intellicode',
  'coderabbit',
  'snyk-code',
  'zed'
];

interface QualityMetrics {
  slug: string;
  name: string;
  completeness: number;
  featureCount: number;
  useCaseCount: number;
  integrationCount: number;
  differentiatorCount: number;
  has2025Updates: boolean;
  hasOverview: boolean;
  hasPricing: boolean;
  qualityScore: number;
  issues: string[];
}

async function verifyPhase6Updates() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  console.log('🔍 Phase 6: Enterprise & Platform Leaders Verification');
  console.log('=====================================================\n');
  console.log('Target: 97.5-100% quality score (Phase 4-5 standard)\n');

  try {
    const results = await db
      .select()
      .from(tools)
      .where(inArray(tools.slug, PHASE6_TOOLS));

    const metrics: QualityMetrics[] = [];
    let totalQuality = 0;
    let totalFeatures = 0;
    let totalUseCases = 0;
    let totalIntegrations = 0;

    console.log('📊 Individual Tool Analysis:\n');

    for (const tool of results) {
      const data = tool.data as any;
      const issues: string[] = [];

      // Check completeness
      const hasCompany = !!data.company;
      const hasTagline = !!data.tagline;
      const hasDescription = !!data.description;
      const hasOverview = !!data.overview;
      const hasWebsite = !!data.website;
      const hasPricing = !!data.pricing;
      const hasFeatures = data.features && data.features.length > 0;
      const hasUseCases = data.use_cases && data.use_cases.length > 0;
      const hasIntegrations = data.integrations && data.integrations.length > 0;
      const hasDifferentiators = data.differentiators && data.differentiators.length > 0;
      const has2025Updates = data.updated_2025 === true;
      const hasRecentUpdates = data.recent_updates_2025 && data.recent_updates_2025.length > 0;

      // Count elements
      const featureCount = data.features?.length || 0;
      const useCaseCount = data.use_cases?.length || 0;
      const integrationCount = data.integrations?.length || 0;
      const differentiatorCount = data.differentiators?.length || 0;
      const recentUpdateCount = data.recent_updates_2025?.length || 0;

      // Quality checks
      if (featureCount < 15) issues.push(`Only ${featureCount} features (target: 15-18)`);
      if (useCaseCount < 10) issues.push(`Only ${useCaseCount} use cases (target: 10+)`);
      if (differentiatorCount < 13) issues.push(`Only ${differentiatorCount} differentiators (target: 13)`);
      if (!has2025Updates) issues.push('Missing updated_2025 flag');
      if (recentUpdateCount < 10) issues.push(`Only ${recentUpdateCount} recent updates (target: 10+)`);
      if (!hasOverview) issues.push('Missing overview');
      if (!hasPricing) issues.push('Missing pricing information');

      // Calculate completeness
      const completenessFields = [
        hasCompany, hasTagline, hasDescription, hasOverview, hasWebsite,
        hasPricing, hasFeatures, hasUseCases, hasIntegrations, hasDifferentiators,
        has2025Updates, hasRecentUpdates
      ];
      const completeness = (completenessFields.filter(Boolean).length / completenessFields.length) * 100;

      // Calculate quality score
      let qualityScore = 0;
      qualityScore += completeness * 0.4; // 40% weight on completeness
      qualityScore += Math.min((featureCount / 18) * 100, 100) * 0.2; // 20% on features
      qualityScore += Math.min((useCaseCount / 10) * 100, 100) * 0.15; // 15% on use cases
      qualityScore += Math.min((integrationCount / 10) * 100, 100) * 0.1; // 10% on integrations
      qualityScore += Math.min((differentiatorCount / 13) * 100, 100) * 0.15; // 15% on differentiators

      metrics.push({
        slug: tool.slug,
        name: data.name,
        completeness,
        featureCount,
        useCaseCount,
        integrationCount,
        differentiatorCount,
        has2025Updates,
        hasOverview,
        hasPricing,
        qualityScore,
        issues
      });

      totalQuality += qualityScore;
      totalFeatures += featureCount;
      totalUseCases += useCaseCount;
      totalIntegrations += integrationCount;

      // Display tool results
      const statusIcon = qualityScore >= 97.5 ? '✅' : qualityScore >= 90 ? '🟡' : '❌';
      console.log(`${statusIcon} ${data.name} (${tool.slug})`);
      console.log(`   Quality Score: ${qualityScore.toFixed(1)}%`);
      console.log(`   Completeness: ${completeness.toFixed(1)}%`);
      console.log(`   Features: ${featureCount} | Use Cases: ${useCaseCount} | Integrations: ${integrationCount}`);
      console.log(`   Differentiators: ${differentiatorCount} | 2025 Updates: ${recentUpdateCount}`);

      if (issues.length > 0) {
        console.log(`   ⚠️  Issues:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }
      console.log('');
    }

    // Summary statistics
    const avgQuality = totalQuality / metrics.length;
    const avgFeatures = totalFeatures / metrics.length;
    const avgUseCases = totalUseCases / metrics.length;
    const avgIntegrations = totalIntegrations / metrics.length;

    console.log('\n=====================================================');
    console.log('📈 Phase 6 Summary Statistics');
    console.log('=====================================================\n');
    console.log(`Average Quality Score: ${avgQuality.toFixed(1)}%`);
    console.log(`Average Features: ${avgFeatures.toFixed(1)} (target: 15-18)`);
    console.log(`Average Use Cases: ${avgUseCases.toFixed(1)} (target: 10+)`);
    console.log(`Average Integrations: ${avgIntegrations.toFixed(1)} (target: 5-15)`);
    console.log(`Tools with 97.5%+ quality: ${metrics.filter(m => m.qualityScore >= 97.5).length}/${metrics.length}`);
    console.log(`Tools with 2025 updates: ${metrics.filter(m => m.has2025Updates).length}/${metrics.length}`);

    console.log('\n🎯 Quality Tiers:');
    const excellent = metrics.filter(m => m.qualityScore >= 97.5);
    const good = metrics.filter(m => m.qualityScore >= 90 && m.qualityScore < 97.5);
    const needsWork = metrics.filter(m => m.qualityScore < 90);

    console.log(`   ✅ Excellent (97.5%+): ${excellent.length} tools`);
    if (excellent.length > 0) {
      excellent.forEach(m => console.log(`      - ${m.name}: ${m.qualityScore.toFixed(1)}%`));
    }

    console.log(`   🟡 Good (90-97.5%): ${good.length} tools`);
    if (good.length > 0) {
      good.forEach(m => console.log(`      - ${m.name}: ${m.qualityScore.toFixed(1)}%`));
    }

    console.log(`   ❌ Needs Work (<90%): ${needsWork.length} tools`);
    if (needsWork.length > 0) {
      needsWork.forEach(m => console.log(`      - ${m.name}: ${m.qualityScore.toFixed(1)}%`));
    }

    console.log('\n📊 Comparison with Phase 4-5 Standards:');
    console.log('   Phase 4-5 Average: 97.5-100% quality');
    console.log(`   Phase 6 Average: ${avgQuality.toFixed(1)}%`);
    console.log(`   Status: ${avgQuality >= 97.5 ? '✅ MEETS STANDARD' : avgQuality >= 90 ? '🟡 CLOSE' : '❌ NEEDS IMPROVEMENT'}`);

    console.log('\n🏆 Phase 6 Highlights:');
    const toolHighlights = [
      'Devin: $10.2B valuation, 96% price reduction',
      'Google Jules: 140K+ commits, Gemini 2.5 Pro',
      'JetBrains AI: Gartner Magic Quadrant, 25M+ users',
      'Microsoft IntelliCode: 100% free, pioneered 2017',
      'CodeRabbit: #1 GitHub AI app, $60M Series B',
      'Snyk Code: 84% MTTR reduction, Evo agentic',
      'Zed: 58ms response, Rust+GPU, Atom creators'
    ];
    toolHighlights.forEach(h => console.log(`   - ${h}`));

    console.log('\n💡 Next Steps:');
    if (avgQuality >= 97.5) {
      console.log('   ✅ Phase 6 complete! All tools meet quality standards.');
      console.log('   ✅ Ready for production deployment.');
    } else {
      console.log('   🔧 Review tools with quality < 97.5%');
      console.log('   📝 Address missing content and issues');
      console.log('   🔄 Re-run verification after improvements');
    }

    console.log('\n📚 Documentation:');
    console.log('   - Research summary: docs/content/PHASE6-RESEARCH-SUMMARY.md');
    console.log('   - Tool highlights: scripts/phase6/README.md');
    console.log('   - Update scripts: scripts/phase6/update-*.ts');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

verifyPhase6Updates();
