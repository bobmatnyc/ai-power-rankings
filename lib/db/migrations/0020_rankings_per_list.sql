-- Migration: One ranking board per list
-- Created: 2026-10-25
-- Description: #186 (M3-4) — rankings rows are keyed by (period, list) instead of period.
--   list is 'combined' (the legacy one-board rows, kept for rollback and export, D55),
--   'harness', 'model' or 'productivity'. Every existing row becomes 'combined' through
--   the column default; no row is rewritten or deleted. The period-only unique index is
--   replaced by a (period, list) one, and a partial unique index allows at most one
--   current board per list. The precondition guard raises, and writes nothing, when more
--   than one row is current today.
--   D52: image and video models stay out of the models list. The list reads
--   tools.data.modality; this file sets it on the three model rows the kind sheet marks
--   as image or video models. A tool whose modality is already set is left as it is.
--   Every statement is guarded (IF NOT EXISTS, a pg_constraint lookup, or a WHERE on
--   the current value), so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0020_rankings_per_list.sql, show_columns_table rankings.

-- #186: precondition — at most one current row before the per-list index exists.
DO $l186$
DECLARE
  current_rows integer;
BEGIN
  SELECT count(*)::int INTO current_rows FROM public."rankings" WHERE is_current;
  IF current_rows > 1 AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rankings' AND column_name = 'list'
  ) THEN
    RAISE EXCEPTION '#186 0020: % rankings rows are current; expected at most 1', current_rows;
  END IF;
END
$l186$;
--> statement-breakpoint

-- #186: the list column. A constant default, so Postgres adds it without a table rewrite.
DO $l186$
BEGIN
  SET LOCAL lock_timeout = '5s';
  ALTER TABLE public."rankings" ADD COLUMN IF NOT EXISTS "list" text DEFAULT 'combined' NOT NULL;
END
$l186$;
--> statement-breakpoint

-- #186: list is one of four values.
DO $l186$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'rankings_list_check' AND conrelid = 'public.rankings'::regclass
  ) THEN
    ALTER TABLE public."rankings" ADD CONSTRAINT "rankings_list_check"
      CHECK (list IN ('combined', 'harness', 'model', 'productivity'));
  END IF;
END
$l186$;
--> statement-breakpoint

-- #186: one row per (period, list). Built before the period-only index is dropped, so a
-- duplicate period is refused by one of the two at every point.
CREATE UNIQUE INDEX IF NOT EXISTS "rankings_period_list_idx" ON public."rankings" USING btree ("period", "list");
--> statement-breakpoint
DROP INDEX IF EXISTS public."rankings_period_idx";
--> statement-breakpoint

-- #186: at most one current board per list.
CREATE UNIQUE INDEX IF NOT EXISTS "rankings_one_current_per_list_idx" ON public."rankings" USING btree ("list") WHERE is_current;
--> statement-breakpoint

-- D52: the image and video models named in docs/refresh/tool-kind-mapping.csv.
UPDATE public."tools"
   SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{modality}', '"image"'::jsonb)
 WHERE slug = 'nano-banana-pro' AND kind = 'model' AND NOT (COALESCE(data, '{}'::jsonb) ? 'modality');
--> statement-breakpoint
UPDATE public."tools"
   SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{modality}', '"video"'::jsonb)
 WHERE slug IN ('seedance-2-0', 'bytedance-seedance-2-0') AND kind = 'model' AND NOT (COALESCE(data, '{}'::jsonb) ? 'modality');
--> statement-breakpoint
