/**
 * GitHub REST collector, moved unchanged from scripts/collect-github-metrics.ts (#95).
 *
 * Why: the CLI and the collect-metrics cron route share one class, so both use
 *   the same matching heuristics. The only change is a per-fetch timeout.
 * What: see scripts/collect-github-metrics.ts for the CLI that drives it.
 * Test: `tests/unit/metrics-collectors-95.test.ts`
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
  commit_count_30d: number;
  contributors_count: number;
  last_updated: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

export class GitHubMetricsCollector {
  private token: string;
  private baseUrl = "https://api.github.com";
  private rateLimit = { remaining: 5000, reset: 0 };

  // #95: the caller's signal (the cron run deadline) joins every fetch's timeout.
  private signal: AbortSignal | undefined;

  constructor(token: string, options: CollectorOptions = {}) {
    this.token = token;
    this.signal = options.signal;
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

  /**
   * Verify GitHub token and check rate limits
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rate_limit`, {
        signal: fetchSignal(this.signal),
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        console.error(`GitHub API error: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      this.rateLimit = {
        remaining: data.resources.core.remaining,
        reset: data.resources.core.reset,
      };

      console.log(`✅ GitHub token verified`);
      console.log(`   Rate limit: ${this.rateLimit.remaining}/5000`);
      console.log(
        `   Resets at: ${new Date(this.rateLimit.reset * 1000).toLocaleString()}`
      );

      return true;
    } catch (error) {
      console.error("Failed to verify GitHub token:", error);
      return false;
    }
  }

  /**
   * Make GitHub API request with rate limit handling
   */
  private async githubRequest(endpoint: string): Promise<any> {
    // Check if we're approaching rate limit
    if (this.rateLimit.remaining < 10) {
      const waitTime = this.rateLimit.reset * 1000 - Date.now();
      if (waitTime > 0) {
        console.log(`⏳ Rate limit low, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      signal: fetchSignal(this.signal),
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // Update rate limit info from response headers
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    if (remaining && reset) {
      this.rateLimit = {
        remaining: parseInt(remaining),
        reset: parseInt(reset),
      };
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get commit count for last 30 days
   */
  private async getCommitCount30d(owner: string, repo: string): Promise<number> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const commits = await this.githubRequest(
        `/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=100`
      );

      return Array.isArray(commits) ? commits.length : 0;
    } catch (error) {
      console.error(`   ⚠️  Failed to get commit count: ${error}`);
      return 0;
    }
  }

  /**
   * Get contributors count
   */
  private async getContributorsCount(owner: string, repo: string): Promise<number> {
    try {
      const contributors = await this.githubRequest(
        `/repos/${owner}/${repo}/contributors?per_page=1&anon=true`
      );

      // GitHub doesn't return total count in response body, need to parse Link header
      // For now, just return array length for first page
      return Array.isArray(contributors) ? contributors.length : 0;
    } catch (error) {
      console.error(`   ⚠️  Failed to get contributors count: ${error}`);
      return 0;
    }
  }

  /**
   * Collect all metrics for a GitHub repository
   */
  async collectMetrics(owner: string, repo: string): Promise<GitHubMetrics | null> {
    try {
      console.log(`   Fetching repo data...`);
      const repoData = await this.githubRequest(`/repos/${owner}/${repo}`);

      console.log(`   Fetching commit count (30 days)...`);
      const commitCount = await this.getCommitCount30d(owner, repo);

      console.log(`   Fetching contributors count...`);
      const contributorsCount = await this.getContributorsCount(owner, repo);

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
        commit_count_30d: commitCount,
        contributors_count: contributorsCount,
        last_updated: new Date().toISOString(),
      };

      return metrics;
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

