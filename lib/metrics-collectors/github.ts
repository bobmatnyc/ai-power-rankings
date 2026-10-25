/**
 * GitHub REST collector, moved unchanged from scripts/collect-github-metrics.ts (#95).
 *
 * Why: the CLI and the collect-metrics cron route share one class, so both use
 *   the same matching heuristics. The only changes are a per-fetch timeout and
 *   a request-budget guard (no rate-limit sleep) and 403/429 failures (tokenless mode, #95).
 * What: see scripts/collect-github-metrics.ts for the CLI that drives it.
 * Test: `tests/unit/metrics-collectors-95.test.ts`, `tests/unit/metrics-github-tokenless-95.test.ts`
 */

import { type CollectorOptions, fetchSignal } from "./fetch-signal";

export interface GitHubMetrics {
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  subscribers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  has_issues: boolean;
  has_wiki: boolean;
  // #95: absent in unauthenticated mode; never a stand-in 0.
  commit_count_30d?: number;
  contributors_count?: number;
  last_updated: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

/** #95: a 403 or 429 from GitHub. Never a metric value; the caller records the tool as failed. */
export class GitHubRateLimitError extends Error {
  constructor(
    readonly status: number,
    detail: string
  ) {
    super(`GitHub API rate limited or forbidden: ${status} ${detail}`);
    this.name = "GitHubRateLimitError";
  }
}

/** #95: rate-limit state read from response headers. `null` until a response reports it. */
export interface GitHubRateLimit {
  remaining: number | null;
  reset: number | null;
  limit: number | null;
}

/** #95: requests one tool costs: repo only without a token, repo + commits + contributors with one. */
export const REQUESTS_PER_TOOL_UNAUTH = 1;
export const REQUESTS_PER_TOOL_AUTH = 3;

function headerInt(response: Response, name: string): number | null {
  const raw = response.headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

export class GitHubMetricsCollector {
  private token: string;
  private baseUrl = "https://api.github.com";
  // #95: seeded from real response headers, not an assumed 5000.
  private rateLimit: GitHubRateLimit = { remaining: null, reset: null, limit: null };

  // #95: the caller's signal (the cron run deadline) joins every fetch's timeout.
  private signal: AbortSignal | undefined;

  constructor(token: string | undefined, options: CollectorOptions = {}) {
    // #95: an absent or blank token means unauthenticated mode (owner ruling A9e).
    this.token = (token ?? "").trim();
    this.signal = options.signal;
  }

  /** #95: true when a token is present; false means repo metadata only. */
  get authenticated(): boolean {
    return this.token !== "";
  }

  /** #95: a copy of the header-seeded rate-limit state. */
  getRateLimit(): GitHubRateLimit {
    return { ...this.rateLimit };
  }

  /** #95: never sends `Authorization` without a token (no `Bearer ""`). */
  private requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (this.authenticated) headers["Authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  /** #95: requests one tool needs in the current mode. */
  requestsPerTool(): number {
    return this.authenticated ? REQUESTS_PER_TOOL_AUTH : REQUESTS_PER_TOOL_UNAUTH;
  }

  /**
   * #95: why the next tool must not be fetched, or null when it may run.
   * Unknown budget (no response yet) allows the first tool; its headers seed the state.
   */
  budgetStopReason(nowMs: number = Date.now()): string | null {
    const { remaining, reset } = this.rateLimit;
    const need = this.requestsPerTool();
    if (remaining === null || remaining >= need) return null;
    if (reset !== null && reset * 1000 <= nowMs) return null; // window has rolled over
    const resetAt = reset === null ? "unknown" : new Date(reset * 1000).toISOString();
    return `github rate-limit budget exhausted: ${remaining} remaining, ${need} needed per tool, resets ${resetAt}`;
  }

  /**
   * Extract owner/repo from various GitHub URL formats
   */
  private parseGitHubUrl(url: string): GitHubRepoInfo | null {
    try {
      // Handle various GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/i, // https://github.com/owner/repo or .git
        /github\.com\/([^\/]+)\/([^\/]+)/i, // https://github.com/owner/repo/...
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2].replace(/\.git$/, ""),
            url: url,
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`Error parsing GitHub URL: ${url}`, error);
      return null;
    }
  }

  /** #95: folds a response's rate-limit headers into the state. Runs on every response, ok or not. */
  private readRateLimit(response: Response): void {
    const remaining = headerInt(response, "x-ratelimit-remaining");
    const reset = headerInt(response, "x-ratelimit-reset");
    const limit = headerInt(response, "x-ratelimit-limit");
    if (remaining !== null) this.rateLimit.remaining = remaining;
    if (reset !== null) this.rateLimit.reset = reset;
    if (limit !== null) this.rateLimit.limit = limit;
  }

  /**
   * Verify GitHub token and check rate limits (authenticated mode only)
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rate_limit`, {
        signal: fetchSignal(this.signal),
        headers: this.requestHeaders(),
      });

      if (!response.ok) {
        console.error(`GitHub API error: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      this.rateLimit = {
        remaining: data.resources.core.remaining,
        reset: data.resources.core.reset,
        limit: data.resources.core.limit ?? null,
      };

      console.log(`✅ GitHub token verified`);
      console.log(`   Rate limit: ${this.rateLimit.remaining}/${this.rateLimit.limit}`);
      console.log(
        `   Resets at: ${new Date((this.rateLimit.reset ?? 0) * 1000).toLocaleString()}`
      );

      return true;
    } catch (error) {
      console.error("Failed to verify GitHub token:", error);
      return false;
    }
  }

  /**
   * Make GitHub API request. A 403 or 429 throws GitHubRateLimitError; it is never a value.
   */
  private async githubRequest(endpoint: string): Promise<any> {
    // #95: no sleep on a low budget; the budget guard stops the run instead of waiting out a reset.
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      signal: fetchSignal(this.signal),
      headers: this.requestHeaders(),
    });

