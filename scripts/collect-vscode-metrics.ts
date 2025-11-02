#!/usr/bin/env tsx

/**
 * VS Code Marketplace Metrics Collection Script
 * Collects install counts, ratings, and metadata from VS Code Marketplace
 *
 * Expected Coverage: 20-25 tools with VS Code extensions
 *
 * Tools likely to have VS Code extensions:
 * - GitHub Copilot, Cursor, Continue.dev, Cline, Tabnine, Codeium, CodeGeeX
 * - JetBrains AI, Claude Code, WindSurf, Aider, Sourcegraph Cody
 * - Amazon Q Developer, GitLab Duo, Qodo Gen, Snyk Code
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

interface VSCodeMetrics {
  extension_id: string;
  publisher: string;
  extension_name: string;
  installs: number;
  rating: number;
  ratings_count: number;
  last_updated: string;
  version: string;
  display_name: string;
  description: string;
  collected_at: string;
}

interface ExtensionSearchResult {
  extensionId: string;
  publisher: string;
  extensionName: string;
  displayName: string;
  shortDescription: string;
  statistics: Array<{ statisticName: string; value: number }>;
  versions: Array<{
    version: string;
    lastUpdated: string;
    properties?: Array<{ key: string; value: string }>;
  }>;
}

class VSCodeMarketplaceCollector {
  private baseUrl = "https://marketplace.visualstudio.com/_apis/public/gallery";
  private requestDelay = 2000; // 2 seconds between requests

  // Manual mapping for well-known tools to avoid false positives
  private knownExtensions: Record<string, string> = {
    "github-copilot": "GitHub.copilot",
    copilot: "GitHub.copilot",
    "continue-dev": "Continue.continue",
    continue: "Continue.continue",
    tabnine: "TabNine.tabnine-vscode",
    codeium: "Codeium.codeium",
    cody: "sourcegraph.cody-ai",
    "sourcegraph-cody": "sourcegraph.cody-ai",
    "amazon-q": "amazonwebservices.amazon-q-vscode",
    "amazon-q-developer": "amazonwebservices.amazon-q-vscode",
    cline: "saoudrizwan.claude-dev",
    "qodo-gen": "Qodo.qodo-gen",
    "gitlab-duo": "GitLab.gitlab-workflow",
    aider: "MattFlower.aider",
    "cursor": null, // Cursor doesn't have a VS Code extension (it IS a VS Code fork)
    windsurf: null, // WindSurf doesn't have a VS Code extension
  };

  /**
   * Search for an extension by name
   */
  async searchExtension(query: string): Promise<ExtensionSearchResult[]> {
    const payload = {
      filters: [
        {
          criteria: [
            { filterType: 10, value: query }, // Search text
            { filterType: 8, value: "Microsoft.VisualStudio.Code" }, // Target platform
          ],
          pageNumber: 1,
          pageSize: 10,
          sortBy: 4, // Sort by downloads
          sortOrder: 0, // Descending
        },
      ],
      assetTypes: [],
      flags: 914, // Flags for returned data
    };

    try {
      const response = await fetch(`${this.baseUrl}/extensionquery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=3.0-preview.1",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results?.[0]?.extensions || [];

      return results.map((ext: any) => ({
        extensionId: `${ext.publisher.publisherName}.${ext.extensionName}`,
        publisher: ext.publisher.publisherName,
        extensionName: ext.extensionName,
        displayName: ext.displayName,
        shortDescription: ext.shortDescription || "",
        statistics: ext.statistics || [],
        versions: ext.versions || [],
      }));
    } catch (error) {
      console.error(`   ⚠️  Search failed: ${error}`);
      return [];
    }
  }

  /**
   * Get extension by exact ID
   */
  async getExtensionById(extensionId: string): Promise<VSCodeMetrics | null> {
    const [publisher, extensionName] = extensionId.split(".");
    if (!publisher || !extensionName) {
      console.error(`   ⚠️  Invalid extension ID format: ${extensionId}`);
      return null;
    }

    const payload = {
      filters: [
        {
          criteria: [
            { filterType: 7, value: `${publisher}.${extensionName}` }, // Extension ID
            { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          ],
          pageNumber: 1,
          pageSize: 1,
        },
      ],
      assetTypes: [],
      flags: 914,
    };

    try {
      const response = await fetch(`${this.baseUrl}/extensionquery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=3.0-preview.1",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`VS Code API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const extensions = data.results?.[0]?.extensions || [];

      if (extensions.length === 0) {
        return null;
      }

      return this.parseExtensionData(extensions[0]);
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch extension: ${error}`);
      return null;
    }
  }

  /**
   * Parse raw extension data into metrics
   */
  private parseExtensionData(extensionData: any): VSCodeMetrics | null {
    try {
      const statistics = extensionData.statistics || [];
      const versions = extensionData.versions || [];

      const getStatValue = (name: string): number => {
        const stat = statistics.find((s: any) => s.statisticName === name);
        return stat ? stat.value : 0;
      };

      const installs = getStatValue("install");
      const avgRating = getStatValue("averagerating");
      const ratingCount = getStatValue("ratingcount");

      const latestVersion = versions[0] || {};

      return {
        extension_id: `${extensionData.publisher.publisherName}.${extensionData.extensionName}`,
        publisher: extensionData.publisher.publisherName,
        extension_name: extensionData.extensionName,
        installs: installs,
        rating: avgRating,
        ratings_count: ratingCount,
        last_updated: latestVersion.lastUpdated || new Date().toISOString(),
        version: latestVersion.version || "unknown",
        display_name: extensionData.displayName || "",
        description: extensionData.shortDescription || "",
        collected_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`   ⚠️  Failed to parse extension data: ${error}`);
      return null;
    }
  }

  /**
   * Try to find extension for a tool using multiple strategies
   */
  async findExtensionForTool(
    toolName: string,
    toolSlug: string,
    toolData: any
  ): Promise<VSCodeMetrics | null> {
    // Strategy 0: Check manual mapping first
    const knownExtensionId =
      this.knownExtensions[toolSlug.toLowerCase()] ||
      this.knownExtensions[toolName.toLowerCase()];

    if (knownExtensionId === null) {
      // Explicitly marked as not having an extension
      console.log(`   ℹ️  Tool is known to not have a VS Code extension`);
      return null;
    }

    if (knownExtensionId) {
      console.log(`   Using known extension ID: ${knownExtensionId}`);
      const metrics = await this.getExtensionById(knownExtensionId);
      if (metrics) return metrics;
    }

    // Strategy 1: Check if extension ID is in tool data
    const possibleFields = [
      "vscode_extension_id",
      "extension_id",
      "vscode_extension",
      "marketplace_id",
    ];

    for (const field of possibleFields) {
      const extensionId =
        toolData[field] || (toolData.info && toolData.info[field]) || null;
      if (extensionId && typeof extensionId === "string") {
        console.log(`   Found extension ID in data: ${extensionId}`);
        const metrics = await this.getExtensionById(extensionId);
        if (metrics) return metrics;
      }
    }

    // Strategy 2: Search by tool name
    console.log(`   Searching marketplace by name: ${toolName}`);
    const searchResults = await this.searchExtension(toolName);

    if (searchResults.length > 0) {
      // Use fuzzy matching to find best match
      const bestMatch = this.findBestMatch(toolName, toolSlug, searchResults);
      if (bestMatch) {
        console.log(`   Found match: ${bestMatch.extensionId}`);
        return await this.getExtensionById(bestMatch.extensionId);
      }
    }

    // Strategy 3: Try common patterns
    const commonPatterns = [
      toolSlug.toLowerCase(),
      toolName.toLowerCase().replace(/\s+/g, "-"),
      toolName.toLowerCase().replace(/\s+/g, ""),
    ];

    for (const pattern of commonPatterns) {
      console.log(`   Trying pattern: ${pattern}`);
      const results = await this.searchExtension(pattern);
      if (results.length > 0) {
        const match = this.findBestMatch(toolName, toolSlug, results);
        if (match) {
          console.log(`   Found match via pattern: ${match.extensionId}`);
          return await this.getExtensionById(match.extensionId);
        }
      }
      // Small delay between pattern attempts
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return null;
  }

  /**
   * Find best matching extension from search results
   */
  private findBestMatch(
    toolName: string,
    toolSlug: string,
    results: ExtensionSearchResult[]
  ): ExtensionSearchResult | null {
    if (results.length === 0) return null;

    const toolNameLower = toolName.toLowerCase();
    const toolSlugLower = toolSlug.toLowerCase();

    // AI/coding related keywords that should be present
    const aiCodingKeywords = [
      "ai",
      "assistant",
      "code",
      "coding",
      "copilot",
      "completion",
      "intelligence",
      "autocomplete",
      "suggest",
      "chat",
      "agentic",
      "agent",
    ];

    // Score each result
    const scored = results.map((result) => {
      let score = 0;
      const displayNameLower = result.displayName.toLowerCase();
      const extensionNameLower = result.extensionName.toLowerCase();
      const descLower = result.shortDescription.toLowerCase();

      // Exact matches get highest score
      if (displayNameLower === toolNameLower) score += 100;
      if (extensionNameLower === toolSlugLower) score += 100;

      // Strong partial matches
      const toolWords = toolNameLower.split(/\s+/);
      const matchingWords = toolWords.filter(
        (word) =>
          word.length > 2 &&
          (displayNameLower.includes(word) || extensionNameLower.includes(word))
      );

      // All words should match for multi-word tool names
      if (toolWords.length > 1 && matchingWords.length === toolWords.length) {
        score += 80;
      } else if (matchingWords.length > 0) {
        score += 30 * matchingWords.length;
      }

      // Partial matches
      if (displayNameLower.includes(toolNameLower)) score += 50;
      if (extensionNameLower.includes(toolSlugLower)) score += 50;
      if (descLower.includes(toolNameLower)) score += 20;

      // Check if it's actually AI/coding related
      const hasAICodingKeyword = aiCodingKeywords.some(
        (keyword) => displayNameLower.includes(keyword) || descLower.includes(keyword)
      );
      if (!hasAICodingKeyword) {
        // Penalize non-AI/coding tools heavily
        score -= 100;
      } else {
        score += 10;
      }

      // Publisher bonus for known AI tool companies
      const knownPublishers = [
        "github",
        "microsoft",
        "anthropic",
        "openai",
        "cursor",
        "continue",
        "tabnine",
        "codeium",
        "sourcegraph",
        "amazon",
        "gitlab",
        "qodo",
        "snyk",
        "windsurf",
        "replit",
      ];
      const publisherLower = result.publisher.toLowerCase();
      if (knownPublishers.some((p) => publisherLower.includes(p))) {
        score += 30;
      }

      // Penalize if extension name is completely different from tool
      if (
        !displayNameLower.includes(toolNameLower.split(/\s+/)[0]) &&
        !extensionNameLower.includes(toolSlugLower.split("-")[0])
      ) {
        score -= 20;
      }

      return { result, score };
    });

    // Sort by score and get best match
    scored.sort((a, b) => b.score - a.score);

    // Require minimum score threshold (raised to reduce false positives)
    const bestMatch = scored[0];
    if (bestMatch.score >= 60) {
      return bestMatch.result;
    }

    return null;
  }

  /**
   * Validate that extension is likely related to the tool
   */
  private validateMatch(toolName: string, extension: VSCodeMetrics): boolean {
    const toolNameLower = toolName.toLowerCase();
    const displayNameLower = extension.display_name.toLowerCase();
    const descLower = extension.description.toLowerCase();

    // Check if tool name appears in extension name or description
    const keywords = toolNameLower.split(/\s+/);
    const hasKeywordMatch = keywords.some(
      (keyword) => displayNameLower.includes(keyword) || descLower.includes(keyword)
    );

    return hasKeywordMatch;
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
  console.log("🚀 VS Code Marketplace Metrics Collection\n");
  console.log("Expected Coverage: 20-25 tools with VS Code extensions\n");

  const collector = new VSCodeMarketplaceCollector();

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
    console.log(
      "  npx tsx scripts/collect-vscode-metrics.ts --test   # Test on 5 tools"
    );
    console.log(
      "  npx tsx scripts/collect-vscode-metrics.ts --full   # Run on all tools"
    );
    console.log("\nLikely candidates for VS Code extensions:");
    const likelyCandidates = [
      "GitHub Copilot",
      "Cursor",
      "Continue",
      "Cline",
      "Tabnine",
      "Codeium",
      "CodeGeeX",
      "Claude Code",
      "WindSurf",
      "Aider",
      "Sourcegraph Cody",
      "Amazon Q Developer",
      "GitLab Duo",
      "Qodo Gen",
      "Snyk Code",
    ];
    likelyCandidates.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
    return;
  }

  console.log("Step 2: Collecting VS Code Marketplace metrics...\n");
  const toolsToProcess = testMode ? allTools.slice(0, 5) : allTools;
  console.log(`Processing ${toolsToProcess.length} tools...\n`);

  const results: Array<{
    tool: string;
    slug: string;
    status: "success" | "not_found" | "failed";
    metrics?: VSCodeMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name} (${tool.slug})`);

    try {
      const toolData = tool.data as any;
      const metrics = await collector.findExtensionForTool(
        tool.name,
        tool.slug,
        toolData
      );

      if (metrics) {
        console.log(`   ✅ Success!`);
        console.log(`      Extension: ${metrics.extension_id}`);
        console.log(`      Installs: ${metrics.installs.toLocaleString()}`);
        console.log(`      Rating: ${metrics.rating.toFixed(1)} (${metrics.ratings_count} ratings)`);
        console.log(`      Version: ${metrics.version}`);
        console.log(`      Updated: ${new Date(metrics.last_updated).toLocaleDateString()}`);

        // Update database
        const currentData = toolData;
        const updatedData = {
          ...currentData,
          metrics: {
            ...(currentData.metrics || {}),
            vscode: metrics,
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
        console.log(`   ⚠️  No VS Code extension found`);
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
    // Rate limiting delay
    await collector.delay();
  }

  // Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 VS CODE MARKETPLACE COLLECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Extensions found: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Not found: ${results.filter((r) => r.status === "not_found").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  const successfulResults = results.filter((r) => r.status === "success");
  if (successfulResults.length > 0) {
    const totalInstalls = successfulResults.reduce(
      (sum, r) => sum + (r.metrics?.installs || 0),
      0
    );
    const avgRating =
      successfulResults.reduce((sum, r) => sum + (r.metrics?.rating || 0), 0) /
      successfulResults.length;

    console.log("📈 Metrics Summary:");
    console.log(`   Total installs across all extensions: ${totalInstalls.toLocaleString()}`);
    console.log(`   Average rating: ${avgRating.toFixed(2)}`);
    console.log("");

    console.log("🏆 Top Extensions by Installs:");
    console.log("─".repeat(80));
    successfulResults
      .sort((a, b) => (b.metrics?.installs || 0) - (a.metrics?.installs || 0))
      .slice(0, 10)
      .forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.tool} (${result.slug})`);
        console.log(`   Extension: ${result.metrics?.extension_id}`);
        console.log(`   Installs: ${result.metrics?.installs.toLocaleString()}`);
        console.log(
          `   Rating: ${result.metrics?.rating.toFixed(1)}/5.0 (${result.metrics?.ratings_count} ratings)`
        );
        console.log("");
      });
  }

  if (results.some((r) => r.status === "not_found")) {
    console.log("❓ Tools without VS Code extensions:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "not_found")
      .slice(0, 20)
      .forEach((result) => {
        console.log(`   • ${result.tool} (${result.slug})`);
      });
    console.log("");
  }

  if (results.some((r) => r.status === "failed")) {
    console.log("❌ Failed tools:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "failed")
      .forEach((result) => {
        console.log(`   • ${result.tool}: ${result.error}`);
      });
    console.log("");
  }

  const coverage = ((successfulResults.length / allTools.length) * 100).toFixed(1);
  console.log(`✅ VS Code Marketplace metrics collection complete!`);
  console.log(`   Coverage: ${coverage}% (${successfulResults.length}/${allTools.length} tools)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
