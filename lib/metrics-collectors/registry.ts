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
 *   GitHub CLI's "no metrics returned" becomes `failed`, as the CLI counts it.
 * Test: `tests/unit/metrics-collect-route-95.test.ts`
 */

import { abortableSleep, type CollectorOptions } from "./fetch-signal";
import { GitHubMetricsCollector } from "./github";
import { NpmMetricsCollector } from "./npm";
import { PyPIMetricsCollector } from "./pypi";
import { VSCodeMarketplaceCollector } from "./vscode";

export const COLLECTOR_PARTS = ["github", "pypi", "npm", "vscode"] as const;
export type CollectorPart = (typeof COLLECTOR_PARTS)[number];

/** Shards per part. `vercel.json` must carry exactly shards 0..of-1 for each part. */
export const SHARD_COUNTS: Record<CollectorPart, number> = { github: 1, pypi: 2, npm: 4, vscode: 4 };

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
      const token = options.env["GITHUB_TOKEN"];
      // #95: no token is a supported mode (owner ruling A9e): repo metadata only, no throw.
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
            // #95: a throw (403, 429, network) reaches the shard as a failed tool, never a 0 metric.
            const metrics = await collector.fetchMetrics(repo.owner, repo.repo);
            return { kind: "found", metrics: asRecord(metrics) };
          }
          return { kind: "not_found", noRequest: true };
        },
        pause: (s) => abortableSleep(1000, s),
      };
    }
  }
}
