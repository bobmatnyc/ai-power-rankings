#!/usr/bin/env tsx

/**
 * QA Deep Verification of Phase 2 Enterprise Tools Content
 *
 * Performs comprehensive quality assurance checks:
 * - Content completeness and quality
 * - Enterprise focus verification
 * - Data accuracy spot checks
 * - Parent company verification
 * - Pricing validation
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray } from 'drizzle-orm';

const PHASE2_TOOLS = [
  {
    slug: 'jetbrains-ai',
    name: 'JetBrains AI Assistant',
    expectedCompany: 'JetBrains',
    expectedParent: 'JetBrains',
    keyFeatures: ['context-aware', 'IDE integration']
  },
  {
    slug: 'amazon-q-developer',
    name: 'Amazon Q Developer',
    expectedCompany: 'Amazon Web Services',
    expectedParent: 'AWS',
    expectedPricing: '$19',
    keyFeatures: ['AWS integration', 'security scanning']
  },
  {
    slug: 'gemini-code-assist',
    name: 'Google Gemini Code Assist',
    expectedCompany: 'Google',
    expectedParent: 'Google Cloud',
    keyFeatures: ['Google Cloud integration', 'enterprise']
  },
  {
    slug: 'sourcegraph-cody',
    name: 'Sourcegraph Cody',
    expectedCompany: 'Sourcegraph',
    keyFeatures: ['Code Graph', 'codebase context']
  },
  {
    slug: 'tabnine',
    name: 'Tabnine',
    expectedCompany: 'Tabnine',
    keyFeatures: ['air-gapped', 'privacy', 'on-premises']
  },
  {
    slug: 'windsurf',
    name: 'Windsurf',
    expectedCompany: 'Codeium',
    expectedParent: 'Codeium',
    keyFeatures: ['Flows', 'agentic']
  }
];

const ENTERPRISE_KEYWORDS = [
  'enterprise',
  'security',
  'compliance',
  'administration',
  'deployment',
  'governance',
  'SSO',
  'SAML',
  'audit',
  'scalability',
  'team',
  'organization'
];

function analyzeEnterpriseContent(text: string): { score: number; keywords: string[] } {
  const lowerText = text.toLowerCase();
  const foundKeywords = ENTERPRISE_KEYWORDS.filter(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
  return {
    score: (foundKeywords.length / ENTERPRISE_KEYWORDS.length) * 100,
    keywords: foundKeywords
  };
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║  🔍 Phase 2 QA Deep Content Verification                       ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('🔗 Connecting to database...\n');
  const db = getDb();

  const phase2Slugs = PHASE2_TOOLS.map(t => t.slug);

  const results = await db
    .select()
    .from(tools)
    .where(inArray(tools.slug, phase2Slugs));

  console.log(`📋 Tools found: ${results.length}/6 (Pieces excluded)\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passCount = 0;
  const issues: string[] = [];

  for (const expectedTool of PHASE2_TOOLS) {
    const tool = results.find(r => r.slug === expectedTool.slug);

    if (!tool) {
      console.log(`❌ ${expectedTool.name} - NOT FOUND\n`);
      issues.push(`${expectedTool.name} not found in database`);
      continue;
    }

    console.log(`\n🔍 ${tool.name}`);
    console.log(`${'─'.repeat(60)}`);

    const toolData = (tool.data || {}) as Record<string, any>;
    let toolPassed = true;

    // 1. Company Verification
    console.log(`\n📊 COMPANY INFORMATION:`);
    const company = toolData.company || '';
    const companyMatch = company.includes(expectedTool.expectedCompany);
    console.log(`   Company: ${company}`);
    console.log(`   Expected: ${expectedTool.expectedCompany}`);
    console.log(`   Status: ${companyMatch ? '✅ Match' : '⚠️  Check'}`);

    if (expectedTool.expectedParent) {
      const parentMentioned = company.includes(expectedTool.expectedParent) ||
                              toolData.overview?.includes(expectedTool.expectedParent);
      console.log(`   Parent: ${expectedTool.expectedParent} ${parentMentioned ? '✅' : '⚠️'}`);
    }

    // 2. Overview Quality Check
    console.log(`\n📝 OVERVIEW QUALITY:`);
    const overview = toolData.overview || '';
    const overviewLength = overview.length;
    const enterpriseAnalysis = analyzeEnterpriseContent(overview);

    console.log(`   Length: ${overviewLength} chars ${overviewLength >= 100 ? '✅' : '❌'}`);
    console.log(`   Enterprise Score: ${enterpriseAnalysis.score.toFixed(1)}% ${enterpriseAnalysis.score >= 20 ? '✅' : '⚠️'}`);
    console.log(`   Enterprise Keywords: ${enterpriseAnalysis.keywords.join(', ')}`);

    if (overviewLength < 100) {
      toolPassed = false;
      issues.push(`${tool.name}: Overview too short (${overviewLength} chars)`);
    }
    if (enterpriseAnalysis.score < 20) {
      issues.push(`${tool.name}: Low enterprise focus (${enterpriseAnalysis.score.toFixed(1)}%)`);
    }

    // 3. Features Check
    console.log(`\n🎯 FEATURES:`);
    const features = toolData.features || [];
    console.log(`   Count: ${features.length} ${features.length >= 12 ? '✅' : '⚠️'}`);

    if (expectedTool.keyFeatures) {
      const featuresText = JSON.stringify(features).toLowerCase();
      expectedTool.keyFeatures.forEach(keyFeature => {
        const found = featuresText.includes(keyFeature.toLowerCase());
        console.log(`   Key Feature "${keyFeature}": ${found ? '✅' : '⚠️'}`);
      });
    }

    if (features.length < 12) {
      issues.push(`${tool.name}: Only ${features.length} features (expected 12+)`);
    }

    // 4. Pricing Verification
    console.log(`\n💰 PRICING:`);
    const pricingTiers = toolData.pricing?.tiers || [];
    console.log(`   Tiers: ${pricingTiers.length} ${pricingTiers.length >= 2 ? '✅' : '❌'}`);

    pricingTiers.forEach((tier: any, idx: number) => {
      const isEnterprise = tier.name?.toLowerCase().includes('enterprise');
      console.log(`   ${idx + 1}. ${tier.name} - ${tier.price || 'Custom'} ${isEnterprise ? '🏢' : ''}`);
    });

    const hasEnterpriseTier = pricingTiers.some((t: any) =>
      t.name?.toLowerCase().includes('enterprise')
    );
    console.log(`   Enterprise Tier: ${hasEnterpriseTier ? '✅ Yes' : '⚠️  None'}`);

    if (expectedTool.expectedPricing) {
      const pricingText = JSON.stringify(pricingTiers);
      const hasPricing = pricingText.includes(expectedTool.expectedPricing);
      console.log(`   Expected Price "${expectedTool.expectedPricing}": ${hasPricing ? '✅' : '⚠️'}`);
    }

    if (pricingTiers.length < 2) {
      toolPassed = false;
      issues.push(`${tool.name}: Insufficient pricing tiers (${pricingTiers.length})`);
    }

    // 5. Website Check
    console.log(`\n🌐 WEBSITE:`);
    const website = toolData.website || '';
    console.log(`   URL: ${website}`);
    console.log(`   Status: ${website.length > 0 ? '✅' : '❌'}`);

    if (!website) {
      toolPassed = false;
      issues.push(`${tool.name}: Missing website URL`);
    }

    // Summary for this tool
    console.log(`\n${toolPassed ? '✅ PASSED' : '⚠️  NEEDS ATTENTION'}`);
    if (toolPassed) passCount++;

    console.log('\n' + '═'.repeat(60));
  }

  // Final Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  QA VERIFICATION SUMMARY                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Tools Passed: ${passCount}/6`);
  console.log(`⚠️  Tools with Issues: ${6 - passCount}/6`);

  if (issues.length > 0) {
    console.log(`\n📋 ISSUES FOUND (${issues.length}):`);
    issues.forEach((issue, idx) => {
      console.log(`   ${idx + 1}. ${issue}`);
    });
  } else {
    console.log('\n🎉 No critical issues found!');
  }

  console.log(`\n📊 OVERALL STATUS: ${passCount === 6 ? '✅ ALL PASSED' : `⚠️  ${passCount}/6 PASSED`}`);
  console.log('');

  closeDb();

  if (passCount === 6) {
    console.log('🎉 Phase 2 QA verification complete - all tools meet quality standards!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tools need attention. Review issues above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ QA Verification error:', error);
  closeDb();
  process.exit(1);
});
