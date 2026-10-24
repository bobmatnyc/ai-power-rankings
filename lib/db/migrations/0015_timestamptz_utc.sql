-- #237: move every timestamp column to timestamptz, keeping each stored instant.
-- Every writer stored the UTC wall clock in these zone-less columns, so each value is
-- read as UTC: `USING col AT TIME ZONE 'UTC'`, which does not depend on the session
-- zone. A bare cast (`col::timestamptz`) would read it in the session zone instead.
--
-- One statement per table, so each ACCESS EXCLUSIVE lock (the type change rewrites the
-- table and its indexes) is held by one short transaction; all columns of a table change
-- in one ALTER, so one rewrite. `lock_timeout` makes a statement fail rather than queue
-- behind a running writer; re-dispatching is safe.
--
-- Guarded and idempotent: a column converts only while information_schema reports
-- 'timestamp without time zone'. A missing table, a missing column or an already
-- converted column is skipped with a NOTICE, so applying the file twice changes nothing.
-- DEFAULT now() and index names survive the type change.
--
-- Hand-written (drizzle-kit generate would diff against a stale snapshot). Apply only
-- with `scripts/apply-migrations.ts --only 0015_timestamptz_utc.sql`, which refuses
-- without an acknowledged read-only preflight report for the target database.

-- tools: score_updated_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'tools';
  cols constant text[] := ARRAY['score_updated_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- rankings: published_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'rankings';
  cols constant text[] := ARRAY['published_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- news: published_at, date, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'news';
  cols constant text[] := ARRAY['published_at', 'date', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- companies: created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'companies';
  cols constant text[] := ARRAY['created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- migrations: started_at, completed_at, created_at
DO $tz237$
DECLARE
  tbl constant text := 'migrations';
  cols constant text[] := ARRAY['started_at', 'completed_at', 'created_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- monthly_summaries: generated_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'monthly_summaries';
  cols constant text[] := ARRAY['generated_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- state_of_ai_summaries: generated_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'state_of_ai_summaries';
  cols constant text[] := ARRAY['generated_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- automated_ingestion_runs: started_at, completed_at, created_at
DO $tz237$
DECLARE
  tbl constant text := 'automated_ingestion_runs';
  cols constant text[] := ARRAY['started_at', 'completed_at', 'created_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- tool_metrics_history: created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'tool_metrics_history';
  cols constant text[] := ARRAY['created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- metrics_collection_runs: started_at, finished_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'metrics_collection_runs';
  cols constant text[] := ARRAY['started_at', 'finished_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- articles: published_date, ingested_at, processed_at, created_at, updated_at
DO $tz237$
DECLARE
  tbl constant text := 'articles';
  cols constant text[] := ARRAY['published_date', 'ingested_at', 'processed_at', 'created_at', 'updated_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- article_rankings_changes: applied_at, rolled_back_at, created_at
DO $tz237$
DECLARE
  tbl constant text := 'article_rankings_changes';
  cols constant text[] := ARRAY['applied_at', 'rolled_back_at', 'created_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- article_processing_logs: started_at, completed_at, created_at
DO $tz237$
DECLARE
  tbl constant text := 'article_processing_logs';
  cols constant text[] := ARRAY['started_at', 'completed_at', 'created_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
--> statement-breakpoint
-- ranking_versions: created_at
DO $tz237$
DECLARE
  tbl constant text := 'ranking_versions';
  cols constant text[] := ARRAY['created_at'];
  col text;
  kind text;
  alters text[] := ARRAY[]::text[];
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF to_regclass(format('public.%I', tbl)) IS NULL THEN
    RAISE NOTICE '#237 skip %: table missing', tbl;
    RETURN;
  END IF;
  FOREACH col IN ARRAY cols LOOP
    SELECT data_type INTO kind FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;
    IF NOT FOUND THEN
      RAISE NOTICE '#237 skip %.%: column missing', tbl, col;
    ELSIF kind = 'timestamp without time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237$;
