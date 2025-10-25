/**
 * Phase 7A: Use Case Verification Script
 *
 * Validates quality and completeness of use cases added to 23 tools.
 * Ensures Phase 4-6 quality standards are maintained (97.5-100%).
 */

import { db } from '../../lib/db';
import { tools } from '../../lib/db/schema';
import { inArray } from 'drizzle-orm';

const PHASE_7A_TOOLS = [
  'claude-code', 'chatgpt-canvas', 'claude-artifacts', 'coderabbit', 'snyk-code',
  'warp', 'zed', 'v0-vercel', 'refact-ai', 'google-jules', 'google-gemini-cli',
  'gemini-code-assist', 'jetbrains-ai-assistant', 'jetbrains-ai',
  'microsoft-intellicode', 'gitlab-duo', 'diffblue-cover', 'qodo-gen',
  'sourcery', 'cerebras-code', 'qwen-code', 'graphite', 'continue-dev'
];

interface VerificationResult {
  slug: string;
  name: string;
  passed: boolean;
  issues: string[];
  useCaseCount: number;
  contentCompleteness: number;
  qualityScore: number;
}

async function verifyUseCases() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    Phase 7A: Use Case Verification                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const allTools = await db
      .select()
      .from(tools)
      .where(inArray(tools.slug, PHASE_7A_TOOLS));

    console.log(`📊 Analyzing ${allTools.length} enhanced tools...\n`);

    const results: VerificationResult[] = [];

    for (const tool of allTools) {
      const issues: string[] = [];
      let qualityScore = 100;

      const data = tool.data as any || {};
      const useCases = data.use_cases || data.useCases || [];

      // Check 1: Use cases exist
      if (!useCases || useCases.length === 0) {
        issues.push('❌ No use cases found');
        qualityScore -= 100;
      }

      // Check 2: Use case count (3-5 expected)
      if (useCases.length < 3) {
        issues.push(`⚠️ Only ${useCases.length} use cases (expected 3-5)`);
        qualityScore -= 20;
      } else if (useCases.length > 5) {
        issues.push(`⚠️ ${useCases.length} use cases (expected 3-5, acceptable)`);
        qualityScore -= 5;
      }

      // Check 3: Use case structure
      useCases.forEach((useCase: any, index: number) => {
        if (!useCase.title) {
          issues.push(`❌ Use case ${index + 1} missing title`);
          qualityScore -= 10;
        }
        if (!useCase.description) {
          issues.push(`❌ Use case ${index + 1} missing description`);
          qualityScore -= 10;
        } else if (useCase.description.length < 100) {
          issues.push(`⚠️ Use case ${index + 1} description too short (<100 chars)`);
          qualityScore -= 5;
        }
        if (!useCase.benefits || useCase.benefits.length === 0) {
          issues.push(`❌ Use case ${index + 1} missing benefits`);
          qualityScore -= 10;
        } else if (useCase.benefits.length < 3) {
          issues.push(`⚠️ Use case ${index + 1} has only ${useCase.benefits.length} benefits`);
          qualityScore -= 5;
        }
      });

      // Check 4: Use case uniqueness (titles should be different)
      const titles = useCases.map((uc: any) => uc.title);
      const uniqueTitles = new Set(titles);
      if (titles.length !== uniqueTitles.size) {
        issues.push('⚠️ Duplicate use case titles found');
        qualityScore -= 10;
      }

      // Check 5: Content completeness (all fields present)
      const hasDescription = !!(data.description || data.tagline || data.overview);
      const hasFeatures = !!(data.features?.length > 0);
      const hasPricing = !!(data.pricing || data.pricingModel);
      const hasUseCases = useCases.length > 0;
      const hasIntegrations = !!(data.integrations?.length > 0);

      const completenessFactors = [
        hasDescription,
        hasFeatures,
        hasPricing,
        hasUseCases,
        hasIntegrations
      ];
      const contentCompleteness = (completenessFactors.filter(Boolean).length / completenessFactors.length) * 100;

      if (contentCompleteness < 100) {
        issues.push(`⚠️ Content completeness: ${contentCompleteness}% (expected 100%)`);
        qualityScore -= (100 - contentCompleteness);
      }

      results.push({
        slug: tool.slug,
        name: tool.name,
        passed: issues.length === 0,
        issues,
        useCaseCount: useCases.length,
        contentCompleteness,
        qualityScore: Math.max(0, qualityScore)
      });
    }

    // Generate report
    console.log('═'.repeat(80));
    console.log('VERIFICATION RESULTS');
    console.log('═'.repeat(80) + '\n');

    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    console.log(`✅ Passed: ${passed.length}/${results.length} (${(passed.length / results.length * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);

    const avgQualityScore = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
    const avgUseCases = results.reduce((sum, r) => sum + r.useCaseCount, 0) / results.length;
    const avgCompleteness = results.reduce((sum, r) => sum + r.contentCompleteness, 0) / results.length;

    console.log(`\n📊 Average Metrics:`);
    console.log(`  - Quality Score: ${avgQualityScore.toFixed(1)}/100`);
    console.log(`  - Use Cases per Tool: ${avgUseCases.toFixed(1)}`);
    console.log(`  - Content Completeness: ${avgCompleteness.toFixed(1)}%`);

    // Detailed results
    console.log('\n' + '═'.repeat(80));
    console.log('DETAILED TOOL ANALYSIS');
    console.log('═'.repeat(80) + '\n');

    results.sort((a, b) => b.qualityScore - a.qualityScore).forEach((result, index) => {
      const statusEmoji = result.passed ? '✅' : '❌';
      const scoreColor = result.qualityScore >= 90 ? '🟢' :
                        result.qualityScore >= 75 ? '🟡' : '🔴';

      console.log(`${index + 1}. ${statusEmoji} ${result.name} (${result.slug})`);
      console.log(`   Quality Score: ${scoreColor} ${result.qualityScore}/100`);
      console.log(`   Use Cases: ${result.useCaseCount}`);
      console.log(`   Completeness: ${result.contentCompleteness}%`);

      if (result.issues.length > 0) {
        console.log(`   Issues:`);
        result.issues.forEach(issue => console.log(`     ${issue}`));
      }
      console.log();
    });

    // Quality distribution
    const excellent = results.filter(r => r.qualityScore >= 95);
    const good = results.filter(r => r.qualityScore >= 85 && r.qualityScore < 95);
    const acceptable = results.filter(r => r.qualityScore >= 75 && r.qualityScore < 85);
    const needsWork = results.filter(r => r.qualityScore < 75);

    console.log('═'.repeat(80));
    console.log('QUALITY DISTRIBUTION');
    console.log('═'.repeat(80) + '\n');
    console.log(`🟢 Excellent (95-100): ${excellent.length} tools`);
    console.log(`🟡 Good (85-94): ${good.length} tools`);
    console.log(`🟠 Acceptable (75-84): ${acceptable.length} tools`);
    console.log(`🔴 Needs Work (<75): ${needsWork.length} tools\n`);

    // Phase 4-6 quality comparison
    const targetQuality = 97.5;
    const meetsTarget = results.filter(r => r.qualityScore >= targetQuality).length;

    console.log('═'.repeat(80));
    console.log('PHASE 4-6 QUALITY STANDARD COMPARISON');
    console.log('═'.repeat(80) + '\n');
    console.log(`Target Quality: ${targetQuality}% (Phase 4-6 standard)`);
    console.log(`Tools Meeting Target: ${meetsTarget}/${results.length} (${(meetsTarget / results.length * 100).toFixed(1)}%)`);

    if (meetsTarget / results.length >= 0.95) {
      console.log('✅ Phase 7A meets Phase 4-6 quality standards!\n');
    } else if (meetsTarget / results.length >= 0.85) {
      console.log('🟡 Phase 7A approaches Phase 4-6 quality standards (85%+ meeting target)\n');
    } else {
      console.log('🔴 Phase 7A needs improvement to meet Phase 4-6 quality standards\n');
    }

    // Recommendations
    if (needsWork.length > 0) {
      console.log('🎯 RECOMMENDATIONS:\n');
      needsWork.forEach(tool => {
        console.log(`${tool.name}:`);
        tool.issues.forEach(issue => console.log(`  - ${issue}`));
        console.log();
      });
    }

    console.log('✅ Verification complete!\n');

    // Exit with appropriate code
    process.exit(failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

verifyUseCases();
