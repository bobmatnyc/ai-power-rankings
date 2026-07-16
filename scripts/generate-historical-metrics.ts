#!/usr/bin/env tsx
/**
 * Generate research-augmented historical metrics override files.
 *
 * Produces one `data/historical-metrics/<period>.json` per month of the backfill
 * gap (Dec 2025 -> Jun 2026). Each file supplies PERIOD-SPECIFIC reconstructed
 * metrics for the v7.6 ranking engine so the "Historical AI Tool Rankings" chart
 * shows genuine movement instead of a duplicated flat line.
 *
 * Data recovery (per the proven design):
 *   - npm  downloads_last_month : REAL   -> summed from api.npmjs.org range API.
 *   - PyPI downloads_last_month : REAL where the rolling window still covers the
 *                                 month; otherwise held_flat / not_applicable.
 *   - GitHub stars              : INTERPOLATED between repo creation (0) and the
 *                                 current total (linear; documented estimate).
 *   - users/arr/valuation/funding/employees/swe_bench.verified:
 *                                 taken VERBATIM (value + fidelity) from the
 *                                 recovered business-metrics dataset — a dated,
 *                                 URL-sourced research pass. See
 *                                 lib/historical-metrics/business-metrics.ts.
 *                                 Fidelity is never upgraded here, and fields the
 *                                 research could not substantiate emit nothing.
 *
 * Every leaf carries {value, fidelity, source, as_of, recovery_note}. The loader
 * (applyHistoricalMetricsOverride) extracts `.value`; the rest is persisted
 * provenance. Re-runnable and idempotent: each run overwrites the files and logs
 * a per-metric fidelity breakdown.
 *
 * This script performs NO database access and writes only JSON files. Usage:
 *   npx tsx scripts/generate-historical-metrics.ts
 *   npx tsx scripts/generate-historical-metrics.ts --only=2026-03
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  businessLeavesForPeriod,
  indexRecoveryByLiveSlug,
  loadRecoveryDataset,
} from "@/lib/historical-metrics/business-metrics";
import { resolveLiveSlug, slugify } from "@/lib/historical-metrics/slugify";
import {
  interpolateMonthly,
  sumMonthlyDownloads,
  type DailyDownload,
} from "@/lib/historical-metrics/timeseries";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "historical-metrics");
const ROSTER_PATH = join(ROOT, "data", "extracted-rankings", "2025-09.json");
/** Sourced business metrics (ARR/users/SWE-bench/valuation/funding/employees). */
const RECOVERY_PATH = join(OUT_DIR, "sources", "business-metrics-recovery.json");

/** The backfill gap: Dec 2025 through Jun 2026 (inclusive). */
const PERIODS = [
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
];

/** npm range covering the whole gap window (one call per package). */
const NPM_RANGE_START = "2025-12-01";
const NPM_RANGE_END = "2026-06-30";

/** "now" anchor used as the end point for GitHub-star interpolation. */
const CURRENT_PERIOD = "2026-07";

type Fidelity = "real" | "interpolated" | "held_flat" | "not_applicable";

interface Leaf {
  value: number | null;
  fidelity: Fidelity;
  source: string | null;
  as_of: string | null;
  recovery_note: string;
}

interface ToolSource {
  npm?: string;
  pypi?: string;
  github?: string; // "owner/repo"
  vscode?: string; // marketplace itemName (documented gap; value stays null)
}

/**
 * Per-tool EXTERNAL-API source mapping (keyed by slug = slugify(display name)).
 * npm/pypi/github were probe-verified to resolve.
 *
 * Business metrics are deliberately NOT listed here: they come from the
 * recovered dataset (RECOVERY_PATH), keyed by live `tools.slug`. Previously this
 * table carried hand-mined business anchors, some of which the sourced research
 * pass could not substantiate (e.g. a "$60B valuation / SpaceX acquisition"
 * anchor for Cursor with no primary source behind it). Sourced data now wins;
 * see lib/historical-metrics/business-metrics.ts.
 *
 * Tools absent from this table (or metrics absent for a tool) are intentionally
 * left to the live `tools.data` value in production — we only emit leaves we can
 * substantiate.
 */
