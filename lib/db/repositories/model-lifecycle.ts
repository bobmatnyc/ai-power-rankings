/**
 * Model lifecycle: per-major status targets for model rows, and the status step that sets them (#329).
 *
 * Why: the owner asked for one ranked row per available major version of each model line, with
 *   older or unavailable points archived. The seed upsert never changes status, so the status
 *   change is its own explicit step, checked as a whole before any write. The rules are a
 *   working draft until the owner rules on D05, so they live in one constant.
 * What: `parseModelLifecycle` validates `docs/refresh/model-lifecycle.json` against the seed
 *   slugs and `MODEL_LIFECYCLE_RULES`. `planModelStatus` reads the rows (one SELECT) and returns
 *   per row `set` (with the status change, if any) or `unchanged` or `refused`.
 *   `applyModelStatusPlans` runs `MODEL_STATUS_UPDATE_SQL` per `set` plan inside the caller's
 *   transaction. The statement writes only `status` and `data.modelLifecycle`, and never matches
 *   a redirect alias or a non-model row. `deprecated` is the archive: the row and its URL stay.
 * Test: `tests/unit/model-lifecycle-329.test.ts`
 */

import { EXCLUDED_MODEL_MODALITIES } from "../../rankings/lists";
import type { ModelSeedQueryable } from "./model-seed-writer";
import { isCalendarDate } from "./model-seed.repository";

export const MODEL_LIFECYCLE_FILE = "docs/refresh/model-lifecycle.json";

/**
 * #329 D05 working draft. Change these when the owner rules; the file text in `rules` follows.
 * - `availabilityBases`: how availability may be shown (vendor API docs, vendor Hugging Face weights).
 * - `activeNeedsCodingSource`: an active row names a coding benchmark page.
 * - `oneActivePerLineMajor`: only the latest available point of a line and major is active.
 */
export const MODEL_LIFECYCLE_RULES = {
  availabilityBases: ["api_docs", "hf_weights"],
  activeNeedsCodingSource: true,
  oneActivePerLineMajor: true,
} as const;

export const LIFECYCLE_TARGETS = ["active", "deprecated"] as const;
export type LifecycleTarget = (typeof LIFECYCLE_TARGETS)[number];
export const ARCHIVE_REASONS = ["superseded", "unavailable"] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

/**
 * #329: live model rows that are not seed rows (an Architect ruling keeps the D91 family rows
 * out of the seed files). The status step writes only status and data.modelLifecycle on them.
 */
export const MODEL_LIFECYCLE_LIVE_SLUGS: readonly string[] = ["claude-opus", "claude-sonnet", "grok", "devstral-small-2"];

/**
 * #329: slugs retired as `redirect` aliases by D90 (scripts/duplicate-tool-merge.ts) and D91
 * (migration 0019). The seed and status writers refuse them, so no lifecycle row may use one.
 */
export const KNOWN_REDIRECT_SLUGS: readonly string[] = [
  "bytedance-seedance-2-0",
  "clawdbot",
  "cowork-ai",
  "deepseek-r1",
  "deepseek-v3-2",
  "glm-5-0",
  "kimi-2-5",
  "model-context-protocol-mcp-",
  "moltbot",
  "moonshot-kimi-2-5",
  "opus-4-5",
  "opus-4-6",
  "sonnet-4-5",
  "zhipu-glm-5-0",
];

export interface LifecycleAvailability {
  available: boolean;
  basis: (typeof MODEL_LIFECYCLE_RULES.availabilityBases)[number];
  sourceUrl: string;
  checkedAt: string;
}

export interface ModelLifecycleRow {
  slug: string;
  line: string;
  tier: string;
  major: number;
  point: string;
  targetStatus: LifecycleTarget;
  availability: LifecycleAvailability;
  codingSourceUrl: string | null;
  archiveReason: ArchiveReason | null;
  supersededBy: string | null;
}

export interface ModelLifecycle {
  checkedAt: string;
  rows: ModelLifecycleRow[];
}

