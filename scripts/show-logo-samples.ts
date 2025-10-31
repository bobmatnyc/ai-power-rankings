#!/usr/bin/env node

/**
 * Script to display sample tools with logos
 * Shows database structure with logo_url field
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ToolData {
  logo_url?: string;
  website?: string;
  github_url?: string;
  description?: string;
  [key: string]: any;
}

async function showLogoSamples() {
  try {
    console.log('📊 Sample Tools with Logos\n');
    console.log(`${'='.repeat(80)}\n`);

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Get all active tools
    const allTools = await db
      .select()
      .from(tools)
      .where(eq(tools.status, 'active'));

    // Filter tools with logos
    const toolsWithLogos = allTools.filter((tool) => {
      const toolData = tool.data as ToolData;
      return toolData.logo_url;
    });

    // Show first 15 as samples
    const samples = toolsWithLogos.slice(0, 15);

    samples.forEach((tool, index) => {
      const toolData = tool.data as ToolData;

      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Slug: ${tool.slug}`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Logo URL: ${toolData.logo_url}`);
      console.log(`   Website: ${toolData.website || toolData.github_url || 'N/A'}`);
      console.log();
    });

    console.log(`${'='.repeat(80)}`);
    console.log(`Showing ${samples.length} of ${toolsWithLogos.length} tools with logos`);
    console.log(`Total active tools: ${allTools.length}`);
    console.log(`Coverage: ${((toolsWithLogos.length / allTools.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  showLogoSamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { showLogoSamples };
