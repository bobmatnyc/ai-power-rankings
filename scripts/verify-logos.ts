#!/usr/bin/env node

/**
 * Script to verify logo collection status
 * Checks database entries and file system
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface ToolData {
  logo_url?: string;
  website?: string;
  github_url?: string;
  [key: string]: any;
}

async function verifyLogos() {
  try {
    console.log('🔍 Verifying logo collection status...\n');

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Get all active tools
    const allTools = await db
      .select()
      .from(tools)
      .where(eq(tools.status, 'active'));

    console.log(`📦 Total active tools: ${allTools.length}\n`);

    // Categorize tools
    const withLogos: any[] = [];
    const withoutLogos: any[] = [];
    const brokenLogos: any[] = [];

    const toolsDir = path.join(process.cwd(), 'public', 'tools');

    for (const tool of allTools) {
      const toolData = tool.data as ToolData;

      if (toolData.logo_url) {
        // Verify file exists
        const logoPath = path.join(process.cwd(), 'public', toolData.logo_url);
        if (fs.existsSync(logoPath)) {
          withLogos.push(tool);
        } else {
          brokenLogos.push(tool);
        }
      } else {
        withoutLogos.push(tool);
      }
    }

    // Count files in directory
    const logoFiles = fs.existsSync(toolsDir)
      ? fs.readdirSync(toolsDir).filter(f => f.endsWith('.png'))
      : [];

    console.log(`${'='.repeat(60)}`);
    console.log(`📊 VERIFICATION RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Tools with valid logos: ${withLogos.length}`);
    console.log(`❌ Tools without logos: ${withoutLogos.length}`);
    console.log(`⚠️  Tools with broken logo links: ${brokenLogos.length}`);
    console.log(`📁 Logo files in /public/tools/: ${logoFiles.length}`);
    console.log(`📈 Coverage: ${((withLogos.length / allTools.length) * 100).toFixed(1)}%`);

    if (withoutLogos.length > 0) {
      console.log(`\n❌ Tools without logos (${withoutLogos.length}):`);
      withoutLogos.forEach(tool => {
        const toolData = tool.data as ToolData;
        const url = toolData.website || toolData.github_url || 'No URL';
        console.log(`   - ${tool.name} (${tool.slug}) - ${url}`);
      });
    }

    if (brokenLogos.length > 0) {
      console.log(`\n⚠️  Tools with broken logo links (${brokenLogos.length}):`);
      brokenLogos.forEach(tool => {
        const toolData = tool.data as ToolData;
        console.log(`   - ${tool.name}: ${toolData.logo_url}`);
      });
    }

    if (withLogos.length > 0) {
      console.log(`\n✅ Sample of tools with logos (first 10):`);
      withLogos.slice(0, 10).forEach(tool => {
        const toolData = tool.data as ToolData;
        console.log(`   - ${tool.name}: ${toolData.logo_url}`);
      });
    }

    console.log(`\n📁 Logo files in directory:`);
    if (logoFiles.length > 0) {
      logoFiles.slice(0, 10).forEach(file => {
        const filePath = path.join(toolsDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`   - ${file} (${sizeKB} KB)`);
      });
      if (logoFiles.length > 10) {
        console.log(`   ... and ${logoFiles.length - 10} more files`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  verifyLogos()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { verifyLogos };