    this.readRateLimit(response);

    if (response.status === 403 || response.status === 429) {
      // #95: Retry-After (secondary limit) closes the budget until it passes.
      const retryAfter = headerInt(response, "retry-after");
      if (retryAfter !== null) {
        this.rateLimit.remaining = 0;
        this.rateLimit.reset = Math.ceil(Date.now() / 1000) + retryAfter;
      }
      throw new GitHubRateLimitError(
        response.status,
        retryAfter === null ? response.statusText : `retry-after ${retryAfter}s`
      );
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get commit count for last 30 days. Throws on any failed call (#95: no stored 0).
   */
  private async getCommitCount30d(owner: string, repo: string): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const commits = await this.githubRequest(
      `/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=100`
    );

    return Array.isArray(commits) ? commits.length : 0;
  }

  /**
   * Get contributors count. Throws on any failed call (#95: no stored 0).
   */
  private async getContributorsCount(owner: string, repo: string): Promise<number> {
    const contributors = await this.githubRequest(
      `/repos/${owner}/${repo}/contributors?per_page=1&anon=true`
    );

    // GitHub doesn't return total count in response body, need to parse Link header
    // For now, just return array length for first page
    return Array.isArray(contributors) ? contributors.length : 0;
  }

  /**
   * Collect all metrics for a repository; throws on any failed call (#95).
   * Without a token only `GET /repos/{o}/{r}` runs and the commit and contributor fields are absent.
   */
  async fetchMetrics(owner: string, repo: string): Promise<GitHubMetrics> {
    console.log(`   Fetching repo data...`);
    const repoData = await this.githubRequest(`/repos/${owner}/${repo}`);

    const metrics: GitHubMetrics = {
      stars: repoData.stargazers_count || 0,
      forks: repoData.forks_count || 0,
      watchers: repoData.watchers_count || 0,
      open_issues: repoData.open_issues_count || 0,
      subscribers_count: repoData.subscribers_count || 0,
      created_at: repoData.created_at,
      updated_at: repoData.updated_at,
      pushed_at: repoData.pushed_at,
      language: repoData.language,
      has_issues: repoData.has_issues || false,
      has_wiki: repoData.has_wiki || false,
      last_updated: new Date().toISOString(),
    };

    if (this.authenticated) {
      console.log(`   Fetching commit count (30 days)...`);
      metrics.commit_count_30d = await this.getCommitCount30d(owner, repo);

      console.log(`   Fetching contributors count...`);
      metrics.contributors_count = await this.getContributorsCount(owner, repo);
    }

    return metrics;
  }

  /**
   * CLI form of fetchMetrics: logs a failure and returns null.
   */
  async collectMetrics(owner: string, repo: string): Promise<GitHubMetrics | null> {
    try {
      return await this.fetchMetrics(owner, repo);
    } catch (error) {
      console.error(`   ❌ Failed to collect metrics: ${error}`);
      return null;
    }
  }

  /**
   * Find all GitHub URLs in tool data
   */
  findGitHubUrls(toolData: any): string[] {
    const urls: string[] = [];

    // Check common fields
    const fieldsToCheck = [
      "github_url",
      "repository",
      "source_code_url",
      "repo_url",
      "github",
      "code_repository",
      "homepage",
    ];

    for (const field of fieldsToCheck) {
      const value = toolData[field];
      if (typeof value === "string" && value.includes("github.com")) {
        urls.push(value);
      }
    }

    // Check nested info object
    if (toolData.info && typeof toolData.info === "object") {
      for (const field of fieldsToCheck) {
        const value = toolData.info[field];
        if (typeof value === "string" && value.includes("github.com")) {
          urls.push(value);
        }
      }
    }

    return urls;
  }
}

