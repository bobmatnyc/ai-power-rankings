import { describe, expect, it } from "vitest";

import {
  ALL_ROW_FIELDS,
  assertSelectOnly,
  diffSnapshots,
  redact,
  renderCheckReport,
  SCORE_ROW_FIELDS,
  type SnapshotRow,
} from "./ranking-snapshot-diff";
import golden from "./services/__fixtures__/regenerate-publish.golden.json";

/**
 * Snapshot diff and guards for the #93 read-only check.
 * Test: `npx vitest run lib/ranking-snapshot-diff.test.ts`.
 */

const row = (tool_id: string, rank: number, score: number, extra: Record<string, unknown> = {}) => ({
  tool_id,
  tool_name: tool_id.toUpperCase(),
  rank,
  score,
  tier: "S",
  factor_scores: { a: 1, b: 2 },
  ...extra,
});

describe("diffSnapshots", () => {
  it("reports nothing for equal rows, ignoring JSON key order", () => {
    const left = [row("a", 1, 9), row("b", 2, 8)];
    const right = [row("b", 2, 8, { factor_scores: { b: 2, a: 1 } }), row("a", 1, 9)];
    expect(diffSnapshots(left, right, ALL_ROW_FIELDS)).toEqual([]);
  });

  it("names changed fields and tools on one side only", () => {
    const diffs = diffSnapshots([row("a", 1, 9), row("b", 2, 8)], [row("a", 1, 9.5), row("c", 2, 8)], SCORE_ROW_FIELDS);
    expect(diffs.map(({ tool_id, kind, fields }) => ({ tool_id, kind, fields }))).toEqual([
      { tool_id: "a", kind: "changed", fields: ["score"] },
      { tool_id: "b", kind: "only-left", fields: [] },
      { tool_id: "c", kind: "only-right", fields: [] },
    ]);
  });

  it("matches `rank` against an older row's `position`", () => {
    const older = { tool_id: "a", position: 1, score: 9, tier: "S", factor_scores: { a: 1, b: 2 } };
    expect(diffSnapshots([row("a", 1, 9)], [older], SCORE_ROW_FIELDS)).toEqual([]);
  });

  it("can fail: a movement change counts in Diff A fields but not in Diff B fields", () => {
    const left = [row("a", 1, 9, { movement: { change: 1 } })];
    const right = [row("a", 1, 9, { movement: { change: 0 } })];
    expect(diffSnapshots(left, right, ALL_ROW_FIELDS)[0]?.fields).toEqual(["movement"]);
    expect(diffSnapshots(left, right, SCORE_ROW_FIELDS)).toEqual([]);
  });
});

describe("renderCheckReport", () => {
  const changed = diffSnapshots([row("a", 1, 9)], [row("a", 1, 9.5)], SCORE_ROW_FIELDS);

  it("passes only when both diffs are empty", () => {
    expect(renderCheckReport({ toolsCompared: 2, diffA: [], diffB: [], labelledB: new Set() })).toEqual({
      exitCode: 0,
      report: [
        "Result: PASS",
        "Tools compared: 2",
        "Check A (admin dry-run vs scheduled path): 0 differences",
        "Check B (admin dry-run vs stored current snapshot): 0 differences, 0 labelled data-changed-after-publish",
      ].join("\n"),
    });
  });

  // #93: a tool whose updated_at is after publish (news ingestion bumps it) is labelled, not excused.
  it("fails on a Diff B difference labelled data-changed-after-publish", () => {
    const { exitCode, report } = renderCheckReport({ toolsCompared: 1, diffA: [], diffB: changed, labelledB: new Set(["a"]) });
    expect(exitCode).toBe(3);
    expect(report).toContain("Result: FAIL");
    expect(report).toContain("1 differences, 1 labelled data-changed-after-publish");
  });

  it("fails when Diff A differs or Diff B could not run", () => {
    expect(renderCheckReport({ toolsCompared: 1, diffA: changed, diffB: [], labelledB: new Set() }).exitCode).toBe(3);
    const notRun = renderCheckReport({ toolsCompared: 1, diffA: [], diffB: null, labelledB: new Set() });
    expect(notRun.exitCode).toBe(3);
    expect(notRun.report).toContain("not run (no current snapshot)");
  });

  // #93: the public workflow output carries counts only (unpublished dry-run ranks).
  it("names no tool, slug, id or score when rows differ", () => {
    const entries = golden.saveSnapshotCalls[0]!.data as SnapshotRow[];
    const moved = entries.slice(1).map((r) => ({ ...r, score: (r["score"] as number) + 1.234 }));
    const diffA = diffSnapshots(entries, moved, ALL_ROW_FIELDS);
    const diffB = diffSnapshots(entries, [...moved].reverse(), SCORE_ROW_FIELDS);
    const labelledB = new Set([String(entries[1]!["tool_id"])]);

    const { exitCode, report } = renderCheckReport({ toolsCompared: entries.length, diffA, diffB, labelledB });

    expect(exitCode).toBe(3);
    expect(diffA.length).toBeGreaterThan(0);
    const leaks = [...entries, ...moved].flatMap((r) => [
      String(r["tool_name"]),
      String(r["tool_slug"]),
      String(r["tool_id"]),
      String(r["score"]),
    ]);
    expect(leaks.filter((value) => report.includes(value))).toEqual([]);
    expect(report.split("\n")).toHaveLength(4);
  });
});

describe("assertSelectOnly", () => {
  it.each([
    "SELECT id FROM tools WHERE status = $1",
    "select period, data from rankings where is_current = $1 limit 1;",
  ])("allows %s", (text) => {
    expect(() => assertSelectOnly(text)).not.toThrow();
  });

  it.each([
    "UPDATE rankings SET is_current = false",
    "SELECT 1; DELETE FROM rankings",
    "WITH x AS (DELETE FROM rankings RETURNING *) SELECT * FROM x",
  ])("refuses %s", (text) => {
    expect(() => assertSelectOnly(text)).toThrow(/not a single SELECT/);
  });
});

describe("redact", () => {
  it("removes connection strings and listed values", () => {
    const message = "connect failed for postgresql://u:p@example.invalid/db and token abc123";
    expect(redact(message, ["abc123", undefined])).toBe("connect failed for [redacted] and token [redacted]");
  });
});
