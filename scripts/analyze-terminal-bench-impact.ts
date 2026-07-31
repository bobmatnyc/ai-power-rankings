#!/usr/bin/env tsx

/**
 * Terminal-Bench impact analysis (v7.9 calibration) — DRY-RUN, NO DB, NO PUBLISH.
 *
 * Produces ONE 3-way table over the full 31-tool roster to isolate Terminal-
 * Bench's marginal effect on top of the anchor/cap retune:
 *
 *   A = baseline        : SWE anchor 70 + legacy additive-then-clip bonuses, NO TB
 *                         (reproduces the v7.8-era behavior)
 *   B = retuned, no TB   : SWE anchor 88 + headroom bonuses, NO TB
 *                         (isolates what the calibration change alone does)
 *   C = retuned + TB     : SWE anchor 88 + headroom bonuses + Terminal-Bench blend
 *                         (the proposed v7.9 state)
 *
 * All three score the same in-memory roster with EMPTY base metrics (mirroring
 * `scripts/generate-v76-rankings.ts --dry-run`), so the override fully drives the
 * result. A/B differ only in engine calibration; B/C differ only in whether the
 * Terminal-Bench leaves are present. Nothing touches the database.
 *
 * Run: npx tsx scripts/analyze-terminal-bench-impact.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { slugify } from "@/lib/historical-metrics/slugify";
import {
  ALGORITHM_V76_WEIGHTS,
  RankingEngineV76,
  SWE_BENCH_ANCHOR,
  TB_BLEND_WEIGHT,
  type AgenticCalibration,
  type ToolMetricsV76,
} from "@/lib/ranking-algorithm-v76";
import {
  applyHistoricalMetricsOverride,
  type HistoricalMetricsOverride,
  type RankingSourceTool,
} from "@/lib/services/ranking-generation.service";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PERIOD = "2026-06";
const CLOCK = new Date(`${PERIOD}-01T00:00:00Z`);

/** Tools that carry a Terminal-Bench leaf (the only ones B→C can move). */
const MATCHED_SLUGS = ["claude-code", "openai-codex-cli"] as const;

/** Calibration presets for the three columns. */
const CAL_BASELINE: AgenticCalibration = { sweBenchAnchor: 70, bonusModel: "additive" };
const CAL_RETUNED: AgenticCalibration = {}; // defaults = v7.9 (anchor 88, headroom)

interface Row {
  slug: string;
  name: string;
  score: number;
  rank: number;
  agentic: number;
}

function loadRoster(): RankingSourceTool[] {
  const raw = JSON.parse(
    readFileSync(join(ROOT, "data", "extracted-rankings", "2025-09.json"), "utf8")
  ) as { rankings: Array<{ tool_id: string; tool_name: string }> };
  return raw.rankings.map((r) => ({
    id: String(r.tool_id),
    name: r.tool_name,
    slug: slugify(r.tool_name),
    category: "code-editor",
    status: "active",
    data: { metrics: {} } as Record<string, unknown>,
  }));
}

function loadOverride(): HistoricalMetricsOverride {
  return JSON.parse(
    readFileSync(join(ROOT, "data", "historical-metrics", `${PERIOD}.json`), "utf8")
  ) as HistoricalMetricsOverride;
}

/** Deep-clone the override and delete every `terminal_bench` leaf. */
function stripTerminalBench(o: HistoricalMetricsOverride): HistoricalMetricsOverride {
  const clone = structuredClone(o);
  for (const tool of Object.values(clone.tools)) {
    if (tool.metrics && "terminal_bench" in tool.metrics) {
      delete (tool.metrics as Record<string, unknown>)["terminal_bench"];
    }
  }
  return clone;
}

