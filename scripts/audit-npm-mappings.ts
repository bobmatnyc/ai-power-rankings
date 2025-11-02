#!/usr/bin/env tsx

/**
 * Audit npm Package Mappings
 * Identifies tools with potentially incorrect npm package mappings
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";

interface NpmMapping {
  name: string;
  slug: string;
  package: string;
  downloads: number;
  description: string;
  version: string;
}

async function main() {
  console.log("=== NPM PACKAGE MAPPINGS AUDIT ===\n");

  const db = getDb();
  const allTools = await db.select().from(tools);

  const toolsWithNpm = allTools
    .filter((tool) => {
      const data = tool.data as any;
      return data?.metrics?.npm;
    })
    .map((tool) => {
      const data = tool.data as any;
      const npm = data.metrics.npm;
      return {
        name: tool.name,
        slug: tool.slug,
        package: npm.package_name,
        downloads: npm.downloads_last_month,
        description: npm.description,
        version: npm.current_version,
      } as NpmMapping;
    })
    .sort((a, b) => b.downloads - a.downloads);

  console.log(`Total tools: ${allTools.length}`);
  console.log(`Tools with npm packages: ${toolsWithNpm.length}\n`);

  console.log("=== ALL NPM MAPPINGS (sorted by downloads) ===\n");

  toolsWithNpm.forEach((tool, idx) => {
    console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   Package: ${tool.package}`);
    console.log(`   Downloads/month: ${tool.downloads.toLocaleString()}`);
    console.log(`   Version: ${tool.version}`);
    console.log(`   Description: ${tool.description.substring(0, 100)}${tool.description.length > 100 ? "..." : ""}`);
    console.log("");
  });

  // Flag suspicious packages
  console.log("\n=== SUSPICIOUS PACKAGES (likely incorrect) ===\n");

  const suspicious = toolsWithNpm.filter((tool) => {
    const pkg = tool.package.toLowerCase();
    const desc = tool.description.toLowerCase();
    const name = tool.name.toLowerCase();

    // Generic SDK patterns
    const isGenericSDK =
      pkg.includes("/generative-ai") ||
      pkg.includes("/sdk") ||
      pkg === "canvas" ||
      pkg === "ai" ||
      pkg === "openai" ||
      pkg === "@anthropic-ai/sdk";

    // Very high downloads (>1M) suggest generic package
    const veryHighDownloads = tool.downloads > 1000000;

    // Description doesn't mention tool name
    const toolWords = name.split(/\s+/).filter((w) => w.length > 3);
    const descriptionMismatch = !toolWords.some((word) => desc.includes(word.toLowerCase()));

    return isGenericSDK || (veryHighDownloads && descriptionMismatch);
  });

  if (suspicious.length === 0) {
    console.log("✓ No suspicious packages detected\n");
  } else {
    suspicious.forEach((tool, idx) => {
      console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
      console.log(`   Package: ${tool.package}`);
      console.log(`   Downloads: ${tool.downloads.toLocaleString()}`);
      console.log(`   🚨 Reason: Likely generic SDK or mismatched package`);
      console.log("");
    });
  }

  // Analysis summary
  console.log("\n=== ANALYSIS SUMMARY ===\n");
  console.log(`Total tools with npm: ${toolsWithNpm.length}`);
  console.log(`Suspicious mappings: ${suspicious.length}`);
  console.log(
    `Total downloads (all): ${toolsWithNpm.reduce((sum, t) => sum + t.downloads, 0).toLocaleString()}`
  );
  console.log(
    `Downloads from suspicious: ${suspicious.reduce((sum, t) => sum + t.downloads, 0).toLocaleString()}`
  );
  console.log("");

  // Check specific tools mentioned in the issue
  console.log("=== SPECIFIC TOOL CHECK ===\n");

  const checkTools = ["google-gemini-code-assist", "chatgpt-canvas", "claude-code", "cursor"];

  for (const slug of checkTools) {
    const tool = toolsWithNpm.find((t) => t.slug === slug);
    if (tool) {
      console.log(`✓ ${tool.name} (${slug})`);
      console.log(`  Package: ${tool.package}`);
      console.log(`  Downloads: ${tool.downloads.toLocaleString()}`);
    } else {
      console.log(`✗ ${slug} - No npm package mapped`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
