#!/usr/bin/env tsx

/**
 * npm Registry Metrics Collection Script
 * Collects download counts, version info, and metadata from npm registry
 *
 * Expected Coverage: 15-20 tools with npm packages
 *
 * Tools likely on npm:
 * - Continue.dev (@continuedev/continue)
 * - Aider (aider-chat CLI might not be npm)
 * - Various CLI tools and SDKs
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

interface NpmMetrics {
  package_name: string;
  downloads_last_month: number;
  downloads_last_week: number;
  current_version: string;
  license: string;
  dependencies_count: number;
  author: string;
  description: string;
  homepage: string;
  repository: string;
  last_publish: string;
  collected_at: string;
}

interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  license?: string;
  author?: { name?: string; email?: string } | string;
  homepage?: string;
  repository?: { type?: string; url?: string } | string;
  dist?: {
    tarball?: string;
    shasum?: string;
  };
  dependencies?: Record<string, string>;
}

interface NpmDownloads {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

class NpmMetricsCollector {
  private registryUrl = "https://registry.npmjs.org";
  private downloadsUrl = "https://api.npmjs.org/downloads";
  private requestDelay = 1000; // 1 second between requests

  // Manual mapping for well-known packages
  private knownPackages: Record<string, string> = {
    "continue-dev": "@continuedev/continue",
    continue: "@continuedev/continue",
    aider: "aider-chat",
    "openai-cli": "openai",
    "anthropic-cli": "@anthropic-ai/sdk",
    "github-copilot-cli": "@githubnext/github-copilot-cli",
    cursor: null, // No npm package
    windsurf: null, // No npm package
  };

  /**
   * Get package information from npm registry
   */
  async getPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
    try {
      const encodedName = encodeURIComponent(packageName);
      const response = await fetch(`${this.registryUrl}/${encodedName}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`npm registry error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Get latest version info
      const latestVersion = data["dist-tags"]?.latest || Object.keys(data.versions || {}).pop();
      const versionInfo = data.versions?.[latestVersion];

      if (!versionInfo) {
        return null;
      }

      return {
        name: data.name,
        version: latestVersion,
        description: versionInfo.description || data.description || "",
        license: versionInfo.license || "",
        author: versionInfo.author || data.author,
        homepage: versionInfo.homepage || data.homepage || "",
        repository: versionInfo.repository || data.repository,
        dist: versionInfo.dist,
        dependencies: versionInfo.dependencies || {},
      };
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch package info: ${error}`);
      return null;
    }
  }

  /**
   * Get download statistics for a package
   */
  async getDownloadStats(packageName: string): Promise<NpmDownloads | null> {
    try {
      const encodedName = encodeURIComponent(packageName);

      // Get last month downloads
      const monthResponse = await fetch(
        `${this.downloadsUrl}/point/last-month/${encodedName}`
      );

      if (!monthResponse.ok) {
        if (monthResponse.status === 404) {
          return null;
        }
        throw new Error(`npm downloads API error: ${monthResponse.status}`);
      }

      return await monthResponse.json();
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch download stats: ${error}`);
      return null;
    }
  }

  /**
   * Get weekly download count
   */
  async getWeeklyDownloads(packageName: string): Promise<number> {
    try {
      const encodedName = encodeURIComponent(packageName);
      const response = await fetch(`${this.downloadsUrl}/point/last-week/${encodedName}`);

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.downloads || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Collect all metrics for an npm package
   */
  async collectMetrics(packageName: string): Promise<NpmMetrics | null> {
    try {
      console.log(`   Fetching package info...`);
      const packageInfo = await this.getPackageInfo(packageName);

      if (!packageInfo) {
        return null;
      }

      console.log(`   Fetching download stats...`);
      const downloadStats = await this.getDownloadStats(packageName);
      const weeklyDownloads = await this.getWeeklyDownloads(packageName);

      // Parse author
      let authorName = "";
      if (typeof packageInfo.author === "string") {
        authorName = packageInfo.author;
      } else if (packageInfo.author?.name) {
        authorName = packageInfo.author.name;
      }

      // Parse repository URL
      let repoUrl = "";
      if (typeof packageInfo.repository === "string") {
        repoUrl = packageInfo.repository;
      } else if (packageInfo.repository?.url) {
        repoUrl = packageInfo.repository.url;
      }

      // Get latest publish date from registry
      const lastPublish = await this.getLastPublishDate(packageName);

      const metrics: NpmMetrics = {
        package_name: packageInfo.name,
        downloads_last_month: downloadStats?.downloads || 0,
        downloads_last_week: weeklyDownloads,
        current_version: packageInfo.version,
        license: packageInfo.license || "unknown",
        dependencies_count: Object.keys(packageInfo.dependencies || {}).length,
        author: authorName,
        description: packageInfo.description || "",
        homepage: packageInfo.homepage || "",
        repository: repoUrl,
        last_publish: lastPublish,
        collected_at: new Date().toISOString(),
      };

      return metrics;
    } catch (error) {
      console.error(`   ❌ Failed to collect metrics: ${error}`);
      return null;
    }
  }

  /**
   * Get last publish date for a package
   */
  private async getLastPublishDate(packageName: string): Promise<string> {
    try {
      const encodedName = encodeURIComponent(packageName);
      const response = await fetch(`${this.registryUrl}/${encodedName}`);

      if (!response.ok) {
        return "";
      }

      const data = await response.json();
      const time = data.time;
      const latestVersion = data["dist-tags"]?.latest;

      return time?.[latestVersion] || "";
    } catch (error) {
      return "";
    }
  }

  /**
   * Search npm registry for packages
   */
  async searchPackages(query: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const results = data.objects || [];

      return results.map((obj: any) => obj.package.name);
    } catch (error) {
      console.error(`   ⚠️  Search failed: ${error}`);
      return [];
    }
  }

  /**
   * Try to find npm package for a tool
   */
  async findPackageForTool(
    toolName: string,
    toolSlug: string,
    toolData: any
  ): Promise<NpmMetrics | null> {
    // Strategy 0: Check manual mapping first
    const knownPackage =
      this.knownPackages[toolSlug.toLowerCase()] ||
      this.knownPackages[toolName.toLowerCase()];

    if (knownPackage === null) {
      console.log(`   ℹ️  Tool is known to not have an npm package`);
      return null;
    }

    if (knownPackage) {
      console.log(`   Using known package: ${knownPackage}`);
      return await this.collectMetrics(knownPackage);
    }

    // Strategy 1: Check if package name is in tool data
    const possibleFields = ["npm_package", "package_name", "npm", "package"];

    for (const field of possibleFields) {
      const packageName = toolData[field] || (toolData.info && toolData.info[field]) || null;
      if (packageName && typeof packageName === "string") {
        console.log(`   Found package in data: ${packageName}`);
        const metrics = await this.collectMetrics(packageName);
        if (metrics) return metrics;
      }
    }

    // Strategy 2: Try common patterns
    const patterns = [
      toolSlug.toLowerCase(),
      `@${toolSlug.toLowerCase()}/${toolSlug.toLowerCase()}`,
      toolName.toLowerCase().replace(/\s+/g, "-"),
      toolName.toLowerCase().replace(/\s+/g, ""),
    ];

    for (const pattern of patterns) {
      console.log(`   Trying package: ${pattern}`);
      const metrics = await this.collectMetrics(pattern);
      if (metrics) {
        // Validate it's related to the tool
        if (this.validatePackageMatch(toolName, toolSlug, metrics)) {
          return metrics;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Strategy 3: Search npm
    console.log(`   Searching npm registry: ${toolName}`);
    const searchResults = await this.searchPackages(toolName);

    if (searchResults.length > 0) {
      // Try first few results
      for (const packageName of searchResults.slice(0, 3)) {
        const metrics = await this.collectMetrics(packageName);
        if (metrics && this.validatePackageMatch(toolName, toolSlug, metrics)) {
          console.log(`   Found via search: ${packageName}`);
          return metrics;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return null;
  }

  /**
   * Validate that package is likely related to the tool
   */
  private validatePackageMatch(
    toolName: string,
    toolSlug: string,
    metrics: NpmMetrics
  ): boolean {
    const toolNameLower = toolName.toLowerCase();
    const toolSlugLower = toolSlug.toLowerCase();
    const packageNameLower = metrics.package_name.toLowerCase();
    const descLower = metrics.description.toLowerCase();

    // Check if tool name/slug appears in package name or description
    const toolWords = toolNameLower.split(/\s+/).filter((w) => w.length > 2);

    const hasNameMatch =
      packageNameLower.includes(toolSlugLower) ||
      packageNameLower.includes(toolNameLower) ||
      toolWords.some((word) => packageNameLower.includes(word));

    const hasDescMatch =
      descLower.includes(toolNameLower) ||
      toolWords.some((word) => descLower.includes(word));

    // Check if it's AI/coding related
    const aiCodingKeywords = [
      "ai",
      "code",
      "coding",
      "assistant",
      "copilot",
      "completion",
      "intelligence",
      "autocomplete",
      "suggest",
      "chat",
      "agent",
      "cli",
      "sdk",
    ];

    const hasAICodingKeyword = aiCodingKeywords.some(
      (keyword) => packageNameLower.includes(keyword) || descLower.includes(keyword)
    );

    return (hasNameMatch || hasDescMatch) && hasAICodingKeyword;
  }

  /**
   * Rate limiting delay
   */
  async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🚀 npm Registry Metrics Collection\n");
  console.log("Expected Coverage: 15-20 tools with npm packages\n");

  const collector = new NpmMetricsCollector();

  // Connect to database
  console.log("Step 1: Connecting to database...");
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const allTools = await db.select().from(tools);
  console.log(`✅ Found ${allTools.length} tools in database\n`);

  // Determine mode
  const testMode = process.argv.includes("--test");
  const fullMode = process.argv.includes("--full");

  if (!testMode && !fullMode) {
    console.log("Step 2: Preview mode - use --test or --full to collect metrics\n");
    console.log("Commands:");
    console.log("  npx tsx scripts/collect-npm-metrics.ts --test   # Test on 5 tools");
    console.log("  npx tsx scripts/collect-npm-metrics.ts --full   # Run on all tools");
    return;
  }

  console.log("Step 2: Collecting npm registry metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: NpmMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name} (${tool.slug})`);

    try {
      const toolData = tool.data as any;
      const metrics = await collector.findPackageForTool(tool.name, tool.slug, toolData);

      if (metrics) {
        console.log(`   ✅ Success!`);
        console.log(`      Package: ${metrics.package_name}`);
        console.log(`      Downloads (month): ${metrics.downloads_last_month.toLocaleString()}`);
        console.log(`      Downloads (week): ${metrics.downloads_last_week.toLocaleString()}`);
        console.log(`      Version: ${metrics.current_version}`);
        console.log(`      License: ${metrics.license}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            npm: metrics,
          },
        };

        await db
          .update(tools)
          .set({
            data: updatedData as any,
            updatedAt: new Date(),
          })
          .where(sql`id = ${tool.id}`);

        console.log(`   💾 Stored in database`);
        results.push({ tool: tool.name, slug: tool.slug, status: "success", metrics });
      } else {
        console.log(`   ⚠️  No npm package found`);
        results.push({
          tool: tool.name,
          slug: tool.slug,
          status: "not_found",
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      results.push({
        tool: tool.name,
        slug: tool.slug,
        status: "failed",
        error: String(error),
      });
    }

    console.log("");
    await collector.delay();
  }

  // Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 NPM REGISTRY COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Packages found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalDownloadsMonth = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_month || 0),
      0
    );
    const totalDownloadsWeek = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_week || 0),
      0
    );

    console.log("📈 Metrics Summary:");
    console.log(`   Total monthly downloads: ${totalDownloadsMonth.toLocaleString()}`);
    console.log(`   Total weekly downloads: ${totalDownloadsWeek.toLocaleString()}`);
    console.log("");

    console.log("🏆 Top Packages by Monthly Downloads:");
    console.log("─".repeat(80));
    successfulResults
      .sort((a, b) => (b.metrics?.downloads_last_month || 0) - (a.metrics?.downloads_last_month || 0))
      .slice(0, 10)
      .forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.tool} (${result.slug})`);
        console.log(`   Package: ${result.metrics?.package_name}`);
        console.log(
          `   Monthly downloads: ${result.metrics?.downloads_last_month.toLocaleString()}`
        );
        console.log(
          `   Weekly downloads: ${result.metrics?.downloads_last_week.toLocaleString()}`
        );
        console.log(`   Version: ${result.metrics?.current_version}`);
        console.log("");
      });
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ npm registry metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
