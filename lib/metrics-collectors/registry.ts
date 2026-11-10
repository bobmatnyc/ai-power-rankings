/**
 * Collector registry for the collect-metrics cron route (#95).
 *
 * Why: the route runs one collector shard per invocation and needs one uniform
 *   call per tool, while the four collector classes each have their own entry
 *   point, which the CLIs keep using unchanged.
 * What: the part names, the shard count per part, the numeric keys that get a
 *   `non_numeric` flag, and an adapter per part. Each adapter calls the same
 *   class method its CLI calls, so the matching heuristics are the CLI's.
 *   A found package becomes `found`; a CLI "not found" becomes `not_found`; the
 *   GitHub adapter throws on a failed call (403, 429, network), which the shard
 *   counts as `failed`; a spent request budget becomes `skipped_budget` (#95).
 *   #95: the GitHub adapter reads its token from `METRICS_GITHUB_TOKEN` and records
 *   a 404 on the repo call as `not_found`.
 * Test: `tests/unit/metrics-collect-route-95.test.ts`, `tests/unit/metrics-github-token-shards-95.test.ts`
 */

import { abortableSleep, type CollectorOptions } from "./fetch-signal";
import { GitHubMetricsCollector, GitHubRepoNotFoundError } from "./github";
import { NpmMetricsCollector } from "./npm";
import { PyPIMetricsCollector } from "./pypi";
import { VSCodeMarketplaceCollector } from "./vscode";

export const COLLECTOR_PARTS = ["github", "pypi", "npm", "vscode"] as const;
export type CollectorPart = (typeof COLLECTOR_PARTS)[number];

/**
 * Shards per part. `vercel.json` must carry exactly shards 0..of-1 for each part.
 * #95: github 6. With a token a tool costs 3 sequential requests (1 s design latency each)
 * plus GITHUB_PAUSE_MS, 4 s. 200 tools over 6 shards is 34 a shard, 44 at mean + 2 sd:
 * 176 s, 65% of the 270 s deadline. 5 shards would be 52 tools, 208 s, 77%.
 */
export const SHARD_COUNTS: Record<CollectorPart, number> = { github: 6, pypi: 2, npm: 4, vscode: 4 };

/** #95: the github adapter's pause between tools; part of the per-tool cost SHARD_COUNTS.github is sized on. */
export const GITHUB_PAUSE_MS = 1000;

/** Leaf `source` for each part's history key. */
export const PART_SOURCES: Record<CollectorPart, string> = {
  github: "github-api",
  pypi: "pypi",
  npm: "npm-registry",
  vscode: "vscode-marketplace",
};

/** Keys whose value must be a finite number; anything else is kept and flagged. */
export const NUMERIC_KEYS: Record<CollectorPart, readonly string[]> = {
  github: ["stars", "forks", "watchers", "open_issues", "subscribers_count", "commit_count_30d", "contributors_count"],
  pypi: ["downloads_last_month"],
  npm: ["downloads_last_month", "downloads_last_week", "dependencies_count"],
  vscode: ["installs", "rating", "ratings_count"],
};

export interface CollectorTool {
  id: string;
  slug: string;
  name: string;
  data: unknown;
}

export type CollectOutcome =
  | { kind: "found"; metrics: Record<string, unknown> }
  /** `noRequest`: decided without any fetch, so no rate-limit pause is owed. */
  | { kind: "not_found"; noRequest?: boolean }
  | { kind: "failed"; error: string }
  /** #95: the request budget cannot cover this tool; the shard stops fetching and skips the rest. */
  | { kind: "skipped_budget"; reason: string };

export interface CollectorAdapter {
  /** Runs once before the first tool; throws when the part cannot run at all. */
  init(): Promise<void>;
  collect(tool: CollectorTool): Promise<CollectOutcome>;
  /** The CLI's pause between tools; returns early when `signal` aborts. */
  pause(signal: AbortSignal): Promise<void>;
  /**
   * #95: why the run collected less than the part's full metric set, or null. A non-null
   * reason turns an `ok` shard `partial` and goes to the ledger `error`; rows are still written.
   */
  degraded?(): string | null;
}

export interface AdapterOptions extends CollectorOptions {
  env: Record<string, string | undefined>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

/** The CLI-equivalent adapter for one part. */
export function createCollectorAdapter(part: CollectorPart, options: AdapterOptions): CollectorAdapter {
  const signal = options.signal;
  switch (part) {
    case "npm": {
      const collector = new NpmMetricsCollector({ signal });
      return {
        init: async () => {},
        collect: async (tool) => {
          const metrics = await collector.findPackageForTool(tool.name, tool.slug, tool.data);
          return metrics ? { kind: "found", metrics: asRecord(metrics) } : { kind: "not_found" };
        },
        pause: (s) => abortableSleep(1000, s),
      };
    }
    case "pypi": {
      const collector = new PyPIMetricsCollector({ signal });
      return {
        init: async () => {},
        collect: async (tool) => {
          const metrics = await collector.findPackageForTool(tool.name, tool.slug, tool.data);
          return metrics ? { kind: "found", metrics: asRecord(metrics) } : { kind: "not_found" };
        },
        pause: (s) => abortableSleep(1000, s),
      };
    }
    case "vscode": {
      const collector = new VSCodeMarketplaceCollector({ signal });
      return {
        init: async () => {},
        collect: async (tool) => {
          const metrics = await collector.findExtensionForTool(tool.name, tool.slug, tool.data);
          return metrics ? { kind: "found", metrics: asRecord(metrics) } : { kind: "not_found" };
        },
        pause: (s) => abortableSleep(2000, s),
      };
    }
    case "github": {
      // #95: owner ruling D99 allows one read-only token for this cron, under this name only.
      const token = options.env["METRICS_GITHUB_TOKEN"];
      // #95: no token is still a supported mode (owner ruling A9e): repo metadata only, no throw.
      const collector = new GitHubMetricsCollector(token, { signal });
      return {
        init: async () => {
          // #95: only a present token is verified; a bad token still fails the shard.
          if (collector.authenticated && !(await collector.verifyToken())) {
            throw new Error("GitHub token verification failed");
          }
        },
        collect: async (tool) => {
          // Same discovery as the CLI: first parseable GitHub URL in tool.data.
          for (const url of collector.findGitHubUrls(tool.data ?? {})) {
            const repo = collector["parseGitHubUrl"](url);
            if (!repo) continue;
            // #95: stop before a tool the remaining budget cannot cover.
            const stop = collector.budgetStopReason();
            if (stop) return { kind: "skipped_budget", reason: stop };
            try {
              // #95: a throw (403, 429, network) reaches the shard as a failed tool, never a 0 metric.
              const metrics = await collector.fetchMetrics(repo.owner, repo.repo);
              return { kind: "found", metrics: asRecord(metrics) };
            } catch (error) {
              // #95: a repo 404 is not_found, as in pypi; the coverage floor judges stale URLs.
              if (error instanceof GitHubRepoNotFoundError) return { kind: "not_found" };
              throw error;
            }
          }
          return { kind: "not_found", noRequest: true };
        },
        pause: (s) => abortableSleep(GITHUB_PAUSE_MS, s),
        // #95: a tokenless run (unset, blank or misspelt name) drops commit_count_30d and
        // contributors_count, so it must not pass as `ok`; the check fails a partial shard.
        degraded: () =>
          collector.authenticated
            ? null
            : "METRICS_GITHUB_TOKEN is not set: tokenless run, commit_count_30d and contributors_count not collected",
      };
    }
  }
}
