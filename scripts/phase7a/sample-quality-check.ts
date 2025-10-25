#!/usr/bin/env tsx

import { db } from '../../lib/db/index.js';
import { tools } from '../../lib/db/schema.js';
import { eq } from 'drizzle-orm';

interface UseCase {
  title: string;
  description: string;
  benefits: string | string[];
}

async function sampleQualityCheck() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              Phase 7A: Detailed Use Case Quality Analysis                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  // Sample tools from each priority group
  const sampleTools = [
    { slug: 'claude-code', priority: 'Priority 1: Major Market Players', expected: 5 },
    { slug: 'chatgpt-canvas', priority: 'Priority 1: Major Market Players', expected: 5 },
    { slug: 'snyk-code', priority: 'Priority 1: Major Market Players', expected: 4 },
    { slug: 'google-jules', priority: 'Priority 2: Google Ecosystem', expected: 4 },
    { slug: 'gemini-code-assist', priority: 'Priority 2: Google Ecosystem', expected: 4 },
    { slug: 'jetbrains-ai-assistant', priority: 'Priority 3: Enterprise & Specialized', expected: 4 },
    { slug: 'gitlab-duo', priority: 'Priority 3: Enterprise & Specialized', expected: 4 },
    { slug: 'cerebras-code', priority: 'Priority 4: Emerging & Open Source', expected: 4 },
    { slug: 'continue-dev', priority: 'Priority 4: Emerging & Open Source', expected: 4 },
  ];

  let totalQualityScore = 0;
  let totalUseCases = 0;
  let highQualityExamples: string[] = [];
  let issuesFound: string[] = [];

  for (const { slug, priority, expected } of sampleTools) {
    const result = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

    if (result.length === 0) {
      issuesFound.push(`❌ Tool not found: ${slug}`);
      continue;
    }

    const tool = result[0];
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`${tool.name} (${slug})`);
    console.log(`${priority} - Expected: ${expected} use cases`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Use cases are stored in the data JSONB field as use_cases (snake_case)
    const data = tool.data as any;
    const useCases = data?.use_cases as UseCase[] | null;

    if (!useCases || !Array.isArray(useCases)) {
      issuesFound.push(`❌ ${tool.name}: No use cases array found`);
      console.log('❌ ERROR: No use cases found\n');
      continue;
    }

    console.log(`✓ Use Cases Count: ${useCases.length} (expected: ${expected})\n`);
    totalUseCases += useCases.length;

    let toolScore = 100;

    // Check if count matches expected
    if (useCases.length !== expected) {
      toolScore -= 20;
      issuesFound.push(`⚠️  ${tool.name}: Expected ${expected} use cases, found ${useCases.length}`);
    }

    // Analyze each use case
    useCases.forEach((uc, idx) => {
      console.log(`--- Use Case ${idx + 1}: ${uc.title} ---`);

      // Normalize benefits to string
      const benefitsStr = Array.isArray(uc.benefits) ? uc.benefits.join(', ') : uc.benefits;

      // Check structure
      const hasTitle = uc.title && uc.title.length > 10;
      const hasDescription = uc.description && uc.description.length > 50;
      const hasBenefits = uc.benefits && benefitsStr.length > 30;

      if (!hasTitle) {
        toolScore -= 5;
        issuesFound.push(`⚠️  ${tool.name} UC${idx + 1}: Weak title`);
      }
      if (!hasDescription) {
        toolScore -= 10;
        issuesFound.push(`⚠️  ${tool.name} UC${idx + 1}: Insufficient description`);
      }
      if (!hasBenefits) {
        toolScore -= 10;
        issuesFound.push(`⚠️  ${tool.name} UC${idx + 1}: Weak benefits`);
      }

      // Display content
      console.log(`📝 Description: ${uc.description.substring(0, 120)}${uc.description.length > 120 ? '...' : ''}`);
      console.log(`💡 Benefits: ${benefitsStr.substring(0, 120)}${benefitsStr.length > 120 ? '...' : ''}`);

      // Check for specificity (not generic)
      const isSpecific = (
        uc.description.toLowerCase().includes(tool.name.toLowerCase()) ||
        uc.description.length > 100 ||
        /\d+%|\d+x|minutes|hours|faster|better|improved/i.test(benefitsStr)
      );

      if (isSpecific) {
        console.log('✓ Tool-specific and measurable');
      } else {
        console.log('⚠️  May be too generic');
        toolScore -= 5;
      }

      console.log('');
    });

    totalQualityScore += toolScore;

    // Track high-quality examples
    if (toolScore >= 95 && useCases.length >= 4) {
      const bestUC = useCases[0];
      const benefitsPreview = Array.isArray(bestUC.benefits)
        ? bestUC.benefits[0].substring(0, 80)
        : bestUC.benefits.substring(0, 80);
      highQualityExamples.push(`${tool.name}: "${bestUC.title}" - ${benefitsPreview}...`);
    }

    console.log(`Quality Score: ${toolScore}/100\n\n`);
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          QUALITY ANALYSIS SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const avgQualityScore = totalQualityScore / sampleTools.length;
  const avgUseCasesPerTool = totalUseCases / sampleTools.length;

  console.log(`📊 Average Quality Score: ${avgQualityScore.toFixed(1)}/100`);
  console.log(`📈 Average Use Cases per Tool: ${avgUseCasesPerTool.toFixed(1)}`);
  console.log(`🎯 Phase 4-6 Target: 97.5/100`);
  console.log(`${avgQualityScore >= 97.5 ? '✅' : '⚠️ '} Quality Standard: ${avgQualityScore >= 97.5 ? 'MET' : 'NEEDS IMPROVEMENT'}\n`);

  if (highQualityExamples.length > 0) {
    console.log('🌟 HIGH-QUALITY USE CASE EXAMPLES:\n');
    highQualityExamples.forEach((example, idx) => {
      console.log(`${idx + 1}. ${example}\n`);
    });
  }

  if (issuesFound.length > 0) {
    console.log('⚠️  ISSUES IDENTIFIED:\n');
    issuesFound.forEach(issue => {
      console.log(`   ${issue}`);
    });
    console.log('');
  } else {
    console.log('✅ No issues identified - All sampled tools meet quality standards!\n');
  }

  // Final recommendation
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('RECOMMENDATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  if (avgQualityScore >= 97.5 && issuesFound.length === 0) {
    console.log('✅ READY FOR PRODUCTION');
    console.log('All sampled tools meet Phase 4-6 quality standards.');
    console.log('Phase 7A enhancements are production-ready.');
  } else if (avgQualityScore >= 90) {
    console.log('⚠️  MINOR FIXES RECOMMENDED');
    console.log('Quality is good but some minor improvements would be beneficial.');
  } else {
    console.log('❌ FIXES REQUIRED');
    console.log('Quality does not meet Phase 4-6 standards. Review and fix issues.');
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

sampleQualityCheck().catch(console.error);
