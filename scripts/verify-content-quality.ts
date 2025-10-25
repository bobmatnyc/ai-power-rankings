#!/usr/bin/env tsx

/**
 * Content Quality Verification Script
 * Checks for placeholders, 2025 updates, and content quality
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

async function contentQualityCheck() {
  const db = getDb();
  const PHASE1_TOOLS = ['github-copilot', 'cursor', 'replit-agent', 'claude-code', 'devin'];

  const results = await db.select().from(tools).where(inArray(tools.slug, PHASE1_TOOLS));

  console.log("\n" + "=".repeat(80));
  console.log("📝 CONTENT QUALITY VERIFICATION");
  console.log("=".repeat(80) + "\n");

  const placeholderPatterns = ['N/A', 'TBD', 'TODO', 'placeholder', 'example', 'Lorem ipsum'];

  for (const tool of results) {
    const toolData = tool.data as Record<string, any>;
    console.log(`\n📋 ${tool.name}`);
    console.log("─".repeat(80));

    // Check for placeholders
    const fullContent = JSON.stringify(toolData).toLowerCase();
    const foundPlaceholders = placeholderPatterns.filter(p => fullContent.includes(p.toLowerCase()));

    console.log(`   Placeholder Check: ${foundPlaceholders.length === 0 ? '✅ PASS' : '⚠️  Found: ' + foundPlaceholders.join(', ')}`);

    // Check overview quality
    const overview = toolData.overview || '';
    const overviewWords = overview.split(/\s+/).length;
    console.log(`   Overview Length: ${overview.length} chars, ${overviewWords} words ${overviewWords >= 100 ? '✅' : '⚠️'}`);

    // Check for 2025 updates
    const has2025Content = overview.includes('2025') || overview.includes('May 2025') || overview.includes('October 2025');
    console.log(`   2025 Updates: ${has2025Content ? '✅ PASS' : '⚠️  None found'}`);

    // Sample pricing
    const pricingTiers = toolData.pricing?.tiers || [];
    console.log(`   Pricing Tiers: ${pricingTiers.length} tiers`);
    if (pricingTiers.length > 0) {
      const firstTier = pricingTiers[0];
      console.log(`      - Example: ${firstTier.name} @ ${firstTier.price}`);
    }

    // Sample features
    const features = toolData.features || [];
    console.log(`   Features: ${features.length} total`);
    if (features.length > 0) {
      console.log(`      - Examples: ${features.slice(0, 3).join(', ')}`);
    }

    // Check critical fields
    const hasCompany = Boolean(toolData.company && toolData.company !== 'N/A');
    const hasWebsite = Boolean(toolData.website);
    const hasTargetAudience = Boolean(toolData.target_audience);
    const hasUseCases = Array.isArray(toolData.use_cases) && toolData.use_cases.length >= 5;

    const criticalFields = {
      'Company': hasCompany,
      'Website': hasWebsite,
      'Target Audience': hasTargetAudience,
      'Use Cases': hasUseCases
    };

    console.log(`   Critical Fields:`);
    Object.entries(criticalFields).forEach(([field, pass]) => {
      console.log(`      - ${field}: ${pass ? '✅' : '❌'}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  closeDb();
}

contentQualityCheck().catch(console.error);
