-- Migration: Drop the period-only unique constraint on rankings
-- Created: 2026-10-25
-- Description: #186 (M3-4) — production also carries the constraint
--   rankings_period_unique = UNIQUE (period), which 0020 did not drop. It allows one
--   rankings row per period across all lists, so a per-list publish would fail.
--   Uniqueness stays in force per (period, list) through rankings_period_list_idx (0020).
--   The guard and the drop run as one statement: the guard raises, and nothing is
--   dropped, unless that unique index exists and is valid. DROP CONSTRAINT IF EXISTS
--   makes a re-run a no-op. Dropping the constraint also drops its backing index.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0021_drop_rankings_period_unique.sql, show_columns_table rankings.

-- #186: drop UNIQUE (period) only once the (period, list) unique index is in place.
DO $l186$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_index
     WHERE indexrelid = to_regclass('public.rankings_period_list_idx')
       AND indrelid = 'public.rankings'::regclass
       AND indisunique AND indisvalid
  ) THEN
    RAISE EXCEPTION '#186 0021: unique index rankings_period_list_idx is missing or invalid; apply 0020 first';
  END IF;
  ALTER TABLE public."rankings" DROP CONSTRAINT IF EXISTS "rankings_period_unique";
END
$l186$;
--> statement-breakpoint
