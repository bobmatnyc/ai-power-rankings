/**
 * PyPI and pypistats collector, moved unchanged from scripts/collect-pypi-metrics.ts (#95).
 *
 * Why: the CLI and the collect-metrics cron route share one class, so both use
 *   the same matching heuristics. The only change is a per-fetch timeout.
 * What: see scripts/collect-pypi-metrics.ts for the CLI that drives it.
 * Test: `tests/unit/metrics-collectors-95.test.ts`
 */

import { type CollectorOptions, fetchSignal } from "./fetch-signal";

export interface PyPIMetrics {
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

export interface PyPIPackageInfo {
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

export class PyPIMetricsCollector {
  private pypiUrl = "https://pypi.org/pypi";
  private requestDelay = 1000; // 1 second between requests

  // #95: the caller's signal (the cron run deadline) joins every fetch's timeout.
  private signal: AbortSignal | undefined;

  constructor(options: CollectorOptions = {}) {
    this.signal = options.signal;
  }

  // Manual mapping for well-known packages
  private knownPackages: Record<string, string | null> = {
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
      const response = await fetch(`${this.pypiUrl}/${packageName}/json`, { signal: fetchSignal(this.signal) });

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
        `https://pypistats.org/api/packages/${packageName}/recent`,
        { signal: fetchSignal(this.signal) }
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

