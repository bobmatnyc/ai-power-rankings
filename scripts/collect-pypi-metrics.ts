#!/usr/bin/env tsx

/**
 * PyPI (Python Package Index) Metrics Collection Script
 * Collects download counts, version info, and metadata from PyPI
 *
 * Expected Coverage: 5-10 tools with PyPI packages
 *
 * Tools likely on PyPI:
 * - aider-chat
 * - gpt-engineer
 * - openai (CLI/SDK)
 * - anthropic (SDK)
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

interface PyPIMetrics {
  package_name: string;
  downloads_last_month: number;
  current_version: string;
  python_version: string;
  license: string;
  author: string;
  description: string;
  homepage: string;
  repository: string;
  last_release: string;
  collected_at: string;
}

interface PyPIPackageInfo {
  info: {
    name: string;
    version: string;
    summary?: string;
    description?: string;
    license?: string;
    author?: string;
    author_email?: string;
    home_page?: string;
    project_urls?: Record<string, string>;
    requires_python?: string;
    classifiers?: string[];
  };
  urls?: Array<{
    upload_time?: string;
  }>;
  releases?: Record<string, any>;
}

class PyPIMetricsCollector {
  private pypiUrl = "https://pypi.org/pypi";
  private requestDelay = 1000; // 1 second between requests

  // Manual mapping for well-known packages
  private knownPackages: Record<string, string> = {
    aider: "aider-chat",
    "gpt-engineer": "gpt-engineer",
    openai: "openai",
    anthropic: "anthropic",
    "claude-sdk": "anthropic",
    continue: null, // Not a Python package
    cursor: null,
    windsurf: null,
  };

  /**
   * Get package information from PyPI
   */
  async getPackageInfo(packageName: string): Promise<PyPIPackageInfo | null> {
    try {
      const response = await fetch(`${this.pypiUrl}/${packageName}/json`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`PyPI error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch package info: ${error}`);
      return null;
    }
  }

  /**
   * Get download statistics from pypistats.org
   * Note: This is an approximation as PyPI doesn't provide official download stats API
   */
  async getDownloadStats(packageName: string): Promise<number> {
    try {
      // Using pypistats.org API
      const response = await fetch(
        `https://pypistats.org/api/packages/${packageName}/recent`
      );

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      // Get last month downloads (approximation)
      return data.data?.last_month || 0;
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch download stats: ${error}`);
      return 0;
    }
  }

  /**
   * Collect all metrics for a PyPI package
   */
  async collectMetrics(packageName: string): Promise<PyPIMetrics | null> {
    try {
      console.log(`   Fetching package info...`);
      const packageInfo = await this.getPackageInfo(packageName);

      if (!packageInfo || !packageInfo.info) {
        return null;
      }

      const info = packageInfo.info;

      console.log(`   Fetching download stats...`);
      const downloads = await this.getDownloadStats(packageName);

      // Get repository URL from project_urls
      let repoUrl = "";
      if (info.project_urls) {
        repoUrl =
          info.project_urls["Source"] ||
          info.project_urls["Repository"] ||
          info.project_urls["Homepage"] ||
          "";
      }

      // Get latest release date
      const releases = packageInfo.releases || {};
      const latestVersion = info.version;
      const latestRelease = releases[latestVersion];
      const lastRelease =
        latestRelease?.[0]?.upload_time || packageInfo.urls?.[0]?.upload_time || "";

      const metrics: PyPIMetrics = {
        package_name: info.name,
        downloads_last_month: downloads,
        current_version: info.version,
        python_version: info.requires_python || "",
        license: info.license || "unknown",
        author: info.author || "",
        description: info.summary || info.description || "",
        homepage: info.home_page || "",
        repository: repoUrl,
        last_release: lastRelease,
        collected_at: new Date().toISOString(),
      };

      return metrics;
    } catch (error) {
      console.error(`   ❌ Failed to collect metrics: ${error}`);
      return null;
    }
  }

  /**
   * Search PyPI for packages
   */
  async searchPackages(query: string): Promise<string[]> {
    try {
      // PyPI search is limited, we'll use a simple approach
      // Try common variations first
      const variations = [
        query.toLowerCase(),
        query.toLowerCase().replace(/\s+/g, "-"),
        query.toLowerCase().replace(/\s+/g, "_"),
        query.toLowerCase().replace(/\s+/g, ""),
      ];

      const found: string[] = [];

      for (const variation of variations) {
        const info = await this.getPackageInfo(variation);
        if (info) {
          found.push(variation);
        }
      }

      return found;
    } catch (error) {
      console.error(`   ⚠️  Search failed: ${error}`);
      return [];
    }
  }

  /**
   * Try to find PyPI package for a tool
   */
  async findPackageForTool(
    toolName: string,
    toolSlug: string,
    toolData: any
  ): Promise<PyPIMetrics | null> {
    // Strategy 0: Check manual mapping first
    const knownPackage =
      this.knownPackages[toolSlug.toLowerCase()] ||
      this.knownPackages[toolName.toLowerCase()];

    if (knownPackage === null) {
      console.log(`   ℹ️  Tool is known to not have a PyPI package`);
      return null;
    }

    if (knownPackage) {
      console.log(`   Using known package: ${knownPackage}`);
      return await this.collectMetrics(knownPackage);
    }

    // Strategy 1: Check if package name is in tool data
    const possibleFields = ["pypi_package", "python_package", "pip_package", "package_name"];

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
      toolSlug.toLowerCase().replace(/-/g, "_"),
      toolSlug.toLowerCase().replace(/-/g, ""),
      toolName.toLowerCase().replace(/\s+/g, "-"),
      toolName.toLowerCase().replace(/\s+/g, "_"),
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

    // Strategy 3: Search PyPI
    console.log(`   Searching PyPI: ${toolName}`);
    const searchResults = await this.searchPackages(toolName);

    if (searchResults.length > 0) {
      for (const packageName of searchResults) {
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
    metrics: PyPIMetrics
  ): boolean {
    const toolNameLower = toolName.toLowerCase();
    const toolSlugLower = toolSlug.toLowerCase();
    const packageNameLower = metrics.package_name.toLowerCase();
    const descLower = metrics.description.toLowerCase();

    // Check if tool name/slug appears in package name or description
    const toolWords = toolNameLower.split(/\s+/).filter((w) => w.length > 2);

    const hasNameMatch =
      packageNameLower.includes(toolSlugLower.replace(/-/g, "_")) ||
      packageNameLower.includes(toolSlugLower.replace(/-/g, "")) ||
      packageNameLower.includes(toolNameLower.replace(/\s+/g, "_")) ||
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
      "gpt",
      "llm",
      "model",
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
  console.log("🚀 PyPI Metrics Collection\n");
  console.log("Expected Coverage: 5-10 tools with PyPI packages\n");

  const collector = new PyPIMetricsCollector();

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
    console.log("  npx tsx scripts/collect-pypi-metrics.ts --test   # Test on 5 tools");
    console.log("  npx tsx scripts/collect-pypi-metrics.ts --full   # Run on all tools");
    return;
  }

  console.log("Step 2: Collecting PyPI metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: PyPIMetrics;
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
        console.log(`      Version: ${metrics.current_version}`);
        console.log(`      Python: ${metrics.python_version || "any"}`);
        console.log(`      License: ${metrics.license}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            pypi: metrics,
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
        console.log(`   ⚠️  No PyPI package found`);
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
  console.log("📊 PYPI COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Packages found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalDownloads = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.downloads_last_month || 0),
      0
    );

    console.log("📈 Metrics Summary:");
    console.log(`   Total monthly downloads: ${totalDownloads.toLocaleString()}`);
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
        console.log(`   Version: ${result.metrics?.current_version}`);
        console.log(`   Python: ${result.metrics?.python_version || "any"}`);
        console.log("");
      });
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ PyPI metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
