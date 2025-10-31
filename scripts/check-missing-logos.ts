#!/usr/bin/env node

/**
 * Script to check tools without logos and provide manual fix suggestions
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

async function checkMissingLogos() {
  try {
    console.log('🔍 Checking tools without logos...\n');

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Get all active tools
    const allTools = await db
      .select()
      .from(tools)
      .where(eq(tools.status, 'active'));

    // Filter tools without logos
    const toolsWithoutLogos = allTools.filter((tool) => {
      const toolData = tool.data as ToolData;
      return !toolData.logo_url;
    });

    console.log(`❌ Tools without logos: ${toolsWithoutLogos.length}\n`);
    console.log(`${'='.repeat(80)}\n`);

    for (const tool of toolsWithoutLogos) {
      const toolData = tool.data as ToolData;

      console.log(`📦 ${tool.name} (${tool.slug})`);
      console.log(`   Category: ${tool.category}`);
      console.log(`   Website: ${toolData.website || 'None'}`);
      console.log(`   GitHub: ${toolData.github_url || 'None'}`);
      console.log(`   Description: ${(toolData.description || '').substring(0, 100)}...`);
      console.log(`   Data keys: ${Object.keys(toolData).join(', ')}`);

      // Suggest potential logo sources
      console.log(`   \n   💡 Potential logo sources:`);
      if (toolData.website) {
        const domain = new URL(toolData.website).hostname.replace('www.', '');
        console.log(`      - Clearbit: https://logo.clearbit.com/${domain}`);
        console.log(`      - Favicon: https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
      } else if (toolData.github_url) {
        const domain = new URL(toolData.github_url).hostname.replace('www.', '');
        console.log(`      - Clearbit: https://logo.clearbit.com/${domain}`);
        console.log(`      - Favicon: https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
      } else {
        console.log(`      - ⚠️  No URL available - needs manual research`);
      }

      console.log(`\n${'-'.repeat(80)}\n`);
    }

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total tools without logos: ${toolsWithoutLogos.length}`);
    console.log(`\nRecommendations:`);
    console.log(`1. For tools with websites: Try manual downloads from their official sites`);
    console.log(`2. For deprecated/inactive tools: Consider removing or using placeholder`);
    console.log(`3. For tools without URLs: Research official websites and update data`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  checkMissingLogos()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { checkMissingLogos };
