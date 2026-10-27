/**
 * Harness input corrections: the reviewed source file, its parser and its validator (#313, #312).
 *
 * Why: the De4 ruling (2026-10-27) corrects the adoption inputs of the harness board with
 *   sourced figures and removes parent-company figures. Those are 61 data changes, so they are
 *   reviewed as a file and applied as one migration (0024). The file names every change; a row
 *   with no source, a row on a tool that is not in the kind sheet, or a row that reaches the
 *   company-name bonus or a weight must be refused before any SQL is written.
 * What: `parseHarnessInputs` reads `docs/refresh/harness-inputs-2026-10.json`;
 *   `validateHarnessInputs` checks every row against the contract below and returns the
 *   problems (empty = valid). Scores and ranks never appear in the file: a row has no key
 *   for them and the validator refuses an unknown key.
 * Test: `tests/unit/harness-inputs-sheet-313.test.ts`.
 */

/** The De4 items a row belongs to; `sourced` is a plain correction with its own source. */
export const HARNESS_INPUT_GROUPS = ["sourced", "a", "b", "c", "d"] as const;
export type HarnessInputGroup = (typeof HARNESS_INPUT_GROUPS)[number];

export const HARNESS_INPUT_OPS = ["set", "replace", "delete"] as const;
export type HarnessInputOp = (typeof HARNESS_INPUT_OPS)[number];

/** The only compute rule: the site's news corpus over the last 12 months (group c). */
export const NEWS_COMPUTE_RULE = "news_mentions_12m";

/**
 * The input fields a row may touch. The company-name bonus reads `info.company` and a weight
 * lives in the algorithm config; neither is a metric, so neither can be named here.
 */
export const HARNESS_INPUT_FIELDS = [
  "monthly_arr",
  "github_stars",
  "npm",
  "vscode",
  "pypi",
  "news_mentions",
  "valuation",
  "funding",
  "users",
] as const;

/** De4 (d): the seven tools whose stored data marks valuation or funding as parent-level. */
export const PARENT_LEVEL_TOOLS = [
  "claude-code",
  "claude-artifacts",
  "chatgpt-canvas",
  "openai-codex-cli",
  "bolt-new",
  "v0-vercel",
  "snyk-code",
] as const;

/** The fields De4 (d) may delete on a parent-level tool. */
export const PARENT_LEVEL_FIELDS = ["valuation", "funding", "monthly_arr"] as const;

export interface HarnessInputRow {
  id: number;
  group: HarnessInputGroup;
  slug: string;
  /** Path under `tools.data`: `["metrics", ...]` or `["info", "metrics", ...]`. */
  path: string[];
  /** The input the row concerns; also the key of its provenance entry. */
  field: string;
  op: HarnessInputOp;
  expected_old?: unknown;
  /** True when the row expects the path to be absent. Exactly one of the two expected keys is set. */
  expected_old_absent?: true;
  new?: unknown;
  /** Set on group c rows instead of `new`: the value is computed at apply time. */
  compute?: typeof NEWS_COMPUTE_RULE;
  source_url?: string;
  as_of?: string;
  /** Required on a delete. */
  reason?: string;
}

const ROW_KEYS = new Set([
  "id",
  "group",
  "slug",
  "path",
  "field",
  "op",
  "expected_old",
  "expected_old_absent",
  "new",
  "compute",
  "source_url",
  "as_of",
  "reason",
]);

export interface HarnessInputFile {
  rows: HarnessInputRow[];
  errors: string[];
}

/** Reads the JSON source file. A malformed file returns its problem in `errors`, never throws. */
export function parseHarnessInputs(text: string): HarnessInputFile {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return { rows: [], errors: [`not valid JSON: ${(error as Error).message}`] };
  }
  const rows = (doc as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return { rows: [], errors: ["missing a `rows` array"] };
  return { rows: rows as HarnessInputRow[], errors: [] };
}

