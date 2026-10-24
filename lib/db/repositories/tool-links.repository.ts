/**
 * Tool links repository: the model <-> harness read path and the admin writer (#183 B-2).
 *
 * Why: `tool_links` (migration 0016, plan 1.3) says "this model and this harness are
 *   related". Postgres cannot CHECK the kind rule across two tables and Q-A5 rules out a
 *   trigger, so this writer is the one place that enforces it on the way in, and
 *   `TOOL_LINK_KIND_VIOLATIONS_SQL` (lib/db/tool-links.ts) finds rows that broke it later.
 * What: two reads (`getModelsForHarness`, `getHarnessesForModel`), one pure input check
 *   (`validateToolLinkInput`), one read-only planner (`planToolLink`) and one writer
 *   (`upsertToolLink`). Every function takes the Drizzle database (or transaction) it runs
 *   on, so a script can pass its own connection and a test can pass PGlite.
 * Test: `tests/unit/tool-links-repository-183.test.ts`.
 */

import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { alias, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import { tools, toolLinks } from "../schema";

// #183: any Postgres-flavoured Drizzle instance or transaction (neon, pool, PGlite).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema generic differs per caller
export type ToolLinksDb = PgDatabase<PgQueryResultHKT, any>;

export const TOOL_LINK_RELATIONS = ["native", "supports"] as const;
export type ToolLinkRelation = (typeof TOOL_LINK_RELATIONS)[number];

/** Names the tool a read starts from, by primary key or by slug. */
export type ToolRef = { id: string } | { slug: string };

/** One tool on the far side of a link, as a tool page would list it. */
export interface LinkedTool {
  id: string;
  slug: string;
  name: string;
  relation: ToolLinkRelation;
  sourceUrl: string | null;
}

export interface ToolLinkInput {
  modelSlug: string;
  harnessSlug: string;
  relation: string;
  sourceUrl?: string | null;
}

export type ToolLinkRefusalCode =
  | "empty_slug"
  | "invalid_relation"
  | "self_link"
  | "invalid_source_url"
  | "unknown_model_slug"
  | "unknown_harness_slug"
  | "model_side_not_model"
  | "harness_side_not_harness"
  | "kind_changed_during_write";

/** #183: the writer refused the link and wrote nothing. `code` says which rule failed. */
export class ToolLinkRefusedError extends Error {
  constructor(
    readonly code: ToolLinkRefusalCode,
    message: string
  ) {
    super(message);
    this.name = "ToolLinkRefusedError";
  }
}

export type ToolLinkOutcome = "inserted" | "updated" | "unchanged";
export type ToolLinkPlan = { ok: true; outcome: ToolLinkOutcome } | { ok: false; error: ToolLinkRefusedError };

const modelSide = alias(tools, "model_side");
const harnessSide = alias(tools, "harness_side");

/**
 * Lists the active model tools linked to a harness, native links first, then by name.
 *
 * Why: the harness page's "Models it runs" block (B-2 step 2) reads this.
 * What: joins `tool_links` to both tools. Both sides must hold the right kind (so a row
 *   that went wrong after a kind change is never shown) and the listed model must have
 *   `status = 'active'`, the filter the ranking and scoring services use. An unknown or
 *   non-harness `harness` yields `[]`. Ties on name break by slug.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("repository reads").
 */
export async function getModelsForHarness(db: ToolLinksDb, harness: ToolRef): Promise<LinkedTool[]> {
  return listLinked(db, "models", harness);
}

/**
 * Lists the active harness tools linked to a model, native links first, then by name.
 *
 * Why: the model page's "Harnesses for this model" block (B-2 step 2) reads this.
 * What: the mirror of `getModelsForHarness`; same kind, status and ordering rules.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("repository reads").
 */
export async function getHarnessesForModel(db: ToolLinksDb, model: ToolRef): Promise<LinkedTool[]> {
  return listLinked(db, "harnesses", model);
}

async function listLinked(db: ToolLinksDb, want: "models" | "harnesses", anchorRef: ToolRef): Promise<LinkedTool[]> {
  const [anchor, listed] = want === "models" ? [harnessSide, modelSide] : [modelSide, harnessSide];
  const anchorMatch: SQL = "id" in anchorRef ? eq(anchor.id, anchorRef.id) : eq(anchor.slug, anchorRef.slug);
  const rows = await db
    .select({
      id: listed.id,
      slug: listed.slug,
      name: listed.name,
      relation: toolLinks.relation,
      sourceUrl: toolLinks.sourceUrl,
    })
    .from(toolLinks)
    .innerJoin(modelSide, eq(modelSide.id, toolLinks.modelToolId))
    .innerJoin(harnessSide, eq(harnessSide.id, toolLinks.harnessToolId))
    .where(
      and(
        anchorMatch,
        eq(modelSide.kind, "model"),
        eq(harnessSide.kind, "harness"),
        eq(listed.status, "active") // #183: same active filter as ranking-generation.service.ts
      )
    )
    .orderBy(sql`CASE WHEN ${toolLinks.relation} = 'native' THEN 0 ELSE 1 END`, asc(listed.name), asc(listed.slug));
  return rows;
}

/**
 * Says whether a source URL is safe to render as a public href: absolute http(s) only.
 *
 * Why: B-2 step 2 renders `source_url` as a link, so `javascript:`, `data:` and the like
 *   must never reach the table (#183).
 * What: the raw text must start with `http://` or `https://` (any case) and hold no
 *   whitespace or control character. The WHATWG parser strips tab and newline, so the
 *   raw check runs first; the parse then confirms the scheme and a non-empty host.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("refuses source URL").
 */
function isHttpUrl(text: string): boolean {
  // eslint-disable-next-line no-control-regex -- #183: control characters are the point
  if (!/^https?:\/\//i.test(text) || /[\s\u0000-\u001f\u007f]/.test(text)) return false;
  try {
    const url = new URL(text);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/**
 * Checks the parts of a link input that need no database: slugs, relation, self-link,
 * and the source URL scheme.
 *
 * Why: these refusals are cheap and certain, so they never reach SQL.
 * What: returns the refusal, or null when the input may go on to the kind check. A
 *   non-null `sourceUrl` must be an absolute http(s) URL (`invalid_source_url`).
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("writer refusals").
 */
export function validateToolLinkInput(input: ToolLinkInput): ToolLinkRefusedError | null {
  const { modelSlug, harnessSlug, relation, sourceUrl } = input;
  if (!modelSlug?.trim() || !harnessSlug?.trim()) {
    return new ToolLinkRefusedError("empty_slug", "model and harness slugs must both be non-empty");
  }
  if (!(TOOL_LINK_RELATIONS as readonly string[]).includes(relation)) {
    return new ToolLinkRefusedError("invalid_relation", `relation must be native or supports, got ${JSON.stringify(relation)}`);
  }
  if (modelSlug === harnessSlug) {
    return new ToolLinkRefusedError("self_link", `a tool cannot link to itself (${modelSlug})`);
  }
  if (sourceUrl != null && !isHttpUrl(sourceUrl)) {
    return new ToolLinkRefusedError("invalid_source_url", "source URL must be an absolute http or https URL");
  }
  return null;
}

interface SideRow {
  slug: string;
  kind: string;
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** Names the kind or existence rule a pair of slugs breaks, or null when both sides fit. */
function kindRefusal(input: ToolLinkInput, sides: SideRow[]): ToolLinkRefusedError | null {
  const model = sides.find((s) => s.slug === input.modelSlug);
  const harness = sides.find((s) => s.slug === input.harnessSlug);
  if (!model) return new ToolLinkRefusedError("unknown_model_slug", `no tool has slug ${input.modelSlug}`);
  if (!harness) return new ToolLinkRefusedError("unknown_harness_slug", `no tool has slug ${input.harnessSlug}`);
  if (model.kind !== "model") {
    return new ToolLinkRefusedError("model_side_not_model", `${input.modelSlug} has kind '${model.kind}', not 'model'`);
  }
  if (harness.kind !== "harness") {
    return new ToolLinkRefusedError("harness_side_not_harness", `${input.harnessSlug} has kind '${harness.kind}', not 'harness'`);
  }
  return null;
}

async function readSides(db: ToolLinksDb, input: ToolLinkInput): Promise<SideRow[]> {
  return rowsOf<SideRow>(
    await db.execute(sql`SELECT slug, kind FROM public."tools" WHERE slug IN (${input.modelSlug}, ${input.harnessSlug})`)
  );
}

/**
 * Says what `upsertToolLink` would do with one input, without writing.
 *
 * Why: the loader script validates every row before it writes any (dry run and --apply).
 * What: runs the pure checks, then reads both tools and any existing link, and returns
 *   `inserted`, `updated` or `unchanged`, or the refusal. Read-only. A kind can change
 *   between this read and the write; the writer re-checks in its own statement.
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("load-tool-links script").
 */
export async function planToolLink(db: ToolLinksDb, input: ToolLinkInput): Promise<ToolLinkPlan> {
  const invalid = validateToolLinkInput(input) ?? kindRefusal(input, await readSides(db, input));
  if (invalid) return { ok: false, error: invalid };
  const existing = rowsOf<{ relation: string; source_url: string | null }>(
    await db.execute(sql`SELECT l.relation, l.source_url FROM public."tool_links" AS l
      JOIN public."tools" AS m ON m.id = l.model_tool_id
      JOIN public."tools" AS h ON h.id = l.harness_tool_id
     WHERE m.slug = ${input.modelSlug} AND h.slug = ${input.harnessSlug}`)
  )[0];
  if (!existing) return { ok: true, outcome: "inserted" };
  const same = existing.relation === input.relation && existing.source_url === (input.sourceUrl ?? null);
  return { ok: true, outcome: same ? "unchanged" : "updated" };
}

/**
 * Inserts or updates one model -> harness link, refusing any link that breaks the rules.
 *
 * Why: the only write path into `tool_links` (plan 1.3, Q-A5). Until the 0017 backfill
 *   runs, every production tools row is kind='harness', so this refuses every link in
 *   production today with `model_side_not_model`. That is the intended behaviour.
 * What: pure checks first (`validateToolLinkInput`). Then ONE statement: a CTE selects
 *   both tools by slug with `kind = 'model'` / `kind = 'harness'` in its WHERE and locks
 *   them `FOR SHARE`, and the INSERT ... SELECT reads from it, upserting on the
 *   (model_tool_id, harness_tool_id) unique index. The lock blocks a concurrent kind
 *   UPDATE until this commits; if such an UPDATE committed first, READ COMMITTED
 *   re-checks the WHERE on the new row version and selects nothing. So no wrong-kind row
 *   can be written. When the statement selects no sides, a follow-up read names the
 *   reason and the function throws `ToolLinkRefusedError`; nothing was written.
 *   Idempotent: a re-run with the same relation and source URL writes nothing and leaves
 *   `updated_at` alone (`unchanged`); a changed relation or source URL sets
 *   `updated_at = now()` (`updated`).
 * Test: `tests/unit/tool-links-repository-183.test.ts` ("writer").
 */
export async function upsertToolLink(
  db: ToolLinksDb,
  input: ToolLinkInput
): Promise<{ id: string; outcome: ToolLinkOutcome }> {
  const invalid = validateToolLinkInput(input);
  if (invalid) throw invalid;
  const sourceUrl = input.sourceUrl ?? null;
  // #183: kind predicates, lock and insert in one statement, so no kind change slips between them.
  const result = await db.execute(sql`WITH sides AS (
      SELECT m.id AS model_tool_id, h.id AS harness_tool_id
        FROM public."tools" AS m, public."tools" AS h
       WHERE m.slug = ${input.modelSlug} AND m.kind = 'model'
         AND h.slug = ${input.harnessSlug} AND h.kind = 'harness'
         FOR SHARE OF m, h
    ), written AS (
      INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation, source_url)
      SELECT model_tool_id, harness_tool_id, ${input.relation}::text, ${sourceUrl}::text FROM sides
      ON CONFLICT (model_tool_id, harness_tool_id) DO UPDATE
         SET relation = EXCLUDED.relation, source_url = EXCLUDED.source_url, updated_at = now()
       WHERE (tool_links.relation, tool_links.source_url) IS DISTINCT FROM (EXCLUDED.relation, EXCLUDED.source_url)
      RETURNING id, (xmax = 0) AS inserted
    )
    SELECT COALESCE(w.id, l.id) AS id, w.inserted
      FROM sides AS s
      LEFT JOIN written AS w ON true
      LEFT JOIN public."tool_links" AS l ON l.model_tool_id = s.model_tool_id AND l.harness_tool_id = s.harness_tool_id`);
  const row = rowsOf<{ id: string; inserted: boolean | null }>(result)[0];
  if (!row) {
    throw (
      kindRefusal(input, await readSides(db, input)) ??
      // The sides fit now but did not when the statement ran: a kind changed in between.
      new ToolLinkRefusedError("kind_changed_during_write", "a tool kind changed during the write; nothing was written")
    );
  }
  const outcome: ToolLinkOutcome = row.inserted === null ? "unchanged" : row.inserted ? "inserted" : "updated";
  return { id: row.id, outcome };
}
