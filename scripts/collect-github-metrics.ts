/**
 * GitHub Metrics Collection Script
 * Phase 1: Collect stars, forks, commits, contributors for tools with GitHub repos
 */

import dotenv from "dotenv";
import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { sql } from "drizzle-orm";

// Load environment variables
dotenv.config({ path: ".env.local" });

interface GitHubMetrics {
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

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

class GitHubMetricsCollector {
  private token: string;
  private baseUrl = "https://api.github.com";
  private rateLimit = { remaining: 5000, reset: 0 };

  constructor(token: string) {
    this.token = token;
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

/**
 * Main execution
 */
async function main() {
  console.log("🚀 GitHub Metrics Collection - Phase 1\n");

  // Check for GitHub token
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("❌ GITHUB_TOKEN not found in environment variables");
    console.error("   Please add GITHUB_TOKEN to .env.local");
    process.exit(1);
  }

  const collector = new GitHubMetricsCollector(githubToken);

  // Step 1: Verify token
  console.log("Step 1: Verifying GitHub token...");
  const isValid = await collector.verifyToken();
  if (!isValid) {
    console.error("❌ GitHub token verification failed");
    process.exit(1);
  }
  console.log("");

  // Step 2: Connect to database and fetch tools
  console.log("Step 2: Fetching tools from database...");
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    process.exit(1);
  }

  const allTools = await db.select().from(tools);
  console.log(`✅ Found ${allTools.length} tools in database\n`);

  // Step 3: Identify tools with GitHub repos
  console.log("Step 3: Identifying tools with GitHub repositories...");
  const toolsWithGitHub: Array<{
    id: string;
    name: string;
    slug: string;
    githubInfo: GitHubRepoInfo;
  }> = [];

  for (const tool of allTools) {
    const toolData = tool.data as any;
    const githubUrls = collector.findGitHubUrls(toolData);

    if (githubUrls.length > 0) {
      // Use the first valid GitHub URL
      for (const url of githubUrls) {
        const repoInfo = collector["parseGitHubUrl"](url);
        if (repoInfo) {
          toolsWithGitHub.push({
            id: tool.id,
            name: tool.name,
            slug: tool.slug,
            githubInfo: repoInfo,
          });
          break; // Use first valid URL only
        }
      }
    }
  }

  console.log(`✅ Found ${toolsWithGitHub.length} tools with GitHub repositories\n`);

  // Step 4: Show sample tools (for testing)
  console.log("Step 4: Sample tools with GitHub repos:");
  console.log("─".repeat(80));
  toolsWithGitHub.slice(0, 5).forEach((tool, idx) => {
    console.log(`${idx + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   ${tool.githubInfo.owner}/${tool.githubInfo.repo}`);
    console.log(`   ${tool.githubInfo.url}`);
  });
  console.log("─".repeat(80));
  console.log("");

  // Step 5: Collect metrics for sample tools (test mode)
  const testMode = process.argv.includes("--test");
  const fullMode = process.argv.includes("--full");
  const sampleSize = testMode ? Math.min(5, toolsWithGitHub.length) : toolsWithGitHub.length;
  const toolsToProcess = fullMode ? toolsWithGitHub : toolsWithGitHub.slice(0, sampleSize);

  if (testMode) {
    console.log(`Step 5: Testing on ${sampleSize} sample tools...\n`);
  } else if (fullMode) {
    console.log(`Step 5: Collecting metrics for ALL ${toolsWithGitHub.length} tools...\n`);
  } else {
    console.log(`Step 5: Preview mode - use --test or --full to collect metrics\n`);
    console.log("Commands:");
    console.log("  npm run tsx scripts/collect-github-metrics.ts --test   # Test on 5 tools");
    console.log("  npm run tsx scripts/collect-github-metrics.ts --full   # Run on all tools");
    return;
  }

  const results: Array<{
    tool: string;
    status: "success" | "failed";
    metrics?: GitHubMetrics;
    error?: string;
  }> = [];

  for (let i = 0; i < toolsToProcess.length; i++) {
    const tool = toolsToProcess[i];
    console.log(`[${i + 1}/${toolsToProcess.length}] ${tool.name}`);
    console.log(`   Repository: ${tool.githubInfo.owner}/${tool.githubInfo.repo}`);

    try {
      const metrics = await collector.collectMetrics(
        tool.githubInfo.owner,
        tool.githubInfo.repo
      );

      if (metrics) {
        console.log(`   ✅ Success! Stars: ${metrics.stars}, Forks: ${metrics.forks}`);

        // Get current tool data
        const currentTool = await db
          .select()
          .from(tools)
          .where(sql`id = ${tool.id}`)
          .limit(1);

        if (currentTool.length > 0) {
          const currentData = currentTool[0].data as any;

          // Merge metrics into tool data
          const updatedData = {
            ...currentData,
            metrics: {
              ...(currentData.metrics || {}),
              github: metrics,
            },
          };

          // Update database with merged data
          await db
            .update(tools)
            .set({
              data: updatedData as any,
              updatedAt: new Date(),
            })
            .where(sql`id = ${tool.id}`);

          console.log(`   💾 Stored in database`);
        }

        results.push({ tool: tool.name, status: "success", metrics });
      } else {
        console.log(`   ⚠️  No metrics collected`);
        results.push({
          tool: tool.name,
          status: "failed",
          error: "No metrics returned",
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
      results.push({
        tool: tool.name,
        status: "failed",
        error: String(error),
      });
    }

    console.log("");
    // Small delay to be nice to GitHub API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Step 6: Summary report
  console.log("\n" + "=".repeat(80));
  console.log("📊 EXECUTION REPORT");
  console.log("=".repeat(80));
  console.log(`Total tools in database: ${allTools.length}`);
  console.log(`Tools with GitHub repos: ${toolsWithGitHub.length}`);
  console.log(`Tools processed: ${toolsToProcess.length}`);
  console.log(`Successful: ${results.filter((r) => r.status === "success").length}`);
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
  console.log("");

  if (results.some((r) => r.status === "success")) {
    console.log("Sample metrics collected:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "success")
      .slice(0, 3)
      .forEach((result) => {
        console.log(`${result.tool}:`);
        if (result.metrics) {
          console.log(`  ⭐ Stars: ${result.metrics.stars}`);
          console.log(`  🍴 Forks: ${result.metrics.forks}`);
          console.log(`  📝 Commits (30d): ${result.metrics.commit_count_30d}`);
          console.log(`  👥 Contributors: ${result.metrics.contributors_count}`);
        }
      });
  }

  if (results.some((r) => r.status === "failed")) {
    console.log("\nFailed tools:");
    console.log("─".repeat(80));
    results
      .filter((r) => r.status === "failed")
      .forEach((result) => {
        console.log(`❌ ${result.tool}: ${result.error}`);
      });
  }

  console.log("\n✅ GitHub metrics collection complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
