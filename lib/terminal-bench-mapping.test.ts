/**
 * Unit coverage for the hand-curated Terminal-Bench → ranked-tool attribution.
 *
 * Why: attribution is deliberately an explicit allowlist (no fuzzy matching), so
 * these tests pin the two behaviours that keep the rankings honest — only
 * allowlisted scaffolds earn credit, and each tool takes its single BEST row —
 * plus the auditability guarantee that every non-attributed row is logged, never
 * silently dropped.
 *
 * Test: pure, DB-free. Uses the real terminal-bench 2.1 leaderboard rows and a
 * captured logger.
 */

import { describe, expect, it } from "vitest";
import {
  EXCLUDED_SCAFFOLDS,
  SCAFFOLD_TO_TOOL_SLUG,
  type TerminalBenchRow,
  selectBestRowsByTool,
} from "./terminal-bench-mapping";

/** The full terminal-bench 2.1 leaderboard (see the source capture). */
const LEADERBOARD: TerminalBenchRow[] = [
  { scaffold: "Claude Code", model: "Fable 5", accuracy: 83.8, as_of: "2026-06-07" },
  { scaffold: "Codex", model: "GPT-5.5", accuracy: 83.1, as_of: "2026-05-01" },
  { scaffold: "Terminus 2", model: "Fable 5", accuracy: 80.4, as_of: "2026-06-05" },
  { scaffold: "Cursor CLI", model: "Grok 4.5", accuracy: 79.3, as_of: "2026-07-09" },
  { scaffold: "Claude Code", model: "Opus 4.8", accuracy: 78.9, as_of: "2026-07-09" },
  { scaffold: "Codex", model: "GPT-5.6 Terra", accuracy: 78.4, as_of: "2026-07-11" },
  { scaffold: "Terminus 2", model: "GPT-5.5", accuracy: 78.0, as_of: "2026-05-01" },
  { scaffold: "mini-SWE-agent", model: "Muse Spark 1.1", accuracy: 76.2, as_of: "2026-07-09" },
  { scaffold: "Codex", model: "GPT-5.6 Luna", accuracy: 75.7, as_of: "2026-07-11" },
  { scaffold: "Claude Code", model: "Sonnet 5", accuracy: 74.6, as_of: "2026-07-09" },
  { scaffold: "Gemini CLI", model: "Gemini 3 Pro", accuracy: 65.8, as_of: "2026-05-01" },
  { scaffold: "Claude Code", model: "GLM-5.1", accuracy: 58.7, as_of: "2026-05-01" },
];

function run(rows: TerminalBenchRow[]) {
  const logs: string[] = [];
  const matched = selectBestRowsByTool(rows, (m) => logs.push(m));
  return { matched, logs };
}

describe("selectBestRowsByTool — best row per allowlisted tool", () => {
  it("credits Claude Code with its highest row (Fable 5, 83.8%)", () => {
    const { matched } = run(LEADERBOARD);
    const cc = matched.get("claude-code");
    expect(cc).toBeDefined();
    expect(cc?.accuracy).toBe(83.8);
    expect(cc?.scaffold).toBe("Claude Code");
    expect(cc?.model).toBe("Fable 5");
    expect(cc?.as_of).toBe("2026-06-07");
  });

  it("credits OpenAI Codex CLI with the Codex scaffold's highest row (GPT-5.5, 83.1%)", () => {
    const { matched } = run(LEADERBOARD);
    const codex = matched.get("openai-codex-cli");
    expect(codex).toBeDefined();
    expect(codex?.accuracy).toBe(83.1);
    expect(codex?.model).toBe("GPT-5.5");
  });

  it("returns exactly the two allowlisted tools, nothing else", () => {
    const { matched } = run(LEADERBOARD);
    expect([...matched.keys()].sort()).toEqual(["claude-code", "openai-codex-cli"]);
    expect(SCAFFOLD_TO_TOOL_SLUG).toEqual({
      "Claude Code": "claude-code",
      Codex: "openai-codex-cli",
    });
  });

  it("ignores row order when picking the max", () => {
    const reversed = [...LEADERBOARD].reverse();
    const { matched } = run(reversed);
    expect(matched.get("claude-code")?.accuracy).toBe(83.8);
    expect(matched.get("openai-codex-cli")?.accuracy).toBe(83.1);
  });
});

describe("exclusion + auditability — nothing is silently dropped", () => {
  it("excludes Cursor CLI and Gemini CLI as likely-different products", () => {
    const { matched, logs } = run(LEADERBOARD);
    expect(matched.has("cursor")).toBe(false);
    expect(matched.has("gemini-code-assist")).toBe(false);
    expect(logs.some((l) => l.includes("EXCLUDED Cursor CLI"))).toBe(true);
    expect(logs.some((l) => l.includes("EXCLUDED Gemini CLI"))).toBe(true);
  });

  it("excludes no-roster harnesses (Terminus 2, mini-SWE-agent)", () => {
    const { logs } = run(LEADERBOARD);
    expect(logs.some((l) => l.includes("EXCLUDED Terminus 2"))).toBe(true);
    expect(logs.some((l) => l.includes("EXCLUDED mini-SWE-agent"))).toBe(true);
    expect(EXCLUDED_SCAFFOLDS["Terminus 2"]).toContain("no ranked-tool counterpart");
  });

  it("logs every non-attributed row (excluded reasons + superseded losers)", () => {
    const { matched, logs } = run(LEADERBOARD);
    const attributedRows = matched.size; // 2 winners
    // Every leaderboard row that is not a winning row must produce a log line.
    const nonWinnerRows = LEADERBOARD.length - attributedRows;
    const auditLines = logs.filter(
      (l) => l.includes("EXCLUDED") || l.includes("SUPERSEDED")
    );
    expect(auditLines.length).toBe(nonWinnerRows);
  });

  it("logs an unknown scaffold with the generic no-allowlist-entry reason", () => {
    const { matched, logs } = run([
      { scaffold: "Totally New Agent", model: "X", accuracy: 90, as_of: "2026-07-01" },
    ]);
    expect(matched.size).toBe(0);
    expect(logs[0]).toContain("no allowlist entry");
  });
});
