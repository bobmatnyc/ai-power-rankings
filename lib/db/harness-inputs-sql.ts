/**
 * Renders migration 0024 (harness input corrections) from the reviewed source file (#313, #312).
 *
 * Why: the corrections are data, reviewed as `docs/refresh/harness-inputs-2026-10.json` and
 *   applied by hand. Generating the SQL keeps file and migration in step, and lets the owner
 *   switch a De4 group off at generation time (`excludeGroups`) without editing SQL.
 * What: `buildHarnessInputsSql(rows, { excludeGroups })` returns one DO block. It locks the
 *   rows, refuses a missing slug, and per row writes only when the current value equals the
 *   expected old value or already equals the target; any other value RAISES and the whole block
 *   rolls back. Group c values are computed from the articles table (harness-inputs-news-sql.ts).
 *   Provenance goes to `data.business_metrics_provenance.fields.<field>`: that block already
 *   holds `{as_of, value, source, fidelity, recovery_note}` for these tools in stored data and
 *   the D-series data pass wrote it (CHANGELOG, "provenance recorded in
 *   `data.business_metrics_provenance`"). Nothing in origin/main reads `data.metrics_provenance`
 *   (#299 is unmerged), so writing it would add a block no reader uses. A removed value loses
 *   its entry. A row with an `identity` also needs the stored package or extension id to match;
 *   a write below info.metrics raises while data.metrics holds the same key (the engine reads the
 *   top-level key first). `updated_at` is never touched. Ends with a post-check of every row and a count notice. The generator never
 *   connects to a database.
 * Test: `tests/unit/harness-inputs-sheet-313.test.ts`, `tests/unit/harness-inputs-0024-313.test.ts`.
 */

import type { HarnessInputGroup, HarnessInputRow } from "./harness-inputs";
import { NEWS_BODY, NEWS_DECLARE, NEWS_DRIFT } from "./harness-inputs-news-sql";

export const HARNESS_INPUTS_MIGRATION = "0024_correct_harness_inputs.sql";

const text = (value: string | undefined): string => (value === undefined ? "NULL::text" : `'${value.replace(/'/g, "''")}'`);
const jsonb = (value: unknown): string =>
  value === undefined ? "NULL::jsonb" : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

/** One VALUES tuple per line, so a group's rows can be counted in the committed file. */
function rowTuple(r: HarnessInputRow): string {
  const path = `ARRAY[${r.path.map((s) => text(s)).join(", ")}]::text[]`;
  return (
    `(${r.id}, ${text(r.group)}, ${text(r.slug)}, ${path}, ${text(r.op)}, ${text(r.field)}, ` +
    `${r.expected_old_absent ? "true" : "false"}, ${jsonb(r.expected_old)}, ${jsonb(r.new)}, ${text(r.compute)}, ` +
    `${text(r.source_url)}, ${text(r.as_of)}, ${text(r.reason)}, ` +
    `${r.identity ? `ARRAY[${r.identity.path.map((s) => text(s)).join(", ")}]::text[]` : "NULL::text[]"}, ${jsonb(r.identity?.value)})`
  );
}

export interface BuildOptions {
  /** De4 groups left out of the file. Default: none (the committed file has every group). */
  excludeGroups?: readonly HarnessInputGroup[];
}

