#!/usr/bin/env tsx
/**
 * Data-Driven Tool Verification Script
 *
 * Usage: npx tsx scripts/verify-tools.ts --slugs coderabbit,snyk-code
 * Usage: npx tsx scripts/verify-tools.ts --all
 *
 * This script verifies tool data in the database and checks content quality.
 * Replaces multiple phase-specific verification scripts with a single parametrized approach.
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { inArray, eq } from 'drizzle-orm';

interface QualityMetrics {
  hasCompany: boolean;
  hasOverview: boolean;
  hasFeatures: boolean;
  hasPricing: boolean;
  hasUseCases: boolean;
  featureCount: number;
  useCaseCount: number;
  overviewLength: number;
  qualityScore: number;
}

function calculateQualityMetrics(toolData: any): QualityMetrics {
  const hasCompany = !!toolData.company;
  const hasOverview = !!toolData.overview && toolData.overview.length > 100;
  const hasFeatures = Array.isArray(toolData.features) && toolData.features.length > 0;
  const hasPricing = !!toolData.pricing || !!toolData.pricing_model;
  const hasUseCases = Array.isArray(toolData.use_cases) && toolData.use_cases.length > 0;

  const featureCount = Array.isArray(toolData.features) ? toolData.features.length : 0;
  const useCaseCount = Array.isArray(toolData.use_cases) ? toolData.use_cases.length : 0;
  const overviewLength = toolData.overview ? toolData.overview.length : 0;

  // Calculate quality score (0-100)
  let score = 0;
  if (hasCompany) score += 15;
  if (hasOverview) score += 25;
  if (hasFeatures) score += 20;
  if (hasPricing) score += 15;
  if (hasUseCases) score += 15;
  if (featureCount >= 10) score += 5;
  if (useCaseCount >= 5) score += 5;

  return {
    hasCompany,
    hasOverview,
    hasFeatures,
    hasPricing,
    hasUseCases,
    featureCount,
    useCaseCount,
    overviewLength,
    qualityScore: score
  };
}

async function verifyTools(slugs: string[] | 'all') {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  try {
    console.log('\n🔍 Verifying tool content quality...\n');

    // Fetch tools
    let toolRecords;
    if (slugs === 'all') {
      toolRecords = await db.select().from(tools);
      console.log(`📦 Verifying all ${toolRecords.length} tools\n`);
    } else {
      toolRecords = await db.select().from(tools).where(inArray(tools.slug, slugs));
      console.log(`📦 Verifying ${slugs.length} tool(s): ${slugs.join(', ')}\n`);
    }

    if (toolRecords.length === 0) {
      console.log('⚠️  No tools found');
      return;
    }

    const results: Array<{ slug: string; name: string; metrics: QualityMetrics }> = [];

    for (const tool of toolRecords) {
      const metrics = calculateQualityMetrics(tool.data);
      results.push({
        slug: tool.slug,
        name: tool.data.name || tool.slug,
        metrics
      });
    }

    // Sort by quality score descending
    results.sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore);

    // Display results
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                     TOOL CONTENT QUALITY REPORT                      │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');

    for (const result of results) {
      const { slug, name, metrics } = result;
      const scoreColor = metrics.qualityScore >= 80 ? '✅' :
                         metrics.qualityScore >= 60 ? '⚠️ ' :
                         '❌';

      console.log(`\n${scoreColor} ${name} (${slug})`);
      console.log(`   Quality Score: ${metrics.qualityScore}/100`);
      console.log(`   Company: ${metrics.hasCompany ? '✓' : '✗'}`);
      console.log(`   Overview: ${metrics.hasOverview ? '✓' : '✗'} (${metrics.overviewLength} chars)`);
      console.log(`   Features: ${metrics.hasFeatures ? '✓' : '✗'} (${metrics.featureCount})`);
      console.log(`   Pricing: ${metrics.hasPricing ? '✓' : '✗'}`);
      console.log(`   Use Cases: ${metrics.hasUseCases ? '✓' : '✗'} (${metrics.useCaseCount})`);
    }

    console.log('\n└─────────────────────────────────────────────────────────────────────┘');

    // Summary statistics
    const avgScore = results.reduce((sum, r) => sum + r.metrics.qualityScore, 0) / results.length;
    const highQuality = results.filter(r => r.metrics.qualityScore >= 80).length;
    const mediumQuality = results.filter(r => r.metrics.qualityScore >= 60 && r.metrics.qualityScore < 80).length;
    const lowQuality = results.filter(r => r.metrics.qualityScore < 60).length;

    console.log('\n📊 Summary:');
    console.log(`   Average Quality Score: ${avgScore.toFixed(1)}/100`);
    console.log(`   ✅ High Quality (≥80): ${highQuality}`);
    console.log(`   ⚠️  Medium Quality (60-79): ${mediumQuality}`);
    console.log(`   ❌ Low Quality (<60): ${lowQuality}`);
    console.log(`   📦 Total Tools: ${results.length}\n`);

  } catch (error) {
    console.error('❌ Error verifying tools:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--all')) {
  verifyTools('all');
} else {
  const slugsIndex = args.indexOf('--slugs');

  if (slugsIndex === -1 || slugsIndex === args.length - 1) {
    console.error('Usage: npx tsx scripts/verify-tools.ts --slugs <slug1,slug2,...>');
    console.error('   or: npx tsx scripts/verify-tools.ts --all');
    console.error('\nExample: npx tsx scripts/verify-tools.ts --slugs coderabbit,snyk-code');
    process.exit(1);
  }

  const slugs = args[slugsIndex + 1].split(',').map(s => s.trim());
  verifyTools(slugs);
}
