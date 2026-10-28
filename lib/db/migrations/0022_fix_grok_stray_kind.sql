-- Migration: Give the three stray Grok point rows their model kind and archive them
-- Created: 2026-10-28
-- Description: D7b (#329) — grok-4-5, grok-4-6 and grok-4-7 are Grok model versions held
--   by kind 'harness' rows with status 'pending_review' (rows created after the 0017
--   backfill took the 0016 kind default), so the model seed refuses grok-4-5 and grok-4-6
--   ("slug is held by a harness row, not a model"). grok-4-7 duplicates the live `grok`
--   family row, which is Grok 4.7.
--   Sets kind 'model' and subcategory NULL on all three, as 0017 does for models, and
--   archives all three: status 'deprecated', data.d7b.supersededBy 'grok'. The seed's
--   set_status step refuses 'pending_review' as a from-state (MODEL_STATUS_FROM in
--   lib/db/repositories/model-lifecycle.ts), so a kind-only fix would leave grok-4-5 and
--   grok-4-6 refused; from 'deprecated' the seed sets deprecated -> deprecated and adds its
--   data.modelLifecycle record. grok-4-7 is outside docs/refresh/model-lifecycle.json, so
--   nothing else ever sets its status.
--   Fail-closed, in ONE DO block: unless all three rows exist as kind 'harness' with status
--   'pending_review' (the state the D7b pre-check observed), no tool_links row touches them,
--   and `grok` is an active model, it raises and writes nothing. data.d7b on each row marks
--   the fix and keeps the previous kind, subcategory and status; a re-run with all three
--   marked is a no-op, and a partial state (some rows marked, some not) raises.
--   Recovery: the named Neon branch taken before the apply (D98 pre-apply branch) is the
--   recovery path; data.d7b.from_* also holds each row's previous values.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0022_fix_grok_stray_kind.sql, show_columns_table tools; dry_run=true first.

-- D7b: owner ruling "Fix the 3 rows to kind=model through a reviewed write".
DO $d7b$
DECLARE
  stray constant text[] := ARRAY['grok-4-5', 'grok-4-6', 'grok-4-7'];
  mark constant text := 'migration 0022_fix_grok_stray_kind (D7b)';
  marked integer;
  bad text;
  linked integer;
  target_ok integer;
  n integer;
BEGIN
  SET LOCAL lock_timeout = '5s';

  -- D7b: lock the four rows before reading them. A tool_links insert takes FOR KEY SHARE
  -- on the tools rows it references, so these locks also hold off a new link on a stray.
  PERFORM 1 FROM public."tools" WHERE slug = ANY (stray || ARRAY['grok']) ORDER BY slug FOR UPDATE;

  -- D7b: already applied? All three marked is a no-op; some marked is a partial state.
  SELECT count(*)::int INTO marked FROM public."tools"
   WHERE slug = ANY (stray) AND data->'d7b'->>'by' = mark;
  IF marked = 3 THEN
    SELECT string_agg(slug || format(' is %s/%s', kind, status), '; ' ORDER BY slug) INTO bad
      FROM public."tools"
     WHERE slug = ANY (stray)
       AND (kind <> 'model' OR data->'d7b'->>'supersededBy' IS DISTINCT FROM 'grok');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'D7b 0022: rows are marked as fixed but differ from the fixed state: %', bad;
    END IF;
    RAISE NOTICE 'D7b 0022: already applied, 0 rows changed';
    RETURN;
  END IF;
  IF marked <> 0 THEN
    RAISE EXCEPTION 'D7b 0022: partial state, % of 3 rows already marked; restore from the D98 branch', marked;
  END IF;

  -- D7b guard 1: each row exists as harness/pending_review, the state the pre-check observed.
  -- Any other kind or status (redirect included) means the rows moved since; stop and re-check.
  SELECT string_agg(s.slug || CASE WHEN t.id IS NULL THEN ' is missing'
                                   ELSE format(' is %s/%s, expected harness/pending_review', t.kind, t.status) END,
                    '; ' ORDER BY s.slug) INTO bad
    FROM unnest(stray) AS s(slug)
    LEFT JOIN public."tools" AS t ON t.slug = s.slug
   WHERE t.id IS NULL OR t.kind <> 'harness' OR t.status <> 'pending_review';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'D7b 0022: precondition failed, nothing written: %', bad;
  END IF;

  -- D7b guard 2: no model-harness link touches them; a kind change would break the link kind rule.
  SELECT count(*)::int INTO linked FROM public."tool_links" AS l
    JOIN public."tools" AS t ON t.id IN (l.model_tool_id, l.harness_tool_id)
   WHERE t.slug = ANY (stray);
  IF linked <> 0 THEN
    RAISE EXCEPTION 'D7b 0022: % tool_links row(s) touch the stray rows; resolve them first', linked;
  END IF;

  -- D7b guard 3: the supersession target is the live Grok family row.
  SELECT count(*)::int INTO target_ok FROM public."tools"
   WHERE slug = 'grok' AND kind = 'model' AND status = 'active';
  IF target_ok <> 1 THEN
    RAISE EXCEPTION 'D7b 0022: grok is not an active model row';
  END IF;

  -- D7b: kind fix and archive on all three; data.d7b keeps the previous values.
  UPDATE public."tools"
     SET kind = 'model',
         subcategory = NULL,
         status = 'deprecated',
         data = data || jsonb_build_object('d7b', jsonb_build_object(
           'by', mark, 'from_kind', kind, 'from_subcategory', subcategory, 'from_status', status,
           'supersededBy', 'grok', 'archiveReason', 'superseded')),
         updated_at = now()
   WHERE slug = ANY (stray) AND kind = 'harness' AND status = 'pending_review';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN
    RAISE EXCEPTION 'D7b 0022: kind fix changed % rows, expected 3', n;
  END IF;

  RAISE NOTICE 'D7b 0022: 3 rows set to kind model and archived';
END
$d7b$;
--> statement-breakpoint
