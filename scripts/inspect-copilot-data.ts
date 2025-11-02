#!/usr/bin/env tsx

/**
 * Inspect GitHub Copilot's Raw Data
 *
 * Shows all the data we have for GitHub Copilot to understand
 * what's feeding into the innovation score.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function inspectCopilotData() {
  const db = getDb();
  console.log("\n🔍 Inspecting GitHub Copilot's Raw Data\n");
  console.log("=".repeat(80));

  const result = await db
    .select()
    .from(tools)
    .where(eq(tools.slug, 'github-copilot'))
    .limit(1);

  if (result.length === 0) {
    console.log("❌ GitHub Copilot not found!");
    await closeDb();
    return;
  }

  const tool = result[0];
  const toolData = tool.data as any;

  console.log("\n📋 Basic Information:");
  console.log(`ID: ${tool.id}`);
  console.log(`Slug: ${tool.slug}`);
  console.log(`Name: ${tool.name}`);
  console.log(`Category: ${tool.category}`);
  console.log(`Status: ${tool.status}`);

  const info = toolData.info || {};

  console.log("\n📝 Description & Summary:");
  console.log(`Summary Length: ${(info.summary || '').length} chars`);
  console.log(`Description Length: ${(info.description || '').length} chars`);
  if (info.summary) {
    console.log(`Summary: ${info.summary.substring(0, 200)}...`);
  }

  console.log("\n🎯 Features:");
  const features = info.features || [];
  console.log(`Feature Count: ${features.length}`);
  if (features.length > 0) {
    features.forEach((f: string, idx: number) => {
      console.log(`  ${idx + 1}. ${f}`);
    });
  }

  console.log("\n🚀 Launch Information:");
  console.log(`Launch Year: ${info.launch_year || 'Not set'}`);
  console.log(`Company: ${info.company || 'Not set'}`);
  console.log(`Company Name: ${info.company_name || 'Not set'}`);

  console.log("\n⚙️  Technical Performance:");
  const technical = info.technical || {};
  console.log(`Context Window: ${technical.context_window || 'Not set'}`);
  console.log(`Max Context Window: ${technical.max_context_window || 'Not set'}`);
  console.log(`Multi-file Support: ${technical.multi_file_support || 'Not set'}`);
  console.log(`Language Support Count: ${(technical.language_support || []).length}`);
  console.log(`LLM Providers Count: ${(technical.llm_providers || []).length}`);

  console.log("\n🔬 Performance Innovations:");
  const performance = technical.performance || {};
  console.log(`Mixture of Experts: ${performance.mixture_of_experts || false}`);
  console.log(`Speculative Decoding: ${performance.speculative_decoding || false}`);
  console.log(`Indexing Speed: ${performance.indexing_speed || 'Not set'}`);
  console.log(`Caching Strategy: ${performance.caching_strategy || 'Not set'}`);

  console.log("\n📊 Metrics:");
  const metrics = info.metrics || {};
  console.log(`Users: ${metrics.users || 'Not set'}`);
  console.log(`GitHub Stars: ${metrics.github_stars || 'Not set'}`);
  console.log(`News Mentions: ${metrics.news_mentions || 'Not set'}`);
  console.log(`Monthly ARR: ${metrics.monthly_arr || 'Not set'}`);
  console.log(`Annual Recurring Revenue: ${metrics.annual_recurring_revenue || 'Not set'}`);
  console.log(`Valuation: ${metrics.valuation || 'Not set'}`);
  console.log(`Funding: ${metrics.funding || 'Not set'}`);

  console.log("\n💰 Business Information:");
  const business = info.business || {};
  console.log(`Pricing Model: ${business.pricing_model || 'Not set'}`);
  console.log(`Base Price: ${business.base_price || 'Not set'}`);
  console.log(`Free Tier: ${business.free_tier || 'Not set'}`);
  console.log(`Enterprise Pricing: ${business.enterprise_pricing || 'Not set'}`);

  console.log("\n🔍 Checking for Innovation Keywords:");
  const allText = `${info.summary || ''} ${info.description || ''}`;
  const innovativeKeywords = [
    "specification-driven",
    "autonomous",
    "agent",
    "mcp",
    "scaffolding",
    "multi-modal",
    "reasoning",
    "planning",
    "orchestration",
    "background agent",
    "speculative",
  ];

  const found = innovativeKeywords.filter(kw => allText.toLowerCase().includes(kw));
  console.log(`Found ${found.length} innovation keywords: ${found.join(', ') || 'None'}`);

  // Show where keywords appear
  if (found.length > 0) {
    console.log("\n📍 Keyword Context:");
    found.forEach(keyword => {
      const regex = new RegExp(`.{0,50}${keyword}.{0,50}`, 'i');
      const match = allText.match(regex);
      if (match) {
        console.log(`  "${keyword}": ...${match[0]}...`);
      }
    });
  }

  console.log("\n✅ Inspection Complete\n");
  await closeDb();
}

inspectCopilotData().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