const SOURCES: Record<string, ToolSource> = {
  "claude-code": { npm: "@anthropic-ai/claude-code" },
  "bolt-new": { github: "stackblitz/bolt.new" },
  aider: { github: "Aider-AI/aider", pypi: "aider-chat" },
  cline: { github: "cline/cline", vscode: "saoudrizwan.claude-dev" },
  continue: { github: "continuedev/continue", vscode: "Continue.continue" },
  zed: { github: "zed-industries/zed" },
  "openai-codex-cli": { npm: "@openai/codex", github: "openai/codex" },
  "snyk-code": { npm: "snyk", github: "snyk/cli" },
  openhands: { github: "All-Hands-AI/OpenHands", pypi: "openhands-ai" },
};

// ---------------------------------------------------------------------------
// Network (best-effort, graceful degradation)
// ---------------------------------------------------------------------------

async function fetchJson(url: string, retries = 2): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "ai-power-rankings-historical-backfill" } });
      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchNpmDaily(pkg: string): Promise<DailyDownload[] | null> {
  const url = `https://api.npmjs.org/downloads/range/${NPM_RANGE_START}:${NPM_RANGE_END}/${pkg}`;
  const json = (await fetchJson(url)) as { downloads?: DailyDownload[]; error?: string } | null;
  if (!json || json.error || !Array.isArray(json.downloads)) return null;
  return json.downloads;
}

async function fetchGithub(repo: string): Promise<{ stars: number; created: string } | null> {
  const json = (await fetchJson(`https://api.github.com/repos/${repo}`)) as
    | { stargazers_count?: number; created_at?: string }
    | null;
  if (!json || typeof json.stargazers_count !== "number" || !json.created_at) return null;
  return { stars: json.stargazers_count, created: json.created_at };
}

