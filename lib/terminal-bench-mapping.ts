/**
 * Terminal-Bench → ranked-tool attribution (hand-curated, NO fuzzy matching).
 *
 * The Terminal-Bench leaderboard
 * (https://www.tbench.ai/leaderboard/terminal-bench/2.1) lists results per
 * SCAFFOLD (agent harness) × MODEL. Several scaffolds share a name-shape with a
 * ranked tool but are NOT the same product, and several are generic harnesses
 * with no ranked counterpart at all. Auto-aliasing by string similarity would
 * silently mis-credit those rows, so attribution is an explicit allowlist that a
 * human maintains — never inferred.
 *
 * Attribution rule (locked product decision):
 *   1. Only scaffolds in `SCAFFOLD_TO_TOOL_SLUG` earn credit; every other row is
 *      logged and dropped.
 *   2. Each tool is credited with its BEST (highest-accuracy) row across all
 *      underlying models; the winning scaffold+model is recorded so the stored
 *      value stays auditable.
 *
 * Machine-readable source: as of terminal-bench 2.1 the leaderboard exposes no
 * JSON/CSV endpoint (the page is server-rendered HTML; the underlying task suite
 * lives at github.com/laude-institute/terminal-bench, and harness code at
 * github.com/harbor-framework/harbor). Until a stable structured feed exists,
 * the captured rows are persisted as a curated provenance file at
 * `data/historical-metrics/sources/terminal-bench-2.1.json`; a future collector
 * can replace the static capture without touching this mapping.
 */

/** Pinned leaderboard version this mapping was curated against. */
export const TERMINAL_BENCH_VERSION = "terminal-bench 2.1";

/** Canonical Terminal-Bench leaderboard URL (provenance `source`). */
export const TERMINAL_BENCH_SOURCE_URL =
  "https://www.tbench.ai/leaderboard/terminal-bench/2.1";

/** A single leaderboard row: one scaffold running one model. */
export interface TerminalBenchRow {
  /** Scaffold / agent harness name exactly as it appears on the leaderboard. */
  scaffold: string;
  /** Underlying model name for this row. */
  model: string;
  /** Accuracy in percent (0–100). */
  accuracy: number;
  /** Row date (ISO `YYYY-MM-DD`) as published on the leaderboard. */
  as_of: string;
}

/**
 * HAND-CURATED allowlist: leaderboard scaffold → ranked `tools.slug`.
 *
 * `Codex` maps to `openai-codex-cli` (OpenAI Codex CLI) — the scaffold IS that
 * product. `Claude Code` maps to its roster slug `claude-code`.
 *
 * NOT included, deliberately (see `EXCLUDED_SCAFFOLDS`): `Cursor CLI` and
 * `Gemini CLI` — likely distinct products from the ranked "Cursor" (the editor)
 * and "Google Gemini Code Assist", so aliasing them would mis-credit a different
 * tool. Add an entry here ONLY after confirming the scaffold and the ranked tool
 * are the same product.
 */
export const SCAFFOLD_TO_TOOL_SLUG: Readonly<Record<string, string>> = {
  "Claude Code": "claude-code",
  Codex: "openai-codex-cli",
};

/**
 * Scaffolds intentionally excluded, each with the reason logged on exclusion.
 * Two kinds: (a) name-collision products we must NOT auto-alias, and (b) generic
 * harnesses with no ranked-tool counterpart.
 */
export const EXCLUDED_SCAFFOLDS: Readonly<Record<string, string>> = {
  "Cursor CLI":
    "likely a different product from the ranked 'Cursor' editor — no confirmed identity, do not auto-alias",
  "Gemini CLI":
    "likely a different product from the ranked 'Google Gemini Code Assist' — no confirmed identity, do not auto-alias",
  "Terminus 2": "generic benchmark harness — no ranked-tool counterpart",
  "mini-SWE-agent": "generic benchmark harness — no ranked-tool counterpart",
};

/** A best-row attribution result for one ranked tool. */
export interface MatchedTerminalBench {
  /** Ranked `tools.slug` this credit is attributed to. */
  tool_slug: string;
  /** Winning scaffold name. */
  scaffold: string;
  /** Winning model name (the highest-accuracy row for the scaffold). */
  model: string;
  /** Winning accuracy in percent. */
  accuracy: number;
  /** Winning row date. */
  as_of: string;
}

/** Logger seam so callers (and tests) can capture the audit trail. */
export type AuditLogger = (message: string) => void;

/**
 * Select the best (highest-accuracy) leaderboard row per ALLOWLISTED scaffold and
 * attribute it to the mapped `tools.slug`.
 *
 * Every row that is not attributed is logged (never silently dropped):
 *   - a known-excluded scaffold logs its curated reason,
 *   - an unknown scaffold logs an "unmatched, no allowlist entry" note,
 *   - a row beaten by a higher-accuracy row for the same scaffold logs as
 *     superseded.
 *
 * Contract:
 *   - Postcondition: the returned map has at most one entry per allowlisted
 *     `tools.slug`, and that entry is the max-accuracy row for its scaffold. Ties
 *     resolve to the first row seen (stable), keeping the result deterministic.
 *
 * @param rows - leaderboard rows (order-independent)
 * @param log - audit sink (defaults to `console.log` for stdout auditability)
 * @returns map keyed by `tools.slug`
 */
export function selectBestRowsByTool(
  rows: readonly TerminalBenchRow[],
  log: AuditLogger = console.log
): Map<string, MatchedTerminalBench> {
  const best = new Map<string, MatchedTerminalBench>();

  for (const row of rows) {
    const slug = SCAFFOLD_TO_TOOL_SLUG[row.scaffold];

    if (!slug) {
      const reason =
        EXCLUDED_SCAFFOLDS[row.scaffold] ??
        "unmatched scaffold — no allowlist entry";
      log(
        `[terminal-bench] EXCLUDED ${row.scaffold} (${row.model}, ${row.accuracy}%): ${reason}`
      );
      continue;
    }

    const current = best.get(slug);
    if (!current || row.accuracy > current.accuracy) {
      if (current) {
        log(
          `[terminal-bench] SUPERSEDED ${current.scaffold} (${current.model}, ${current.accuracy}%) ` +
            `→ ${row.scaffold} (${row.model}, ${row.accuracy}%) for ${slug}`
        );
      }
      best.set(slug, {
        tool_slug: slug,
        scaffold: row.scaffold,
        model: row.model,
        accuracy: row.accuracy,
        as_of: row.as_of,
      });
    } else {
      log(
        `[terminal-bench] SUPERSEDED ${row.scaffold} (${row.model}, ${row.accuracy}%): ` +
          `below best ${current.accuracy}% for ${slug}`
      );
    }
  }

  return best;
}
