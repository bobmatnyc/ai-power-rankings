/**
 * PyPI and pypistats collector, moved from scripts/collect-pypi-metrics.ts (#95).
 *
 * Why: the CLI and the collect-metrics cron route share one class, so both use
 *   the same matching heuristics. A pypi cron shard must finish its ~97 tools
 *   inside the 270 s shard deadline.
 * What: `findPackageForTool` tries the known mapping, the data fields, then the
 *   name patterns and search spellings, in the CLI's order. #95: each distinct
 *   PyPI name (PEP 503 normalised) is fetched once per tool, download stats are
 *   fetched only for the package that is returned, and a failed request
 *   (non-404 status, network error, timeout) throws instead of reading as "no
 *   package" or as 0 downloads. See scripts/collect-pypi-metrics.ts for the CLI.
 * Test: `tests/unit/metrics-collectors-95.test.ts`, `tests/unit/metrics-collection-health-95.test.ts`
 */

import { abortableSleep, type CollectorOptions, fetchSignal } from "./fetch-signal";

/** #95: pause between two PyPI lookups for one tool (the CLI's original 300 ms). */
export const LOOKUP_PAUSE_MS = 300;

/** #95: PEP 503 name normalisation; PyPI's JSON API answers every spelling with one package. */
export function normalizePyPIName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

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
   * #95: package information, `null` on a 404. Any other status, a network error or a
   * timeout throws, so a registry failure is never read as "no package".
   */
  async fetchPackageInfo(packageName: string): Promise<PyPIPackageInfo | null> {
    const response = await fetch(`${this.pypiUrl}/${packageName}/json`, { signal: fetchSignal(this.signal) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`PyPI error: ${response.status} ${response.statusText}`);
    return (await response.json()) as PyPIPackageInfo;
  }

  /** CLI form of fetchPackageInfo: logs a failure and returns null. */
  async getPackageInfo(packageName: string): Promise<PyPIPackageInfo | null> {
    try {
      return await this.fetchPackageInfo(packageName);
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch package info: ${error}`);
      return null;
    }
  }

  /**
   * #95: last-month downloads from pypistats.org (an approximation; PyPI has no official
   * download API). A 404 (no pypistats record) is 0, as before; any other failure throws
   * rather than storing a stand-in 0.
   */
  async fetchDownloadStats(packageName: string): Promise<number> {
    const response = await fetch(`https://pypistats.org/api/packages/${packageName}/recent`, {
      signal: fetchSignal(this.signal),
    });
    if (response.status === 404) return 0;
    if (!response.ok) throw new Error(`pypistats error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.data?.last_month || 0;
  }

  /** CLI form of fetchDownloadStats: logs a failure and returns 0. */
  async getDownloadStats(packageName: string): Promise<number> {
    try {
      return await this.fetchDownloadStats(packageName);
    } catch (error) {
      console.error(`   ⚠️  Failed to fetch download stats: ${error}`);
      return 0;
    }
  }

  /** The metrics record for a fetched package, with the given download count. */
  private toMetrics(packageInfo: PyPIPackageInfo, downloads: number): PyPIMetrics {
    const info = packageInfo.info;

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
    const latestRelease = releases[info.version];
    const lastRelease = latestRelease?.[0]?.upload_time || packageInfo.urls?.[0]?.upload_time || "";

    return {
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
  }

  /**
   * #95: metrics for one package name, `null` when PyPI has no such package. With
   * `match`, a package that fails `validatePackageMatch` is also `null`, and its download
   * stats are never fetched (validation reads only the name and description). Throws on a
   * failed request.
   */
  private async lookupMetrics(
    packageName: string,
    match?: { toolName: string; toolSlug: string }
  ): Promise<PyPIMetrics | null> {
    console.log(`   Fetching package info...`);
    const packageInfo = await this.fetchPackageInfo(packageName);
    if (!packageInfo || !packageInfo.info) return null;
    const metrics = this.toMetrics(packageInfo, 0);
    if (match && !this.validatePackageMatch(match.toolName, match.toolSlug, metrics)) return null;
    console.log(`   Fetching download stats...`);
    metrics.downloads_last_month = await this.fetchDownloadStats(packageName);
    return metrics;
  }

  /**
   * Collect all metrics for a PyPI package; logs a failure and returns null.
   */
  async collectMetrics(packageName: string): Promise<PyPIMetrics | null> {
    try {
      return await this.lookupMetrics(packageName);
    } catch (error) {
      console.error(`   ❌ Failed to collect metrics: ${error}`);
      return null;
    }
  }

  /** PyPI search is limited, so "search" tries common spellings of the query. */
  private searchVariations(query: string): string[] {
    return [
      query.toLowerCase(),
      query.toLowerCase().replace(/\s+/g, "-"),
      query.toLowerCase().replace(/\s+/g, "_"),
      query.toLowerCase().replace(/\s+/g, ""),
    ];
  }

  /**
   * Search PyPI for packages
   */
  async searchPackages(query: string): Promise<string[]> {
    const found: string[] = [];
    for (const variation of this.searchVariations(query)) {
      const info = await this.getPackageInfo(variation);
      if (info) {
        found.push(variation);
      }
    }
    return found;
  }

  /**
   * Try to find PyPI package for a tool. Throws when a PyPI or pypistats request fails (#95).
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
      return await this.lookupMetrics(knownPackage);
    }

    // #95: every PyPI name this tool has looked up, PEP 503 normalised. Before this, one tool
    // sent up to 10 package lookups (6 patterns + 4 search spellings, mostly the same name),
    // slept 300 ms after each pattern, and fetched pypistats for every existing package before
    // validating it, so a pypi shard of ~97 tools outran the 270 s deadline.
    const tried = new Set<string>();

    // Strategy 1: Check if package name is in tool data
    const possibleFields = ["pypi_package", "python_package", "pip_package", "package_name"];

    for (const field of possibleFields) {
      const packageName = toolData[field] || (toolData.info && toolData.info[field]) || null;
      if (packageName && typeof packageName === "string") {
        console.log(`   Found package in data: ${packageName}`);
        tried.add(normalizePyPIName(packageName));
        const metrics = await this.lookupMetrics(packageName);
        if (metrics) return metrics;
      }
    }

    // Strategy 2: common patterns, then Strategy 3: the search spellings. Both validate the match.
    const candidates = [
      toolSlug.toLowerCase(),
      toolSlug.toLowerCase().replace(/-/g, "_"),
      toolSlug.toLowerCase().replace(/-/g, ""),
      toolName.toLowerCase().replace(/\s+/g, "-"),
      toolName.toLowerCase().replace(/\s+/g, "_"),
      toolName.toLowerCase().replace(/\s+/g, ""),
      ...this.searchVariations(toolName),
    ];

    for (const candidate of candidates) {
      const key = normalizePyPIName(candidate);
      if (tried.has(key)) continue;
      if (tried.size > 0) await abortableSleep(LOOKUP_PAUSE_MS, this.signal);
      tried.add(key);
      console.log(`   Trying package: ${candidate}`);
      const metrics = await this.lookupMetrics(candidate, { toolName, toolSlug });
      if (metrics) return metrics;
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