/** Best-effort PyPI daily downloads via pypistats overall (rolling window). */
async function fetchPypiDaily(pkg: string): Promise<DailyDownload[] | null> {
  const json = (await fetchJson(`https://pypistats.org/api/packages/${pkg}/overall?mirrors=false`)) as
    | { data?: Array<{ date?: string; downloads?: number }> }
    | null;
  if (!json || !Array.isArray(json.data)) return null;
  return json.data
    .filter((d) => typeof d.date === "string")
    .map((d) => ({ day: d.date as string, downloads: Number(d.downloads) || 0 }));
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

interface RosterEntry {
  tool_id: string;
  name: string;
  /** Display-name-derived slug; used to key the SOURCES table above. */
  slug: string;
  /**
   * Live `tools.slug` value used as the override-file key: `slug` run through
   * `resolveLiveSlug` (see lib/historical-metrics/slugify.ts) so it matches
   * `applyHistoricalMetricsOverride`'s lookup even when the live slug carries a
   * suffix the display name can't reproduce.
   */
  overrideKey: string;
}

function loadRoster(): RosterEntry[] {
  const raw = JSON.parse(readFileSync(ROSTER_PATH, "utf8")) as {
    rankings: Array<{ tool_id: string; tool_name: string }>;
  };
  return raw.rankings.map((r) => {
    const slug = slugify(r.tool_name);
    return {
      tool_id: String(r.tool_id),
      name: r.tool_name,
      slug,
      overrideKey: resolveLiveSlug(slug),
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface FetchCaches {
  npm: Map<string, DailyDownload[] | null>;
  github: Map<string, { stars: number; created: string } | null>;
  pypi: Map<string, DailyDownload[] | null>;
}

function setLeaf(metrics: Record<string, unknown>, path: string[], leaf: Leaf): void {
  let node = metrics;
  for (let i = 0; i < path.length - 1; i++) {
    node[path[i]!] = (node[path[i]!] as Record<string, unknown>) ?? {};
    node = node[path[i]!] as Record<string, unknown>;
  }
  node[path[path.length - 1]!] = leaf;
}

type FidelityCounts = Record<string, Record<Fidelity, number>>;

function bump(counts: FidelityCounts, metric: string, fidelity: Fidelity): void {
  counts[metric] ??= { real: 0, interpolated: 0, held_flat: 0, not_applicable: 0 };
  counts[metric]![fidelity]++;
}

async function buildCaches(): Promise<FetchCaches> {
  const npm = new Map<string, DailyDownload[] | null>();
  const github = new Map<string, { stars: number; created: string } | null>();
  const pypi = new Map<string, DailyDownload[] | null>();

  const npmPkgs = new Set<string>();
  const ghRepos = new Set<string>();
  const pypiPkgs = new Set<string>();
  for (const s of Object.values(SOURCES)) {
    if (s.npm) npmPkgs.add(s.npm);
    if (s.github) ghRepos.add(s.github);
    if (s.pypi) pypiPkgs.add(s.pypi);
  }

  for (const pkg of npmPkgs) {
    process.stdout.write(`  npm   ${pkg} … `);
    const d = await fetchNpmDaily(pkg);
    npm.set(pkg, d);
    console.log(d ? `${d.length} days` : "UNAVAILABLE");
  }
  for (const repo of ghRepos) {
    process.stdout.write(`  gh    ${repo} … `);
    const d = await fetchGithub(repo);
    github.set(repo, d);
    console.log(d ? `${d.stars} stars (since ${d.created.slice(0, 7)})` : "UNAVAILABLE");
  }
  for (const pkg of pypiPkgs) {
    process.stdout.write(`  pypi  ${pkg} … `);
    const d = await fetchPypiDaily(pkg);
    pypi.set(pkg, d);
    console.log(d ? `${d.length} days` : "UNAVAILABLE (rolling window / rate-limited)");
  }

  return { npm, github, pypi };
}

function buildToolMetrics(
  src: ToolSource | undefined,
  businessRecord: Record<string, unknown> | undefined,
  period: string,
  caches: FetchCaches,
  counts: FidelityCounts
): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};
  if (!src) return addBusinessLeaves(metrics, businessRecord, period, counts);

  // npm downloads (REAL)
  if (src.npm) {
    const daily = caches.npm.get(src.npm);
    if (daily) {
      const value = sumMonthlyDownloads(daily, period);
      setLeaf(metrics, ["npm", "downloads_last_month"], {
        value,
        fidelity: "real",
        source: `https://api.npmjs.org/downloads/range/${NPM_RANGE_START}:${NPM_RANGE_END}/${src.npm}`,
        as_of: period,
        recovery_note: `Sum of daily npm downloads for calendar month ${period}, retrieved live from the npm range API for ${src.npm}.`,
      });
      bump(counts, "npm.downloads_last_month", "real");
    }
  }

  // PyPI downloads (REAL where the rolling window still covers the month)
  if (src.pypi) {
    const daily = caches.pypi.get(src.pypi);
    const value = daily ? sumMonthlyDownloads(daily, period) : 0;
    if (daily && value > 0) {
      setLeaf(metrics, ["pypi", "downloads_last_month"], {
        value,
        fidelity: "real",
        source: `https://pypistats.org/api/packages/${src.pypi}/overall`,
        as_of: period,
        recovery_note: `Sum of daily PyPI downloads for ${period} from the pypistats overall series (mirrors excluded).`,
      });
      bump(counts, "pypi.downloads_last_month", "real");
    } else {
      setLeaf(metrics, ["pypi", "downloads_last_month"], {
        value: null,
        fidelity: "not_applicable",
        source: `https://pypistats.org/api/packages/${src.pypi}/overall`,
        as_of: null,
        recovery_note: `PyPI stats retain only a rolling ~180-day window; ${period} has rolled off (or the source was rate-limited). Poll monthly going forward rather than back-filling old months.`,
      });
      bump(counts, "pypi.downloads_last_month", "not_applicable");
    }
  }

  // GitHub stars (INTERPOLATED: creation -> current)
  if (src.github) {
    const gh = caches.github.get(src.github);
    if (gh) {
      const createdPeriod = gh.created.slice(0, 7);
      const value = interpolateMonthly(0, createdPeriod, gh.stars, CURRENT_PERIOD, period);
      setLeaf(metrics, ["github", "stars"], {
        value,
        fidelity: "interpolated",
        source: `https://api.github.com/repos/${src.github} (current stargazers_count=${gh.stars}) linearly interpolated from repo creation ${createdPeriod} (0 stars) to ${CURRENT_PERIOD}`,
        as_of: `estimated for ${period}`,
        recovery_note: `GitHub's REST API returns only the current total; monthly history requires paginating stargazer timestamps or star-history.com. This is a documented linear-interpolation estimate.`,
      });
      bump(counts, "github.stars", "interpolated");
    }
  }

  // VS Code installs (documented gap -> held_flat null)
  if (src.vscode) {
    setLeaf(metrics, ["vscode", "installs"], {
      value: null,
      fidelity: "held_flat",
      source: `https://marketplace.visualstudio.com/items?itemName=${src.vscode}`,
      as_of: null,
      recovery_note: `The VS Code Marketplace exposes only a single current cumulative install counter with no dated history. Left null rather than mislabeling today's total as a ${period} reading.`,
    });
    bump(counts, "vscode.installs", "held_flat");
  }

  return addBusinessLeaves(metrics, businessRecord, period, counts);
}

/**
 * Merge the sourced business leaves (ARR/users/SWE-bench/valuation/funding/
 * employees) for this tool-month. Values and fidelity come straight from the
 * recovery dataset; anything it could not substantiate emits nothing, so the
 * live `tools.data` value survives untouched.
 */
function addBusinessLeaves(
  metrics: Record<string, unknown>,
  businessRecord: Record<string, unknown> | undefined,
  period: string,
  counts: FidelityCounts
): Record<string, unknown> {
  for (const { path, leaf } of businessLeavesForPeriod(businessRecord, period)) {
    setLeaf(metrics, path, leaf);
    bump(counts, path.join("."), leaf.fidelity);
  }
  return metrics;
}

function overallConfidence(metrics: Record<string, unknown>): string {
  const fidelities: Fidelity[] = [];
  const walk = (node: unknown) => {
    if (node && typeof node === "object") {
      if ("fidelity" in (node as Record<string, unknown>)) {
        fidelities.push((node as Leaf).fidelity);
      } else {
        Object.values(node as Record<string, unknown>).forEach(walk);
      }
    }
  };
  walk(metrics);
  if (fidelities.length === 0) return "none";
  const real = fidelities.filter((f) => f === "real").length;
  if (real > 0 && real >= fidelities.length / 2) return "medium-high";
  if (real > 0) return "medium";
  if (fidelities.some((f) => f === "interpolated")) return "low-medium";
  return "low";
}

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const periods = only ? PERIODS.filter((p) => p === only) : PERIODS;
  if (only && periods.length === 0) {
    console.error(`--only=${only} is not one of ${PERIODS.join(", ")}`);
    process.exit(1);
  }

  const roster = loadRoster();
  const business = indexRecoveryByLiveSlug(loadRecoveryDataset(RECOVERY_PATH));
  const matched = roster.filter((r) => business.has(r.overrideKey)).length;
  console.log(`\n📚 Roster: ${roster.length} tools (from ${ROSTER_PATH.replace(ROOT + "/", "")})`);
  console.log(
    `💼 Business metrics: ${business.size} tools in ${RECOVERY_PATH.replace(ROOT + "/", "")} — ${matched} matched to the roster`
  );
  console.log(`🗓  Periods: ${periods.join(", ")}\n`);
  console.log("🌐 Fetching external time-series (npm / GitHub / PyPI)…");
  const caches = await buildCaches();

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const grandCounts: FidelityCounts = {};

  for (const period of periods) {
    const counts: FidelityCounts = {};
    const tools: Record<string, unknown> = {};

    for (const entry of roster) {
      const src = SOURCES[entry.slug];
      const businessRecord = business.get(entry.overrideKey);
      const metrics = buildToolMetrics(src, businessRecord, period, caches, counts);
      if (Object.keys(metrics).length === 0) {
        // No substantiated data for this tool this month: emit an empty metrics
        // block so the file documents the full roster, but the loader will merge
        // nothing (production keeps the live tools.data value).
        tools[entry.overrideKey] = {
          display_name: entry.name,
          metrics: {},
          provenance: {
            overall_confidence: "none",
            notes: "No external time-series or dated anchor available for this tool/month; live tools.data value is retained in production.",
          },
        };
        continue;
      }
      tools[entry.overrideKey] = {
        display_name: entry.name,
        metrics,
        provenance: {
          overall_confidence: overallConfidence(metrics),
          notes: "Reconstructed metrics; see per-leaf fidelity/source/recovery_note.",
        },
      };
    }

    const file = {
      $schema: "historical-metrics-override/v1",
      period,
      reconstructed: true,
      generated_at: generatedAt,
      methodology_version: "2.0",
      notes:
        "Research-augmented historical backfill for the v7.7 ranking engine. Every leaf carries fidelity/source/as_of provenance; the loader (applyHistoricalMetricsOverride) extracts `.value` into tools.data.metrics.* and threads provenance into the persisted ranking row. reconstructed=true flags this as a synthetic period. Business metrics (users/monthly_arr/valuation/funding/employees/swe_bench.verified) are carried verbatim — value AND fidelity — from the sourced recovery dataset at data/historical-metrics/sources/business-metrics-recovery.json; fidelity is never upgraded, and any field/month that research could not substantiate is omitted so the live tools.data value is retained.",
      fidelity_levels: {
        real: "Directly retrieved from an external time-series API for this exact calendar month, or a dated primary-source disclosure (funding round, benchmark result, announced ARR) effective for this month.",
        interpolated: "Linear interpolation between two real dated anchor points (news/launch events + current snapshot).",
        held_flat: "No time-series source exists; the last known real value is carried forward, explicitly flagged. Never a real monthly reading.",
        not_applicable: "No value exists or is recoverable for this tool/metric/month.",
      },
      tools,
    };

    const outPath = join(OUT_DIR, `${period}.json`);
    writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");

    // Roll counts into the grand total and print a per-file summary.
    const summary = Object.entries(counts)
      .map(([m, c]) => `${m}[real:${c.real} interp:${c.interpolated} flat:${c.held_flat} n/a:${c.not_applicable}]`)
      .join("  ");
    console.log(`✅ ${outPath.replace(ROOT + "/", "")}  —  ${summary || "no substantiated metrics"}`);
    for (const [m, c] of Object.entries(counts)) {
      grandCounts[m] ??= { real: 0, interpolated: 0, held_flat: 0, not_applicable: 0 };
      (Object.keys(c) as Fidelity[]).forEach((f) => (grandCounts[m]![f] += c[f]));
    }
  }

  console.log("\n📊 Per-metric fidelity totals (all periods):");
  for (const [m, c] of Object.entries(grandCounts)) {
    console.log(`   ${m.padEnd(26)} real:${c.real}  interpolated:${c.interpolated}  held_flat:${c.held_flat}  not_applicable:${c.not_applicable}`);
  }
  console.log(`\n✨ Wrote ${periods.length} override file(s) to ${OUT_DIR.replace(ROOT + "/", "")}\n`);
}

main().catch((err) => {
  console.error("\n💥 generate-historical-metrics failed:", err);
  process.exit(1);
});
