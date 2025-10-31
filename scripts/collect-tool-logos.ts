#!/usr/bin/env node

/**
 * Script to collect and store logos for AI tools
 * Strategy:
 * 1. Use Clearbit Logo API: https://logo.clearbit.com/{domain}
 * 2. Fallback to Google Favicon API: https://www.google.com/s2/favicons?domain={domain}&sz=256
 * 3. Store in /public/tools/ directory
 * 4. Update database with logo URLs
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq, isNull, or } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface ToolData {
  website?: string;
  github_url?: string;
  logo_url?: string;
  [key: string]: any;
}

async function downloadLogo(url: string, toolSlug: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    // Check if response is actually an image (not an error page)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const filename = `${toolSlug}.png`;
    const filepath = path.join(process.cwd(), 'public', 'tools', filename);

    fs.writeFileSync(filepath, Buffer.from(buffer));
    return `/tools/${filename}`;
  } catch (error) {
    return null;
  }
}

function extractDomain(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

async function getLogoForTool(tool: any): Promise<string | null> {
  const toolData = tool.data as ToolData;

  // Skip if tool already has a logo
  if (toolData.logo_url) {
    console.log(`  ⏭️  Already has logo: ${toolData.logo_url}`);
    return null;
  }

  // Extract domain from website or github URL
  const websiteUrl = toolData.website || toolData.github_url;
  if (!websiteUrl) {
    console.log(`  ❌ No website or GitHub URL found`);
    return null;
  }

  const domain = extractDomain(websiteUrl);
  if (!domain) {
    console.log(`  ❌ Could not extract domain from: ${websiteUrl}`);
    return null;
  }

  console.log(`\n🔍 Trying ${tool.name} (${tool.slug})...`);
  console.log(`  Domain: ${domain}`);

  // Try Clearbit first
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  console.log(`  🔍 Trying Clearbit...`);
  const clearbitLogo = await downloadLogo(clearbitUrl, tool.slug);
  if (clearbitLogo) {
    console.log(`  ✅ Success via Clearbit`);
    return clearbitLogo;
  }

  // Fallback to Google Favicon
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  console.log(`  🔍 Trying Google Favicon...`);
  const faviconLogo = await downloadLogo(faviconUrl, tool.slug);
  if (faviconLogo) {
    console.log(`  ✅ Success via Google Favicon`);
    return faviconLogo;
  }

  console.log(`  ❌ No logo found`);
  return null;
}

async function collectLogos() {
  try {
    console.log('🚀 Starting logo collection...\n');

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    console.log('🔍 Finding tools without logos...');

    // Get all active tools
    const allTools = await db
      .select()
      .from(tools)
      .where(eq(tools.status, 'active'));

    console.log(`📦 Total active tools: ${allTools.length}`);

    // Filter tools without logos
    const toolsWithoutLogos = allTools.filter((tool) => {
      const toolData = tool.data as ToolData;
      return !toolData.logo_url;
    });

    console.log(`📊 Tools without logos: ${toolsWithoutLogos.length}`);
    console.log(`✅ Tools with logos: ${allTools.length - toolsWithoutLogos.length}\n`);

    if (toolsWithoutLogos.length === 0) {
      console.log('🎉 All tools already have logos!');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const successfulTools: string[] = [];
    const failedTools: string[] = [];

    for (const tool of toolsWithoutLogos) {
      const logoUrl = await getLogoForTool(tool);

      if (logoUrl) {
        // Update database with logo URL
        const toolData = tool.data as ToolData;
        await db
          .update(tools)
          .set({
            data: { ...toolData, logo_url: logoUrl },
            updatedAt: new Date(),
          })
          .where(eq(tools.id, tool.id));

        successCount++;
        successfulTools.push(tool.name);
      } else {
        failCount++;
        failedTools.push(tool.name);
      }

      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 FINAL RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${((successCount / toolsWithoutLogos.length) * 100).toFixed(1)}%`);

    if (successfulTools.length > 0) {
      console.log(`\n✅ Successfully downloaded logos for:`);
      successfulTools.forEach(name => console.log(`   - ${name}`));
    }

    if (failedTools.length > 0) {
      console.log(`\n❌ Failed to get logos for:`);
      failedTools.forEach(name => console.log(`   - ${name}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  collectLogos()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { collectLogos };
