#!/usr/bin/env tsx
/**
 * Analyze Available Metrics in Tools
 *
 * Check what data is actually available across all tools
 * to understand what the ranking algorithm can work with
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function analyzeAvailableMetrics() {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection not available');
    process.exit(1);
  }

  console.log('🔍 Analyzing available metrics across all tools...\n');

  try {
    const allTools = await db
      .select()
      .from(tools)
      .where(eq(tools.status, 'active'));

    console.log(`Total active tools: ${allTools.length}\n`);
    console.log('='.repeat(80));

    // Track what fields are available
    const fieldStats = {
      features_count: new Map<number, number>(),
      has_metrics: 0,
      has_technical: 0,
      has_github_data: 0,
      has_swe_bench: 0,
      has_news_mentions: 0,
      categories: new Map<string, number>(),
      features_histogram: new Map<string, number>(),
    };

    const sampleTools = {
      with_metrics: null as any,
      with_technical: null as any,
      with_swe_bench: null as any,
      minimal_data: null as any,
    };

    for (const tool of allTools) {
      const data = tool.data as any;

      // Features
      const featureCount = data.features?.length || 0;
      fieldStats.features_count.set(
        featureCount,
        (fieldStats.features_count.get(featureCount) || 0) + 1
      );

      // Metrics
      if (data.metrics) {
        fieldStats.has_metrics++;
        if (!sampleTools.with_metrics) {
          sampleTools.with_metrics = { slug: tool.slug, data };
        }

        if (data.metrics.swe_bench) {
          fieldStats.has_swe_bench++;
          if (!sampleTools.with_swe_bench) {
            sampleTools.with_swe_bench = { slug: tool.slug, data };
          }
        }

        if (data.metrics.news_mentions) {
          fieldStats.has_news_mentions++;
        }

        if (data.metrics.github_stars) {
          fieldStats.has_github_data++;
        }
      }

      // Technical
      if (data.technical) {
        fieldStats.has_technical++;
        if (!sampleTools.with_technical) {
          sampleTools.with_technical = { slug: tool.slug, data };
        }
      }

      // Categories
      fieldStats.categories.set(
        tool.category,
        (fieldStats.categories.get(tool.category) || 0) + 1
      );

      // Minimal data example
      if (!data.metrics && !data.technical && !sampleTools.minimal_data) {
        sampleTools.minimal_data = { slug: tool.slug, data };
      }
    }

    // Report
    console.log('\n📊 DATA AVAILABILITY REPORT\n');
    console.log('Features Distribution:');
    const sortedFeatures = Array.from(fieldStats.features_count.entries())
      .sort((a, b) => a[0] - b[0]);
    for (const [count, tools_with_count] of sortedFeatures) {
      const percentage = ((tools_with_count / allTools.length) * 100).toFixed(1);
      console.log(`   ${String(count).padStart(3)} features: ${String(tools_with_count).padStart(3)} tools (${percentage}%)`);
    }

    console.log(`\nMetrics Availability:`);
    console.log(`   Has metrics object:    ${fieldStats.has_metrics} (${((fieldStats.has_metrics / allTools.length) * 100).toFixed(1)}%)`);
    console.log(`   Has technical object:  ${fieldStats.has_technical} (${((fieldStats.has_technical / allTools.length) * 100).toFixed(1)}%)`);
    console.log(`   Has SWE-bench scores:  ${fieldStats.has_swe_bench} (${((fieldStats.has_swe_bench / allTools.length) * 100).toFixed(1)}%)`);
    console.log(`   Has news mentions:     ${fieldStats.has_news_mentions} (${((fieldStats.has_news_mentions / allTools.length) * 100).toFixed(1)}%)`);
    console.log(`   Has GitHub data:       ${fieldStats.has_github_data} (${((fieldStats.has_github_data / allTools.length) * 100).toFixed(1)}%)`);

    console.log(`\nCategory Distribution:`);
    const sortedCategories = Array.from(fieldStats.categories.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sortedCategories) {
      const percentage = ((count / allTools.length) * 100).toFixed(1);
      console.log(`   ${category.padEnd(25)}: ${String(count).padStart(3)} tools (${percentage}%)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SAMPLE DATA STRUCTURES\n');

    if (sampleTools.with_metrics) {
      console.log(`Tool with metrics (${sampleTools.with_metrics.slug}):`);
      console.log(`   Metrics keys: ${Object.keys(sampleTools.with_metrics.data.metrics).join(', ')}`);
    }

    if (sampleTools.with_technical) {
      console.log(`\nTool with technical (${sampleTools.with_technical.slug}):`);
      console.log(`   Technical keys: ${Object.keys(sampleTools.with_technical.data.technical).join(', ')}`);
    }

    if (sampleTools.with_swe_bench) {
      console.log(`\nTool with SWE-bench (${sampleTools.with_swe_bench.slug}):`);
      console.log(`   SWE-bench: ${JSON.stringify(sampleTools.with_swe_bench.data.metrics.swe_bench)}`);
    }

    if (sampleTools.minimal_data) {
      console.log(`\nTool with minimal data (${sampleTools.minimal_data.slug}):`);
      console.log(`   Available keys: ${Object.keys(sampleTools.minimal_data.data).join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 KEY FINDINGS:\n');

    const metricsPercentage = (fieldStats.has_metrics / allTools.length) * 100;
    const sweBenchPercentage = (fieldStats.has_swe_bench / allTools.length) * 100;

    if (metricsPercentage < 50) {
      console.log(`⚠️  Only ${metricsPercentage.toFixed(1)}% of tools have metrics data`);
      console.log(`   Algorithm relies heavily on defaults and category bonuses`);
    }

    if (sweBenchPercentage < 10) {
      console.log(`⚠️  Only ${sweBenchPercentage.toFixed(1)}% of tools have SWE-bench scores`);
      console.log(`   Agentic capability scoring is mostly category-based`);
    }

    const uniqueFeatureCounts = fieldStats.features_count.size;
    if (uniqueFeatureCounts < 5) {
      console.log(`⚠️  Low feature count variety (only ${uniqueFeatureCounts} unique counts)`);
      console.log(`   Many tools will get same innovation scores`);
    }

    console.log('\n='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error analyzing metrics:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

analyzeAvailableMetrics();
