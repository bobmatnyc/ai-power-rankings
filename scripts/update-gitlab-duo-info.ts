#!/usr/bin/env tsx

/**
 * Update GitLab Duo Information
 *
 * Adds comprehensive company, logo, pricing, and description information for GitLab Duo,
 * GitLab's AI-native assistant suite integrated across the software development lifecycle.
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function updateGitLabDuo() {
  const db = getDb();
  const slug = "gitlab-duo";

  console.log("🔧 Updating GitLab Duo Information\n");
  console.log("=".repeat(80));

  // Get existing tool data
  const result = await db.select().from(tools).where(eq(tools.slug, slug));

  if (result.length === 0) {
    console.log("❌ GitLab Duo tool not found!");
    return { success: false, error: "Tool not found" };
  }

  const existingTool = result[0];
  const existingData = existingTool.data as Record<string, any>;

  console.log("\n📋 Current Data:");
  console.log(`  Name: ${existingTool.name}`);
  console.log(`  Category: ${existingTool.category}`);
  console.log(`  Company: ${existingData.company || 'Not set'}`);
  console.log(`  Logo: ${existingData.logo_url || 'Not set'}`);

  // Prepare updated data
  const updatedData = {
    ...existingData,
    company: "GitLab",
    logo_url: "https://res.cloudinary.com/about-gitlab-com/image/upload/v1753720689/somrf9zaunk0xlt7ne4x.svg",
    website_url: "https://about.gitlab.com/",
    docs_url: "https://docs.gitlab.com/user/gitlab_duo/",
    summary: "GitLab Duo is a suite of AI-native features that assist you while you work in GitLab, aiming to help increase velocity and solve key pain points across the software development lifecycle.",
    description: "GitLab Duo provides AI-assisted code generation, vulnerability detection, test automation, and root cause analysis, all integrated within IDEs and the GitLab UI. Features include GitLab Duo Chat (a natural language assistant) and the GitLab Duo Agent Platform with specialized AI agents for testing, security scanning, and code review. Available with GitLab Premium and Ultimate tiers.",
    business: {
      ...(existingData.business || {}),
      pricing_model: "subscription",
      base_price: 29,
      pricing_details: {
        premium: "$29/user/month - includes Duo Code Suggestions and Chat",
        ultimate: "$99/user/month - includes Duo Code Suggestions and Chat",
        duo_pro: "$19/month - additional Duo Pro features",
        duo_enterprise: "Custom pricing - Enterprise features",
        note: "Duo Code Suggestions and Chat included in Premium and Ultimate as of GitLab 18.0 (June 2025)",
      },
    },
    features: [
      ...(existingData.features || []),
      "AI-assisted code generation",
      "Vulnerability detection",
      "Test automation",
      "Root cause analysis",
      "GitLab Duo Chat (natural language assistant)",
      "GitLab Duo Agent Platform",
      "Integrated in IDEs and GitLab UI",
      "Specialized AI agents for testing and security",
      "Code review automation",
      "DevSecOps acceleration",
    ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
  };

  // Update database
  const updateResult = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, slug))
    .returning();

  console.log("\n✅ Updated Data:");
  console.log(`  Company: ${updatedData.company}`);
  console.log(`  Logo: ${updatedData.logo_url}`);
  console.log(`  Website: ${updatedData.website_url}`);
  console.log(`  Docs: ${updatedData.docs_url}`);
  console.log(`  Pricing Model: ${updatedData.business.pricing_model}`);
  console.log(`  Base Price: $${updatedData.business.base_price}/user/month`);
  console.log(`  Features Count: ${updatedData.features.length}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ GitLab Duo information updated successfully!\n");

  return { success: true, data: updateResult[0] };
}

async function main() {
  try {
    await updateGitLabDuo();
  } catch (error) {
    console.error("\n❌ Error updating GitLab Duo:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
