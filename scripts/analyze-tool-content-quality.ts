#!/usr/bin/env tsx

/**
 * Analyze All Tools for Content Quality and Completeness
 *
 * This script scans all tools in the database and identifies:
 * - Missing company information
 * - Blank or missing overview fields
 * - Incomplete descriptions
 * - Missing metadata
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";

interface ContentIssue {
  slug: string;
  name: string;
  category: string;
  issues: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

async function analyzeToolContentQuality() {
  const db = getDb();

  console.log("🔍 Analyzing tool content quality...\n");
  console.log("=".repeat(80));

  // Get all active tools
  const allTools = await db.select().from(tools);

  console.log(`📊 Total tools found: ${allTools.length}\n`);

  const issues: ContentIssue[] = [];

  for (const tool of allTools) {
    const toolIssues: string[] = [];
    const data = tool.data as Record<string, any>;

    // Check for missing company
    if (!data.company || data.company === 'N/A' || data.company.trim() === '') {
      toolIssues.push('Missing company information');
    }

    // Check for missing overview
    if (!data.overview || data.overview.trim() === '') {
      toolIssues.push('Missing overview');
    } else if (data.overview.length < 50) {
      toolIssues.push('Overview too short (< 50 chars)');
    }

    // Check for missing description
    if (!data.description || data.description.trim() === '') {
      toolIssues.push('Missing description');
    } else if (data.description.length < 50) {
      toolIssues.push('Description too short (< 50 chars)');
    }

    // Check for missing website
    if (!data.website || data.website.trim() === '') {
      toolIssues.push('Missing website URL');
    }

    // Check for missing pricing info
    if (!data.pricing || !data.pricing.model) {
      toolIssues.push('Missing pricing information');
    }

    // Check for missing features
    if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
      toolIssues.push('Missing key features');
    }

    // Check for missing target audience
    if (!data.target_audience || data.target_audience.trim() === '') {
      toolIssues.push('Missing target audience');
    }

    if (toolIssues.length > 0) {
      // Determine priority
      let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';

      if (toolIssues.some(i => i.includes('Missing overview') || i.includes('Missing company'))) {
        priority = 'critical';
      } else if (toolIssues.some(i => i.includes('Missing description') || i.includes('Missing website'))) {
        priority = 'high';
      } else if (toolIssues.length >= 3) {
        priority = 'medium';
      }

      issues.push({
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        issues: toolIssues,
        priority,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Display results
  console.log("\n" + "=".repeat(80));
  console.log("📋 CONTENT QUALITY ANALYSIS RESULTS\n");

  console.log(`✅ Tools with complete content: ${allTools.length - issues.length}/${allTools.length}`);
  console.log(`⚠️  Tools with issues: ${issues.length}/${allTools.length}\n`);

  // Group by priority
  const criticalIssues = issues.filter(i => i.priority === 'critical');
  const highIssues = issues.filter(i => i.priority === 'high');
  const mediumIssues = issues.filter(i => i.priority === 'medium');
  const lowIssues = issues.filter(i => i.priority === 'low');

  if (criticalIssues.length > 0) {
    console.log("🔴 CRITICAL PRIORITY (" + criticalIssues.length + " tools)");
    console.log("-".repeat(80));
    criticalIssues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.name} (${issue.slug})`);
      console.log(`   Category: ${issue.category}`);
      console.log(`   Issues:`);
      issue.issues.forEach(i => console.log(`   - ${i}`));
    });
    console.log();
  }

  if (highIssues.length > 0) {
    console.log("\n🟡 HIGH PRIORITY (" + highIssues.length + " tools)");
    console.log("-".repeat(80));
    highIssues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. ${issue.name} (${issue.slug})`);
      console.log(`   Category: ${issue.category}`);
      console.log(`   Issues:`);
      issue.issues.forEach(i => console.log(`   - ${i}`));
    });
    console.log();
  }

  if (mediumIssues.length > 0) {
    console.log("\n🟠 MEDIUM PRIORITY (" + mediumIssues.length + " tools)");
    console.log("-".repeat(80));
    mediumIssues.slice(0, 10).forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue.name} (${issue.slug}) - ${issue.issues.length} issues`);
    });
    if (mediumIssues.length > 10) {
      console.log(`... and ${mediumIssues.length - 10} more`);
    }
    console.log();
  }

  if (lowIssues.length > 0) {
    console.log("\n🟢 LOW PRIORITY (" + lowIssues.length + " tools)");
    console.log("-".repeat(80));
    lowIssues.slice(0, 10).forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue.name} (${issue.slug}) - ${issue.issues.length} issues`);
    });
    if (lowIssues.length > 10) {
      console.log(`... and ${lowIssues.length - 10} more`);
    }
    console.log();
  }

  // Special focus on v0
  console.log("\n" + "=".repeat(80));
  console.log("🎯 SPECIAL FOCUS: v0 TOOL\n");

  const v0Tool = allTools.find(t => t.slug === 'v0');
  if (v0Tool) {
    const v0Data = v0Tool.data as Record<string, any>;
    const v0Issue = issues.find(i => i.slug === 'v0');

    console.log(`Name: ${v0Tool.name}`);
    console.log(`Category: ${v0Tool.category}`);
    console.log(`Company: ${v0Data.company || 'MISSING'}`);
    console.log(`Website: ${v0Data.website || 'MISSING'}`);
    console.log(`Description: ${v0Data.description || 'MISSING'}`);
    console.log(`Overview: ${v0Data.overview || 'MISSING'}`);

    if (v0Issue) {
      console.log(`\n⚠️  Issues found:`);
      v0Issue.issues.forEach(i => console.log(`   - ${i}`));
      console.log(`Priority: ${v0Issue.priority.toUpperCase()}`);
    } else {
      console.log(`\n✅ No content issues found!`);
    }
  } else {
    console.log("❌ v0 tool not found in database!");
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✨ Analysis complete!\n");

  return issues;
}

// Run the script
analyzeToolContentQuality()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