/** What the lifecycle needs to know about each seed row. */
export interface LifecycleSeedRow {
  slug: string;
  modality: string;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const HTTPS = /^https:\/\/\S+$/;
const POINT = /^\d+(\.\d+)?$/;
// #329 D52: no image or video model, whatever its seed modality says.
const MEDIA_NAME = /image|video|imagine|seedance|banana|veo|sora/i;
const ROW_KEYS = new Set([
  "slug",
  "line",
  "tier",
  "major",
  "point",
  "target_status",
  "availability",
  "coding_source_url",
  "archive_reason",
  "superseded_by",
]);
const AVAILABILITY_KEYS = new Set(["available", "basis", "source_url", "checked_at"]);
const DOC_KEYS = new Set(["checked_at", "ruling", "rules", "models"]);

/** Compares two points such as 4.8 and 4.10 numerically by part; negative when `a` is earlier. */
export function comparePoints(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string, what: string): string {
  const v = e[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${what}: ${key} is required`);
  return v.trim();
}

function https(e: Record<string, unknown>, key: string, what: string): string {
  const v = text(e, key, what);
  if (!HTTPS.test(v)) throw new Error(`${what}: ${key} must be an https URL`);
  return v;
}

function parseAvailability(raw: unknown, what: string, checkedAt: string): LifecycleAvailability {
  const a = rec(raw, `${what}: availability`);
  for (const key of Object.keys(a)) if (!AVAILABILITY_KEYS.has(key)) throw new Error(`${what}: availability has unknown field ${key}`);
  if (typeof a["available"] !== "boolean") throw new Error(`${what}: availability.available must be true or false`);
  const basis = text(a, "basis", `${what}: availability`);
  if (!(MODEL_LIFECYCLE_RULES.availabilityBases as readonly string[]).includes(basis)) {
    throw new Error(`${what}: availability.basis must be one of ${MODEL_LIFECYCLE_RULES.availabilityBases.join(", ")}`);
  }
  const sourceUrl = https(a, "source_url", `${what}: availability`);
  const date = text(a, "checked_at", `${what}: availability`);
  if (!isCalendarDate(date)) throw new Error(`${what}: availability.checked_at must be a real YYYY-MM-DD date`);
  if (date > checkedAt) throw new Error(`${what}: availability.checked_at is after the file's checked_at`);
  if (basis === "hf_weights" && !sourceUrl.startsWith("https://huggingface.co/")) {
    throw new Error(`${what}: an hf_weights availability source must be a Hugging Face URL`);
  }
  return { available: a["available"], basis: basis as LifecycleAvailability["basis"], sourceUrl, checkedAt: date };
}

// #329 D63: benchmark figures are licensed and loaded by a separate, held step. A tracked seed
// names a coding source by URL only.
const FIGURE_KEY = /bench|score|rank|metric|percentile|leaderboard|pass@/i;
const FIGURE_TEXT = /\d\s*%|\b(score[sd]?|rank(ed)?|percentile)\s*(of|at|is|:|=)?\s*#?\d|#\d+\s+of\s+\d+/i;
const NUMBER_PATHS = /(^|\.)(major|parameters_b\.value|active_parameters_b\.value)$/;

/**
 * Why: a Terminal-Bench figure, score or rank must never reach a tracked file (D63, D86).
 * What: walks a parsed JSON document and throws on a key that names a benchmark, score, rank or
 *   metric; on a number anywhere but `major` and the parameter-count facts; and on a string
 *   with a percentage, a score, rank or percentile followed by a number, or a "#n of m" rank. URLs are
 *   exempt from the text check, so a coding source URL may name its benchmark.
 * Test: `tests/unit/model-lifecycle-329.test.ts`
 */
export function assertNoBenchmarkFigures(doc: unknown, path = ""): void {
  if (Array.isArray(doc)) {
    for (const v of doc) assertNoBenchmarkFigures(v, path);
    return;
  }
  if (doc !== null && typeof doc === "object") {
    for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
      if (FIGURE_KEY.test(key)) throw new Error(`${path || "document"}: key ${key} names a benchmark figure; record a source URL only`);
      assertNoBenchmarkFigures(value, path ? `${path}.${key}` : key);
    }
    return;
  }
  if (typeof doc === "number" && !NUMBER_PATHS.test(path)) throw new Error(`${path}: a number is not allowed here (benchmark figures stay out of tracked files)`);
  if (typeof doc === "string" && !/^https:\/\//.test(doc) && FIGURE_TEXT.test(doc)) {
    throw new Error(`${path}: text names a score, rank or percentage`);
  }
}

/**
 * Why: one row is one status that may reach `tools.status`; each rule guards a #329 ruling.
 * What: returns the typed row or throws naming the row and the rule: an unknown key; a slug that
 *   is malformed, a known redirect alias or names an image or video model (D52); a line, tier or
 *   point missing or malformed; a major that is not a positive integer or disagrees with the
 *   point; a target other than active or deprecated; a bad availability block; an active row
 *   that is not available or has no https coding source; an archive reason on an active row, or
 *   a deprecated row without one; `superseded_by` on anything but a superseded row.
 * Test: `tests/unit/model-lifecycle-329.test.ts`
 */
export function parseModelLifecycleRow(entry: unknown, what: string, checkedAt: string): ModelLifecycleRow {
  const e = rec(entry, what);
  for (const key of Object.keys(e)) if (!ROW_KEYS.has(key)) throw new Error(`${what}: unknown field ${key}`);
  const slug = text(e, "slug", what);
  if (!SLUG.test(slug)) throw new Error(`${what}: slug must match ${SLUG}`);
  if (KNOWN_REDIRECT_SLUGS.includes(slug)) throw new Error(`${what}: slug is a redirect alias; name a real row`);
  if (MEDIA_NAME.test(slug)) throw new Error(`${what}: image and video models are out of scope (D52)`);
  const line = text(e, "line", what);
  if (!SLUG.test(line)) throw new Error(`${what}: line must match ${SLUG}`);
  const tier = text(e, "tier", what);
  const major = e["major"];
  if (typeof major !== "number" || !Number.isInteger(major) || major <= 0) throw new Error(`${what}: major must be a positive integer`);
  const point = text(e, "point", what);
  if (!POINT.test(point)) throw new Error(`${what}: point must look like 5 or 5.5`);
  if (Number.parseInt(point, 10) !== major) throw new Error(`${what}: point ${point} is not in major ${major}`);
  const target = text(e, "target_status", what);
  if (!(LIFECYCLE_TARGETS as readonly string[]).includes(target)) throw new Error(`${what}: target_status must be active or deprecated`);
  const availability = parseAvailability(e["availability"], what, checkedAt);
  const codingSourceUrl = e["coding_source_url"] === undefined ? null : https(e, "coding_source_url", what);
  const reason = e["archive_reason"] === undefined ? null : text(e, "archive_reason", what);
  const supersededBy = e["superseded_by"] === undefined ? null : text(e, "superseded_by", what);

  if (target === "active") {
    if (!availability.available) throw new Error(`${what}: an active row must be available`);
    if (MODEL_LIFECYCLE_RULES.activeNeedsCodingSource && codingSourceUrl === null) {
      throw new Error(`${what}: an active row needs a coding_source_url`);
    }
    if (reason !== null) throw new Error(`${what}: an active row has no archive_reason`);
  } else {
    if (reason === null || !(ARCHIVE_REASONS as readonly string[]).includes(reason)) {
      throw new Error(`${what}: a deprecated row needs archive_reason superseded or unavailable`);
    }
    if (reason === "unavailable" && availability.available) throw new Error(`${what}: archive_reason unavailable needs available false`);
  }
  if ((reason === "superseded") !== (supersededBy !== null)) {
    throw new Error(`${what}: superseded_by is required for, and only for, archive_reason superseded`);
  }
  return {
    slug,
    line,
    tier,
    major,
    point,
    targetStatus: target as LifecycleTarget,
    availability,
    codingSourceUrl,
    archiveReason: reason as ArchiveReason | null,
    supersededBy,
  };
}

/**
 * Why: the lifecycle is checked as a whole: one bad row, gap or clash stops every status write.
 * What: parses the JSON text and returns typed rows. Throws on text that is not JSON, an unknown
 *   top-level key, a benchmark figure (`assertNoBenchmarkFigures`), a missing or invalid `checked_at`, no `models` array, any row rule, a slug used
 *   twice, a slug that is neither a seed row nor a live row, a seed row with no lifecycle row, a
 *   seed row with an image or video modality (D52), two active rows on one line and major, a
 *   `superseded_by` that is not an
 *   active row in the file, and a deprecated row whose line and major is active at an earlier or
 *   equal point than its own. Pure.
 * Test: `tests/unit/model-lifecycle-329.test.ts`
 */
export function parseModelLifecycle(jsonText: string, seedRows: readonly LifecycleSeedRow[]): ModelLifecycle {
  const doc = rec(JSON.parse(jsonText), "lifecycle");
  for (const key of Object.keys(doc)) if (!DOC_KEYS.has(key)) throw new Error(`lifecycle: unknown field ${key}`);
  assertNoBenchmarkFigures(doc);
  const checkedAt = text(doc, "checked_at", "lifecycle");
  if (!isCalendarDate(checkedAt)) throw new Error("lifecycle: checked_at must be a real YYYY-MM-DD date");
  const entries = doc["models"];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("lifecycle has no models array");
  const rows = entries.map((entry, i) => {
    const slug = typeof (entry as Record<string, unknown>)?.["slug"] === "string" ? ` (${(entry as Record<string, unknown>)["slug"]})` : "";
    return parseModelLifecycleRow(entry, `models[${i}]${slug}`, checkedAt);
  });

  const bySlug = new Map<string, ModelLifecycleRow>();
  for (const row of rows) {
    if (bySlug.has(row.slug)) throw new Error(`lifecycle: duplicate slug ${row.slug}`);
    bySlug.set(row.slug, row);
  }
  const known = new Set([...seedRows.map((r) => r.slug), ...MODEL_LIFECYCLE_LIVE_SLUGS]);
  for (const row of rows) if (!known.has(row.slug)) throw new Error(`lifecycle: ${row.slug} is neither a seed row nor a live row`);
  for (const seed of seedRows) {
    if (!bySlug.has(seed.slug)) throw new Error(`lifecycle: seed row ${seed.slug} has no lifecycle row`);
    if (EXCLUDED_MODEL_MODALITIES.includes(seed.modality.toLowerCase())) throw new Error(`lifecycle: ${seed.slug} is a ${seed.modality} model (D52)`);
  }

  const groups = new Map<string, ModelLifecycleRow[]>();
  for (const row of rows) {
    const key = `${row.line}#${row.major}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, group] of groups) {
    const actives = group.filter((r) => r.targetStatus === "active");
    if (MODEL_LIFECYCLE_RULES.oneActivePerLineMajor && actives.length > 1) {
      throw new Error(`lifecycle: ${actives.length} active rows on ${key} (${actives.map((r) => r.slug).join(", ")}); one is allowed`);
    }
    const active = actives[0];
    for (const row of group) {
      if (row.targetStatus !== "deprecated") continue;
      if (active && comparePoints(row.point, active.point) >= 0) {
        throw new Error(`lifecycle: ${row.slug} is archived at point ${row.point}, not earlier than the active ${active.slug} (${active.point})`);
      }
    }
  }
  for (const row of rows) {
    if (row.supersededBy === null) continue;
    if (bySlug.get(row.supersededBy)?.targetStatus !== "active") {
      throw new Error(`lifecycle: ${row.slug} is superseded by ${row.supersededBy}, which is not an active row`);
    }
  }
  return { checkedAt, rows };
}

/** The record stored under `data.modelLifecycle`: availability source and check date, line and major. */
export function lifecycleRecord(row: ModelLifecycleRow, checkedAt: string): Record<string, unknown> {
  return {
    issue: 329,
    file: MODEL_LIFECYCLE_FILE,
    checkedAt,
    line: row.line,
    tier: row.tier,
    major: row.major,
    point: row.point,
    targetStatus: row.targetStatus,
    availability: {
      available: row.availability.available,
      basis: row.availability.basis,
      source_url: row.availability.sourceUrl,
      checked_at: row.availability.checkedAt,
    },
    codingSourceUrl: row.codingSourceUrl,
    archiveReason: row.archiveReason,
    supersededBy: row.supersededBy,
  };
}

// #329: read-only; status and redirect_to are read to refuse redirect aliases and other kinds.
export const MODEL_STATUS_SELECT_SQL = `SELECT slug, kind, status, data->>'redirect_to' AS redirect_to,
  data->'modelLifecycle' AS model_lifecycle
FROM tools WHERE slug = ANY($1::text[])`;

/** #329: the statuses the status step may move a row from. Redirect and any other value are refused. */
export const MODEL_STATUS_FROM = ["inactive", "active", "deprecated"] as const;

// #329: writes status and the top-level data.modelLifecycle key only. The WHERE refuses a
// non-model row, a redirect alias and any status outside MODEL_STATUS_FROM; it then returns no
// row and the caller rolls back. Metrics, facts and name are never named.
export const MODEL_STATUS_UPDATE_SQL = `UPDATE tools SET
  status = $2,
  data = data || jsonb_build_object('modelLifecycle', $3::jsonb),
  updated_at = now()
WHERE slug = $1 AND kind = 'model' AND status IN ('inactive', 'active', 'deprecated')
RETURNING slug`;

interface ExistingStatusRow {
  slug: string;
  kind: string;
  status: string;
  redirect_to: string | null;
  model_lifecycle: unknown;
}

export type ModelStatusPlan =
  | { slug: string; outcome: "set"; from: string; to: LifecycleTarget; params: unknown[] }
  | { slug: string; outcome: "unchanged" }
  | { slug: string; outcome: "refused"; reason: string };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Why: the dry run is the review step, so it shows every status a write would set.
 * What: one SELECT over the lifecycle slugs, then a pure per-row plan. A slug with no row is
 *   planned as an inactive row when `pendingInserts` holds it (the seed upsert in the same
 *   transaction creates it), else refused. Refuses another kind, a redirect alias and a status
 *   outside `MODEL_STATUS_FROM`. Writes nothing.
 * Test: `tests/unit/model-lifecycle-329.test.ts`
 */
export async function planModelStatus(
  db: ModelSeedQueryable,
  lifecycle: ModelLifecycle,
  pendingInserts: ReadonlySet<string>
): Promise<ModelStatusPlan[]> {
  const { rows } = await db.query(MODEL_STATUS_SELECT_SQL, [lifecycle.rows.map((r) => r.slug)]);
  const bySlug = new Map((rows as ExistingStatusRow[]).map((r) => [r.slug, r]));
  return lifecycle.rows.map((row): ModelStatusPlan => {
    const { slug } = row;
    const record = lifecycleRecord(row, lifecycle.checkedAt);
    const params = [slug, row.targetStatus, JSON.stringify(record)];
    const existing = bySlug.get(slug);
    if (!existing) {
      if (pendingInserts.has(slug)) return { slug, outcome: "set", from: "inactive", to: row.targetStatus, params };
      return { slug, outcome: "refused", reason: "no tools row with this slug; load the model seed first" };
    }
    if (existing.kind !== "model") return { slug, outcome: "refused", reason: `slug is held by a ${existing.kind} row, not a model` };
    if (existing.status === "redirect") {
      return { slug, outcome: "refused", reason: `slug is a redirect alias (data.redirect_to: ${existing.redirect_to ?? "(none)"})` };
    }
    if (!(MODEL_STATUS_FROM as readonly string[]).includes(existing.status)) {
      return { slug, outcome: "refused", reason: `status is ${existing.status}; only ${MODEL_STATUS_FROM.join(", ")} rows are set` };
    }
    if (existing.status === row.targetStatus && stableJson(existing.model_lifecycle ?? null) === stableJson(record)) {
      return { slug, outcome: "unchanged" };
    }
    return { slug, outcome: "set", from: existing.status, to: row.targetStatus, params };
  });
}

/** Writes every `set` plan through `tx`; throws when a guarded update matches no row. */
export async function applyModelStatusPlans(tx: ModelSeedQueryable, plans: readonly ModelStatusPlan[]): Promise<number> {
  let written = 0;
  for (const plan of plans) {
    if (plan.outcome !== "set") continue;
    const { rows } = await tx.query(MODEL_STATUS_UPDATE_SQL, plan.params);
    if (rows.length !== 1) throw new Error(`${plan.slug}: row changed since planning and is no longer an eligible model row`);
    written++;
  }
  return written;
}