/** Score + rank a board with a given calibration and override (pure, no DB). */
function scoreBoard(
  roster: RankingSourceTool[],
  override: HistoricalMetricsOverride,
  calibration: AgenticCalibration
): Row[] {
  const engine = new RankingEngineV76(ALGORITHM_V76_WEIGHTS, calibration);
  const tools = applyHistoricalMetricsOverride(roster, override);
  return tools
    .map((tool) => {
      const toolData = (tool.data ?? {}) as Record<string, unknown>;
      const metrics: ToolMetricsV76 = {
        tool_id: tool.id,
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        status: tool.status,
        info: toolData,
        metrics: (toolData["metrics"] as Record<string, unknown>) ?? {},
      } as ToolMetricsV76;
      const s = engine.calculateToolScore(metrics, CLOCK);
      return {
        slug: tool.slug,
        name: tool.name,
        score: s.overallScore,
        agentic: s.factorScores.agenticCapability,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function main(): void {
  const roster = loadRoster();
  const full = loadOverride();
  const stripped = stripTerminalBench(full);

  const A = scoreBoard(roster, stripped, CAL_BASELINE);
  const B = scoreBoard(roster, stripped, CAL_RETUNED);
  const C = scoreBoard(roster, full, CAL_RETUNED);

  const bySlug = (rows: Row[]) => new Map(rows.map((r) => [r.slug, r]));
  const mA = bySlug(A);
  const mB = bySlug(B);
  const mC = bySlug(C);

  console.log("\n" + "=".repeat(96));
  console.log(`TERMINAL-BENCH 3-WAY IMPACT — period ${PERIOD} (DRY-RUN, no DB, no publish)`);
  console.log(`A = baseline (SWE anchor 70, additive cap, no TB)`);
  console.log(`B = retuned (SWE anchor ${SWE_BENCH_ANCHOR}, headroom cap, no TB)`);
  console.log(`C = retuned + Terminal-Bench blend (TB_BLEND_WEIGHT=${TB_BLEND_WEIGHT})`);
  console.log("=".repeat(96));
  console.log(
    "\n  rank(A→B→C)     score  A       B       C        Δrank      tool"
  );
  console.log("  " + "-".repeat(92));

  // Order the table by the final (C) ranking.
  let abRankMoves = 0;
  let bcRankMoves = 0;
  for (const c of C) {
    const a = mA.get(c.slug)!;
    const b = mB.get(c.slug)!;
    if (a.rank !== b.rank) abRankMoves++;
    if (b.rank !== c.rank) bcRankMoves++;
    const mark = (MATCHED_SLUGS as readonly string[]).includes(c.slug) ? " *TB" : "";
    const dAB = a.rank - b.rank;
    const dBC = b.rank - c.rank;
    const fmt = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `${d}` : "·");
    console.log(
      `  #${String(a.rank).padStart(2)}→#${String(b.rank).padStart(2)}→#${String(c.rank).padStart(2)}   ` +
        `${a.score.toFixed(3)} ${b.score.toFixed(3)} ${c.score.toFixed(3)}   ` +
        `A→B ${fmt(dAB).padStart(3)} B→C ${fmt(dBC).padStart(3)}   ${c.name}${mark}`
    );
  }

  // --- Matched-tool marginal detail --------------------------------------
  console.log("\n" + "-".repeat(96));
  console.log("MATCHED TOOLS — Terminal-Bench marginal effect (B→C), agentic factor + composite\n");
  for (const slug of MATCHED_SLUGS) {
    const a = mA.get(slug)!;
    const b = mB.get(slug)!;
    const c = mC.get(slug)!;
    console.log(`  ${c.name} (${slug})`);
    console.log(
      `    agentic factor:  A=${a.agentic.toFixed(2)}  B=${b.agentic.toFixed(2)}  C=${c.agentic.toFixed(2)}` +
        `   (B→C marginal +${(c.agentic - b.agentic).toFixed(2)})`
    );
    console.log(
      `    composite:       A=${a.score.toFixed(3)}(#${a.rank})  B=${b.score.toFixed(3)}(#${b.rank})  C=${c.score.toFixed(3)}(#${c.rank})\n`
    );
  }

  console.log("-".repeat(96));
  console.log(
    `SUMMARY: anchor/cap retune (A→B) moved ${abRankMoves} rank(s); ` +
      `Terminal-Bench (B→C) moved ${bcRankMoves} rank(s).`
  );
  console.log("Dry-run analysis. Nothing was written to the database.\n");
}

main();
