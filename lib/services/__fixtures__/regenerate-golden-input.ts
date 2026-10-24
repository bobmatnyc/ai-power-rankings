/**
 * Fixed input for the publish-mode golden test (#93).
 *
 * Why: #93 adds draft and dry-run modes to `regenerateRankings()`. The cron
 *   route and the CLI call it with no mode, so their output must stay exactly
 *   what it was. This input, with the frozen clock, produced
 *   `regenerate-publish.golden.json` on the code before #93.
 * What: tools with varied metrics (no `launch_year`, which the engine scores
 *   against the wall clock), a prior current snapshot that yields up, down,
 *   same and new movement, and the clock.
 * Test: `lib/services/ranking-generation.golden.test.ts`
 */

import type { RankingSourceTool } from "../ranking-generation.service";

function tool(
  id: string,
  name: string,
  category: string,
  info: Record<string, unknown>,
  metrics: Record<string, unknown>
): RankingSourceTool {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    category,
    status: "active",
    data: { info, metrics },
  };
}

export const GOLDEN_NOW = "2026-07-01T09:00:00.000Z";

export const GOLDEN_TOOLS: RankingSourceTool[] = [
  tool(
    "g1",
    "Alpha Agent",
    "autonomous-agent",
    {
      description: "Autonomous coding agent that plans and edits many files",
      features: ["multi-file editing", "planning", "terminal", "tests"],
      business: { pricing_model: "subscription" },
      technical: { context_window: 200000, multi_file_support: true },
    },
    { users: 2_000_000, github_stars: 40_000, monthly_arr: 50_000_000, swe_bench: { verified: 70 } }
  ),
  tool(
    "g2",
    "Bravo IDE",
    "ide-assistant",
    {
      description: "IDE assistant with completions and chat",
      features: ["autocomplete", "chat"],
      technical: { context_window: 128000 },
    },
    { users: 900_000, github_stars: 12_000, funding: 100_000_000 }
  ),
  tool(
    "g3",
    "Charlie CLI",
    "code-assistant",
    { description: "Terminal assistant", features: ["terminal"] },
    { users: 150_000, github_stars: 30_000, npm_downloads: 400_000 }
  ),
  tool(
    "g4",
    "Delta Builder",
    "app-builder",
    { description: "Builds apps from prompts", business: { pricing_model: "freemium" } },
    { users: 600_000, valuation: 1_000_000_000 }
  ),
  tool("g5", "Echo Review", "code-review", { description: "Reviews pull requests" }, { users: 20_000 }),
  tool("g6", "Foxtrot Open", "open-source-framework", { features: ["plugins"] }, { github_stars: 90_000 }),
  tool("g7", "Golf Lite", "code-assistant", {}, {}),
];

/** The prior current snapshot (bare-array shape the cron stores). */
export const GOLDEN_PREVIOUS_SNAPSHOT = {
  data: [
    { tool_id: "g1", rank: 2 },
    { tool_id: "g2", rank: 1 },
    { tool_id: "g3", rank: 9 },
    { tool_id: "g4", rank: 4 },
    { tool_id: "g6", rank: 3 },
    { tool_id: "g7", rank: 12 },
  ],
};
