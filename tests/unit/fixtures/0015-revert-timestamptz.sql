-- #237 rollback draft for 0015_timestamptz_utc.sql. NOT a migration: it lives under
-- tests/ so it never shows as pending and cannot be dispatched. Commit it as
-- lib/db/migrations/0016_revert_timestamptz.sql only if a rollback is needed.
-- Lossless: a timestamptz instant read back as its UTC wall clock.

-- tools: score_updated_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- rankings: published_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- news: published_at, date, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- companies: created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- migrations: started_at, completed_at, created_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- monthly_summaries: generated_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- state_of_ai_summaries: generated_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- automated_ingestion_runs: started_at, completed_at, created_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- tool_metrics_history: created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- metrics_collection_runs: started_at, finished_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- articles: published_date, ingested_at, processed_at, created_at, updated_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- article_rankings_changes: applied_at, rolled_back_at, created_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- article_processing_logs: started_at, completed_at, created_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
--> statement-breakpoint
-- ranking_versions: created_at
DO $tz237r$
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
    ELSIF kind = 'timestamp with time zone' THEN
      alters := alters || format('ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''', col, col);
    ELSE
      RAISE NOTICE '#237 skip %.%: already %', tbl, col, kind;
    END IF;
  END LOOP;
  IF cardinality(alters) > 0 THEN
    EXECUTE format('ALTER TABLE public.%I ', tbl) || array_to_string(alters, ', ');
  END IF;
END
$tz237r$;