/** `metrics` or `info.metrics`: how many leading path segments name the container. */
function containerLength(path: readonly string[]): number {
  if (path[0] === "metrics") return 1;
  if (path[0] === "info" && path[1] === "metrics") return 2;
  return 0;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The problems in a source file (empty when valid).
 *
 * What: per row, the shape (known keys only, a group, an op, a path under `metrics` or
 *   `info.metrics`, a field from `HARNESS_INPUT_FIELDS` that the path names); a `source_url`
 *   (https) and `as_of` (a real date) on every row except a delete, which carries a `reason`;
 *   one expected-old guard (a value or "absent"); `new` or `compute` on a write, neither on a
 *   delete; the slug must be in `kindSlugs` (the kind sheet). Across rows: unique ids, no
 *   repeated slug and path, and no tool with a delete and a write on the same field. Group
 *   contracts: (a) is Copilot's `monthly_arr` delete only; (b) has no row, and no row writes
 *   Cursor's npm; (c) rows set `news_mentions` by `compute`; (d) rows delete a parent-level
 *   field on one of `PARENT_LEVEL_TOOLS` only.
 */
export function validateHarnessInputs(rows: readonly HarnessInputRow[], kindSlugs: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const seenIds = new Set<number>();
  const seenPaths = new Set<string>();
  const writes = new Set<string>();
  const deletes = new Set<string>();

  for (const row of rows) {
    const where = `row ${row?.id ?? "?"} (${row?.slug ?? "?"} ${Array.isArray(row?.path) ? row.path.join(".") : "?"})`;
    const err = (message: string) => errors.push(`${where}: ${message}`);

    for (const key of Object.keys(row)) if (!ROW_KEYS.has(key)) err(`unknown key "${key}"`);
    if (!Number.isInteger(row.id) || seenIds.has(row.id)) err("id must be a unique integer");
    seenIds.add(row.id);
    if (!HARNESS_INPUT_GROUPS.includes(row.group)) err(`group must be one of ${HARNESS_INPUT_GROUPS.join(", ")}`);
    if (!HARNESS_INPUT_OPS.includes(row.op)) err(`op must be one of ${HARNESS_INPUT_OPS.join(", ")}`);
    if (typeof row.slug !== "string" || !kindSlugs.has(row.slug)) err("slug is not in the kind sheet");

    const pathOk = Array.isArray(row.path) && row.path.every((s) => typeof s === "string" && /^[a-z0-9_]+$/.test(s));
    const prefix = pathOk ? containerLength(row.path) : 0;
    if (!pathOk || prefix === 0 || row.path.length <= prefix) err('path must run under "metrics" or "info","metrics"');
    else {
      if (!(HARNESS_INPUT_FIELDS as readonly string[]).includes(row.path[prefix] as string)) {
        err(`path field "${row.path[prefix]}" is not an input field (the company-name bonus and the weights are out of scope)`);
      }
      if (row.path[prefix] !== row.field) err("field must be the path's input field");
      const key = `${row.slug}|${row.path.join(".")}`;
      if (seenPaths.has(key)) err("slug and path repeat");
      seenPaths.add(key);
    }

    const hasOld = "expected_old" in row;
    if (hasOld === (row.expected_old_absent === true)) err("exactly one of expected_old and expected_old_absent is required");
    if (row.op === "delete" && row.expected_old_absent) err("a delete needs an expected_old value");

    if (row.op === "delete") {
      if (typeof row.reason !== "string" || row.reason.trim() === "") err("a delete needs a reason");
      if ("new" in row || row.compute) err("a delete has no new value");
      if (row.source_url !== undefined && !isHttpsUrl(row.source_url)) err("source_url must be an https URL");
      if (row.as_of !== undefined && !isIsoDate(row.as_of)) err("as_of must be a YYYY-MM-DD date");
      deletes.add(`${row.slug}|${row.field}`);
    } else {
      if (!isHttpsUrl(row.source_url)) err("source_url must be an https URL");
      if (!isIsoDate(row.as_of)) err("as_of must be a YYYY-MM-DD date");
      if (row.reason !== undefined) err("only a delete carries a reason");
      if (row.compute === undefined && !("new" in row)) err("a write needs new or compute");
      if (row.compute !== undefined && ("new" in row || row.compute !== NEWS_COMPUTE_RULE)) {
        err(`compute must be "${NEWS_COMPUTE_RULE}" and replaces new`);
      }
      writes.add(`${row.slug}|${row.field}`);
    }

    // #313: group contracts. The scope is the De4 ruling, nothing wider.
    if (row.group === "a" && !(row.slug === "github-copilot" && row.field === "monthly_arr" && row.op === "delete")) {
      err("group a is the removal of Copilot's monthly_arr only");
    }
    if (row.group === "b") err("group b has no rows: @cursor/sdk does not count as Cursor's npm");
    // #312: Cursor's VS Code count came from an unrelated extension; its row deletes it and no row may count another package instead.
    if (row.slug === "cursor" && row.field === "npm") err("a Cursor npm row would count @cursor/sdk, which De4 (b) refuses");
    if (row.group === "c" && !(row.compute === NEWS_COMPUTE_RULE && row.field === "news_mentions" && row.op === "set")) {
      err("group c rows set news_mentions by compute");
    }
    if (row.group !== "c" && row.compute !== undefined) err("compute belongs to group c");
    if (row.group === "d") {
      if (row.op !== "delete") err("group d rows delete");
      if (!(PARENT_LEVEL_TOOLS as readonly string[]).includes(row.slug)) err("group d names a tool outside the seven parent-level tools");
      if (!(PARENT_LEVEL_FIELDS as readonly string[]).includes(row.field)) err("group d deletes valuation, funding or monthly_arr only");
    }
  }

  for (const key of deletes) if (writes.has(key)) errors.push(`${key}: a delete and a write on the same field`);
  return errors;
}

/** Rows per group, in `HARNESS_INPUT_GROUPS` order. */
export function countByGroup(rows: readonly HarnessInputRow[]): Record<HarnessInputGroup, number> {
  const counts = Object.fromEntries(HARNESS_INPUT_GROUPS.map((g) => [g, 0])) as Record<HarnessInputGroup, number>;
  for (const row of rows) counts[row.group] += 1;
  return counts;
}
