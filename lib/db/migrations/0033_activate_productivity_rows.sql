-- Migration: Activate seven of the nine productivity-board rows
-- Created: 2026-11-05
-- Description: #314 (rulings Dd3, D80) — sets status 'active', the value the ranking generator
--   filters on (lib/services/ranking-generation.service.ts loadActiveTools), on seven of the nine
--   rows 0027 created inactive: chatgpt, genspark, grok-app, hermes-agent, manus,
--   microsoft-copilot and notion-ai. D80: gemini-app and mistral-vibe lack enough verified data
--   (include_in_0033 false in docs/refresh/productivity-metrics.json) and stay inactive; the UPDATE
--   never names them. D69: run scripts/load-productivity-metrics.ts --apply in the same release
--   step, before this file, so the seven rows go live with their metrics.
--   APPLY ONLY INSIDE THE Dd3 WINDOW: after the Bce promote and before
--   the per-list publish (promote, activate, publish per-list, live check). Activation makes the
--   rows public at once on /api/tools, the sitemap and the tool pages, so run the publish next.
--   A row is activated only while it is still exactly as 0027 left it: kind 'productivity',
--   status 'inactive', data.createdBy the 0027 marker (tools has no created_by column). The UPDATE
--   never touches a row an admin changed or a same-slug row 0027 did not create, but such a row
--   leaves fewer than seven active, so the whole file then raises (below) and writes nothing. The
--   UPDATE changes status and updated_at only, so a re-run finds no inactive row and writes nothing.
--   Raises, writing nothing and leaving 0033 unrecorded, when no row carries the 0027 marker
--   (0027 is not applied), when any of the seven rows has no data.metrics_provenance (the loader
--   has not run, D69), or when fewer than seven rows end active with the 0027 marker.
--   No schema change. Apply with .github/workflows/apply-migration.yml, migration_file
--   0033_activate_productivity_rows.sql, show_columns_table tools.

DO $p314c$
DECLARE
  -- #314 D80: seven slugs; gemini-app and mistral-vibe are left out and stay inactive.
  slugs constant text[] := ARRAY['chatgpt', 'genspark', 'grok-app', 'hermes-agent', 'manus', 'microsoft-copilot', 'notion-ai'];
  marker constant text := 'migration 0027_create_productivity_rows';
  activated integer;
  active_count integer;
  skipped text;
  unloaded text;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- #314: precondition — 0027 is applied; else recording 0033 would skip activation for good.
  IF NOT EXISTS (SELECT 1 FROM public."tools" WHERE slug = ANY (slugs) AND data->>'createdBy' = marker) THEN
    RAISE EXCEPTION '#314 0033: no row carries the 0027 marker; apply 0027 first';
  END IF;
  -- #314 D69: the metrics load comes first, so no row goes live without its metrics.
  SELECT string_agg(slug, ', ' ORDER BY slug) INTO unloaded
    FROM public."tools"
   WHERE slug = ANY (slugs) AND NOT (data ? 'metrics_provenance');
  IF unloaded IS NOT NULL THEN
    RAISE EXCEPTION '#314 0033: no metrics on %; run the loader first (scripts/load-productivity-metrics.ts --apply)', unloaded;
  END IF;

  -- #314: activate only the rows still as 0027 left them.
  UPDATE public."tools"
     SET status = 'active', updated_at = now()
   WHERE slug = ANY (slugs)
     AND kind = 'productivity'
     AND status = 'inactive'
     AND data->>'createdBy' = marker;
  GET DIAGNOSTICS activated = ROW_COUNT;

  -- #314: name every slug left as it was and not active, so the log shows what was skipped.
  SELECT string_agg(s.slug || coalesce(format(' (kind %s, status %s, createdBy %s)', t.kind, t.status, coalesce(t.data->>'createdBy', 'none')), ' (no row)'), ', ' ORDER BY s.slug)
    INTO skipped
    FROM unnest(slugs) AS s(slug)
    LEFT JOIN public."tools" AS t ON t.slug = s.slug
   WHERE t.id IS NULL OR t.kind <> 'productivity' OR t.status <> 'active' OR t.data->>'createdBy' IS DISTINCT FROM marker;
  -- #314: fewer than seven active raises, so the DO block rolls back and 0033 stays unrecorded.
  -- The NOTICE alone is not enough: the neon-http driver drops it. A forced re-run with all
  -- seven already active counts seven and passes as a no-op.
  SELECT count(*)::int INTO active_count
    FROM public."tools"
   WHERE slug = ANY (slugs) AND kind = 'productivity' AND status = 'active' AND data->>'createdBy' = marker;
  IF active_count <> 7 THEN
    RAISE EXCEPTION '#314 0033: % of 7 active; nothing recorded (not active: %)', active_count, coalesce(skipped, 'none');
  END IF;
  RAISE NOTICE '#314 0033: activated % of 7 productivity rows; not active and left alone: %; gemini-app and mistral-vibe not in scope (D80)', activated, coalesce(skipped, 'none');
END
$p314c$;
--> statement-breakpoint
