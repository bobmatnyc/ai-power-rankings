/**
 * VS Code Marketplace gallery collector, moved unchanged from scripts/collect-vscode-metrics.ts (#95).
 *
 * Why: the CLI and the collect-metrics cron route share one class, so both use
 *   the same matching heuristics. The only change is a per-fetch timeout.
 * What: see scripts/collect-vscode-metrics.ts for the CLI that drives it.
 * Test: `tests/unit/metrics-collectors-95.test.ts`
 */

import { type CollectorOptions, fetchSignal } from "./fetch-signal";

export interface VSCodeMetrics {
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

export interface ExtensionSearchResult {
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

export class VSCodeMarketplaceCollector {
  private baseUrl = "https://marketplace.visualstudio.com/_apis/public/gallery";
  private requestDelay = 2000; // 2 seconds between requests

  // #95: the caller's signal (the cron run deadline) joins every fetch's timeout.
  private signal: AbortSignal | undefined;

  constructor(options: CollectorOptions = {}) {
    this.signal = options.signal;
  }

  // Manual mapping for well-known tools to avoid false positives
  private knownExtensions: Record<string, string | null> = {
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
        signal: fetchSignal(this.signal),
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
        signal: fetchSignal(this.signal),
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