// #313: the per-row write. A row writes only from its expected old value or from its target.
const ROW_LOOP = `
  FOR r IN SELECT * FROM t313_rows ORDER BY seq LOOP
    SELECT t.data INTO d FROM public."tools" AS t WHERE t.slug = r.slug;
    cur := d #> r.path;
    changed := false;
    prov := d #> ARRAY['business_metrics_provenance', 'fields', r.field];
    -- #313: a row about a package or extension applies only to the one it was sourced for.
    IF r.ident_path IS NOT NULL AND (d #> r.ident_path) IS DISTINCT FROM r.ident THEN
      RAISE EXCEPTION '#313 0024: % identity at % holds % (expected %); refusing to touch %', r.slug, r.ident_path, d #> r.ident_path, r.ident, r.path;
    END IF;
    -- #313: the engine reads data.metrics.<key> before data.info.metrics.<key>, so a write below info.metrics
    -- is invisible while the top-level key exists.
    IF r.op <> 'delete' AND r.path[1] = 'info' AND jsonb_typeof(d -> 'metrics') = 'object' AND (d -> 'metrics') ? r.field THEN
      RAISE EXCEPTION '#313 0024: % write to info.metrics.% is shadowed by data.metrics.% (holds %); refusing to write', r.slug, r.field, r.field, d -> 'metrics' -> r.field;
    END IF;
    IF r.compute IS NOT NULL THEN
      SELECT COALESCE(t.data -> 'slug', to_jsonb(t.slug)) #>> '{}' INTO eff_slug FROM public."tools" AS t WHERE t.slug = r.slug;
      IF eff_slug IS DISTINCT FROM r.slug THEN
        RAISE EXCEPTION '#313 0024: % carries data.slug %, so the news corpus names it differently', r.slug, eff_slug;
      END IF;
      target := to_jsonb(COALESCE((news_counts ->> r.slug)::integer, 0));
      -- A value this migration already wrote stays: the corpus moves daily, a re-run must not.
      IF prov ->> 'migration' = '0024' AND jsonb_typeof(cur) = 'number' THEN
        already := already + 1;
        CONTINUE;
      END IF;
    ELSE
      target := r.newv;
    END IF;

    IF r.op = 'delete' THEN
      IF cur IS NULL THEN
        NULL;
      ELSIF jsonb_typeof(cur) = jsonb_typeof(r.expected) AND cur @> r.expected THEN
        d := d #- r.path;
        changed := true;
      ELSE
        RAISE EXCEPTION '#313 0024: % at % holds % (expected %); refusing to delete', r.slug, r.path, cur, r.expected;
      END IF;
      IF prov IS NOT NULL THEN
        d := d #- ARRAY['business_metrics_provenance', 'fields', r.field];
        changed := true;
      END IF;
    ELSE
      IF cur IS NOT DISTINCT FROM target THEN
        NULL;
      ELSIF (r.exp_absent AND cur IS NULL)
         OR (NOT r.exp_absent AND cur IS NOT NULL AND jsonb_typeof(cur) = jsonb_typeof(r.expected) AND cur @> r.expected) THEN
        FOR i IN 1 .. cardinality(r.path) - 1 LOOP
          IF d #> r.path[1:i] IS NULL THEN
            d := jsonb_set(d, r.path[1:i], '{}'::jsonb);
          ELSIF jsonb_typeof(d #> r.path[1:i]) <> 'object' THEN
            RAISE EXCEPTION '#313 0024: % at % is not an object', r.slug, r.path[1:i];
          END IF;
        END LOOP;
        d := jsonb_set(d, r.path, target);
        changed := true;
      ELSE
        RAISE EXCEPTION '#313 0024: % at % holds % (expected %); refusing to overwrite', r.slug, r.path, cur,
          CASE WHEN r.exp_absent THEN 'nothing' ELSE r.expected::text END;
      END IF;
      entry := jsonb_build_object('value', target, 'source', r.source, 'migration', '0024', 'issue', '#313',
                 'as_of', CASE WHEN r.compute IS NOT NULL THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') ELSE r.as_of END);
      IF r.compute IS NOT NULL THEN entry := entry || '{"window": "12 months"}'::jsonb; END IF;
      IF prov IS DISTINCT FROM entry THEN
        IF d -> 'business_metrics_provenance' IS NULL THEN
          d := jsonb_set(d, '{business_metrics_provenance}', '{}'::jsonb);
        ELSIF jsonb_typeof(d -> 'business_metrics_provenance') <> 'object' THEN
          RAISE EXCEPTION '#313 0024: % business_metrics_provenance is not an object', r.slug;
        END IF;
        IF d #> '{business_metrics_provenance,fields}' IS NULL THEN
          d := jsonb_set(d, '{business_metrics_provenance,fields}', '{}'::jsonb);
        ELSIF jsonb_typeof(d #> '{business_metrics_provenance,fields}') <> 'object' THEN
          RAISE EXCEPTION '#313 0024: % business_metrics_provenance.fields is not an object', r.slug;
        END IF;
        d := jsonb_set(d, ARRAY['business_metrics_provenance', 'fields', r.field], entry);
        changed := true;
      END IF;
    END IF;

    IF changed THEN
      -- updated_at stays: a data correction is not a public update (/api/whats-new reads it).
      UPDATE public."tools" SET data = d WHERE slug = r.slug;
      applied := applied + 1;
    ELSE
      already := already + 1;
    END IF;
  END LOOP;
`;

