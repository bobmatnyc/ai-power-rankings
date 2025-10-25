#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyV0Details() {
  const db = getDb();

  console.log("🔍 Verifying v0 tool update details...\n");
  console.log("=".repeat(80));

  const result = await db
    .select()
    .from(tools)
    .where(eq(tools.slug, "v0-vercel"));

  if (result.length === 0) {
    console.log("❌ v0 tool not found!");
    return;
  }

  const tool = result[0];
  const data = tool.data as Record<string, any>;

  console.log(`\n✅ Tool: ${tool.name}`);
  console.log(`📦 Slug: ${tool.slug}`);
  console.log(`📂 Category: ${tool.category}`);
  console.log(`\n${"=".repeat(80)}\n`);

  console.log("🏢 COMPANY INFORMATION:");
  console.log(`  Company: ${data.company}`);
  console.log(`  Website: ${data.website}`);
  console.log(`  Launch Year: ${data.launch_year || 'N/A'}`);
  console.log(`  Updated 2025: ${data.updated_2025 ? 'Yes' : 'No'}`);

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("📝 OVERVIEW:");
  console.log(`  ${data.overview}`);
  console.log(`  (${data.overview.split(' ').length} words)`);

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("💰 PRICING STRUCTURE:");
  console.log(`  Model: ${data.pricing?.model || 'N/A'}`);
  if (data.pricing?.tiers) {
    console.log(`  Tiers: ${data.pricing.tiers.length}`);
    data.pricing.tiers.forEach((tier: any, index: number) => {
      console.log(`\n  Tier ${index + 1}: ${tier.name}`);
      console.log(`    Price: ${tier.price}`);
      if (tier.credits) console.log(`    Credits: ${tier.credits}`);
      if (tier.recommended) console.log(`    ⭐ RECOMMENDED`);
      console.log(`    Features: ${tier.features.length}`);
      tier.features.forEach((feature: string) => {
        console.log(`      • ${feature}`);
      });
    });
  }

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("⚡ KEY FEATURES:");
  if (data.features && Array.isArray(data.features)) {
    console.log(`  Total: ${data.features.length} features`);
    data.features.forEach((feature: string, index: number) => {
      console.log(`  ${index + 1}. ${feature}`);
    });
  }

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("🎯 TARGET AUDIENCE:");
  console.log(`  ${data.target_audience || 'N/A'}`);

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("💼 USE CASES:");
  if (data.use_cases && Array.isArray(data.use_cases)) {
    console.log(`  Total: ${data.use_cases.length} use cases`);
    data.use_cases.forEach((useCase: string, index: number) => {
      console.log(`  ${index + 1}. ${useCase}`);
    });
  }

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("🔌 INTEGRATIONS:");
  if (data.integrations && Array.isArray(data.integrations)) {
    console.log(`  Total: ${data.integrations.length} integrations`);
    data.integrations.forEach((integration: string) => {
      console.log(`  • ${integration}`);
    });
  }

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("📅 METADATA:");
  console.log(`  Created: ${tool.createdAt}`);
  console.log(`  Updated: ${tool.updatedAt}`);

  console.log(`\n${"=".repeat(80)}\n`);
  console.log("✅ VERIFICATION COMPLETE");
  console.log(`\n${"=".repeat(80)}\n`);
}

verifyV0Details()
  .catch(console.error)
  .finally(() => closeDb());
