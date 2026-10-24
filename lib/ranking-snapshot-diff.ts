/**
 * Row-by-row diff of two ranking snapshots, for the #93 read-only checks.
 *
 * Why: #93 may merge only when the admin dry-run matches (A) the scheduled
 *   publish path on the same input and clock, and (B) the stored current
 *   snapshot. Both checks compare rows by `tool_id`.
 * What: `diffSnapshots()` lists every tool that is missing from one side or
 *   differs in a compared field, with the fields that differ. `rank` falls
 *   back to `position` for older rows. `renderCheckReport()` turns the diffs
 *   into the counts-only public report. `assertSelectOnly()` guards the
 *   compare script's statements.
 * Test: `lib/ranking-snapshot-diff.test.ts`
 */

export type SnapshotRow = Record<string, unknown>;

/** Fields Diff A compares: everything the publish path stores. */
export const ALL_ROW_FIELDS = [
  "tool_name",
  "tool_slug",
  "rank",
  "score",
  "tier",
  "factor_scores",
  "category",
  "status",
  "movement",
  "reconstructed",
  "provenance",
] as const;

/** Fields Diff B compares. `movement` depends on the snapshot before it. */
export const SCORE_ROW_FIELDS = ["rank", "score", "tier", "factor_scores"] as const;

export interface SnapshotDiff {
  tool_id: string;
  tool_name: string;
  kind: "only-left" | "only-right" | "changed";
  fields: string[];
  left?: SnapshotRow;
  right?: SnapshotRow;
}

function field(row: SnapshotRow, name: string): unknown {
  return name === "rank" ? (row["rank"] ?? row["position"]) : row[name];
}

// Key order does not matter for JSONB values read back from Postgres.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Every tool that differs between `left` and `right` in `fields`. */
export function diffSnapshots(
  left: SnapshotRow[],
  right: SnapshotRow[],
  fields: readonly string[]
): SnapshotDiff[] {
  const byId = (rows: SnapshotRow[]) => new Map(rows.map((row) => [String(row["tool_id"]), row]));
  const leftMap = byId(left);
  const rightMap = byId(right);
  const ids = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();

  return ids.flatMap((id): SnapshotDiff[] => {
    const l = leftMap.get(id);
    const r = rightMap.get(id);
    const name = String((l ?? r)?.["tool_name"] ?? id);
    if (!r) return [{ tool_id: id, tool_name: name, kind: "only-left", fields: [], left: l }];
    if (!l) return [{ tool_id: id, tool_name: name, kind: "only-right", fields: [], right: r }];
    const changed = fields.filter((f) => canonical(field(l, f)) !== canonical(field(r, f)));
    return changed.length > 0 ? [{ tool_id: id, tool_name: name, kind: "changed", fields: changed, left: l, right: r }] : [];
  });
}

export interface CheckReportInput {
  /** Active tools the checks scored. */
  toolsCompared: number;
  diffA: SnapshotDiff[];
  /** Null when no current snapshot is stored (check B not run). */
  diffB: SnapshotDiff[] | null;
  /** Tool ids whose row changed after the snapshot was published. */
  labelledB: Set<string>;
}

export interface CheckReport {
  /** 0 when both diffs are empty, else 3. */
  exitCode: 0 | 3;
  /** Counts only: the text the public workflow writes to its summary. */
  report: string;
}

/**
 * The #93 check's public report.
 *
 * #93: the workflow runs in a public repository and a dry-run computes ranks
 * that are not published yet, so the report carries counts and one PASS/FAIL
 * line only: no tool name, slug, id, rank, score, tier or row. Any difference,
 * labelled data-changed-after-publish or not, fails the check (`updated_at`
 * also moves when news ingestion touches a tool).
 */
export function renderCheckReport({ toolsCompared, diffA, diffB, labelledB }: CheckReportInput): CheckReport {
  const passed = diffA.length === 0 && diffB !== null && diffB.length === 0;
  const checkB =
    diffB === null
      ? "not run (no current snapshot)"
      : `${diffB.length} differences, ${diffB.filter((d) => labelledB.has(d.tool_id)).length} labelled data-changed-after-publish`;
  const report = [
    `Result: ${passed ? "PASS" : "FAIL"}`,
    `Tools compared: ${toolsCompared}`,
    `Check A (admin dry-run vs scheduled path): ${diffA.length} differences`,
    `Check B (admin dry-run vs stored current snapshot): ${checkB}`,
  ].join("\n");
  return { exitCode: passed ? 0 : 3, report };
}

// One SELECT, no statement separator. `WITH … DELETE` starts with WITH and is refused.
const SINGLE_SELECT = /^\s*select\s[^;]*;?\s*$/i;

/** Throw unless `text` is a single SELECT statement. */
export function assertSelectOnly(text: string): void {
  if (!SINGLE_SELECT.test(text)) {
    throw new Error("read-only check refuses a statement that is not a single SELECT");
  }
}

/** Remove connection strings and the given secret values from an error message. */
export function redact(message: string, secrets: Array<string | undefined>): string {
  let out = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}