function postCheck(total: number): string {
  return `
  -- Post-check: every row is at its target, provenance agrees, and the row count matches the file.
  FOR r IN SELECT * FROM t313_rows ORDER BY seq LOOP
    SELECT t.data INTO d FROM public."tools" AS t WHERE t.slug = r.slug;
    cur := d #> r.path;
    prov := d #> ARRAY['business_metrics_provenance', 'fields', r.field];
    IF r.op = 'delete' THEN
      ok := cur IS NULL AND prov IS NULL;
    ELSIF r.compute IS NOT NULL THEN
      ok := jsonb_typeof(cur) = 'number' AND prov ->> 'migration' = '0024';
    ELSE
      ok := cur IS NOT DISTINCT FROM r.newv AND prov ->> 'migration' = '0024';
    END IF;
    IF NOT ok THEN
      RAISE EXCEPTION '#313 0024: post-check failed for % at % (value %, provenance %)', r.slug, r.path, cur, prov;
    END IF;
    checked := checked + 1;
  END LOOP;
  IF checked <> ${total} THEN
    RAISE EXCEPTION '#313 0024: post-check covered % rows, the file has ${total}', checked;
  END IF;
  RAISE NOTICE '#313 0024: % rows over % tools: % changed, % already at target', checked, (SELECT count(DISTINCT slug) FROM t313_rows), applied, already;
`;
}

/** The migration text for `rows` (already validated), minus any excluded group. */
export function buildHarnessInputsSql(rows: readonly HarnessInputRow[], options: BuildOptions = {}): string {
  const excluded = new Set(options.excludeGroups ?? []);
  const kept = rows.filter((r) => !excluded.has(r.group));
  if (kept.length === 0) throw new Error("every group is excluded: nothing to build");
  const hasNews = kept.some((r) => r.compute !== undefined);
  const slugs = [...new Set(kept.map((r) => r.slug))].sort();
  const groups = [...new Set(kept.map((r) => r.group))].join(", ");

  return `-- Migration: Correct harness adoption inputs with sourced figures
-- #313, #312: generated by scripts/build-harness-inputs-migration.ts from
--   docs/refresh/harness-inputs-2026-10.json. Do not edit by hand; regenerate from the file.
--   Data only, applied by hand through apply-migration.yml (dry run first, Neon branch first).
--   Groups in this file: ${groups}${excluded.size > 0 ? ` (left out: ${[...excluded].join(", ")})` : ""}. Rows: ${kept.length} over ${slugs.length} tools.
--   One DO block: a missing slug, an unexpected old value or a failed post-check raises and
--   writes nothing. A write needs the expected old value or the target already in place, so a
--   re-run changes nothing and a hand edit is never overwritten. Weights and the company-name
--   bonus are not touched. Provenance: data.business_metrics_provenance.fields.<field>.

DO $k313$
DECLARE
  missing text;
  r record;
  d jsonb;
  cur jsonb;
  prov jsonb;
  entry jsonb;
  target jsonb;
  eff_slug text;
  changed boolean;
  ok boolean;
  i integer;
  applied integer := 0;
  already integer := 0;
  checked integer := 0;${hasNews ? NEWS_DECLARE : ""}
BEGIN
  SET LOCAL lock_timeout = '5s';

  SELECT string_agg(s.slug, ', ' ORDER BY s.slug) INTO missing
    FROM (VALUES ${slugs.map((s) => `(${text(s)})`).join(", ")}) AS s(slug)
   WHERE NOT EXISTS (SELECT 1 FROM public."tools" AS t WHERE t.slug = s.slug);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '#313 0024: slugs missing from tools: %', missing;
  END IF;
  PERFORM 1 FROM public."tools" AS t WHERE t.slug = ANY (ARRAY[${slugs.map((s) => text(s)).join(", ")}]) ORDER BY t.slug FOR UPDATE;

  CREATE TEMP TABLE t313_rows ON COMMIT DROP AS
  SELECT * FROM (VALUES
${kept.map((r) => `    ${rowTuple(r)}`).join(",\n")}
  ) AS v(seq, grp, slug, path, op, field, exp_absent, expected, newv, compute, source, as_of, reason, ident_path, ident);
${hasNews ? NEWS_BODY : ""}${ROW_LOOP}${hasNews ? NEWS_DRIFT : ""}${postCheck(kept.length)}END
$k313$;
`;
}
