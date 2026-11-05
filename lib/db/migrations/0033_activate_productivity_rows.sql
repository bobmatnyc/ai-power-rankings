-- Migration: Activate the nine productivity-board rows
-- Created: 2026-11-05
-- Description: #314 (ruling Dd3) — sets status 'active', the value the ranking generator
--   filters on (lib/services/ranking-generation.service.ts loadActiveTools), on the nine rows
--   0027 created inactive. APPLY ONLY INSIDE THE Dd3 WINDOW: after the Bce promote and before
--   the per-list publish (promote, activate, publish per-list, live check). Activation makes the
--   rows public at once on /api/tools, the sitemap and the tool pages, so run the publish next.
--   A row is activated only while it is still exactly as 0027 left it: kind 'productivity',
--   status 'inactive', data.createdBy the 0027 marker (tools has no created_by column). A row an
--   admin changed, or a row of the same slug that 0027 did not create, is left alone. The UPDATE
--   changes status and updated_at only, so a re-run finds no inactive row and writes nothing.
--   Raises, writing nothing, when no row carries the 0027 marker (0027 is not applied).
--   No schema change. Apply with .github/workflows/apply-migration.yml, migration_file
--   0033_activate_productivity_rows.sql, show_columns_table tools.

DO $p314c$
DECLARE
  slugs constant text[] := ARRAY['chatgpt', 'gemini-app', 'genspark', 'grok-app', 'hermes-agent', 'manus', 'microsoft-copilot', 'mistral-vibe', 'notion-ai'];
  marker constant text := 'migration 0027_create_productivity_rows';
  activated integer;
  skipped text;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- #314: precondition — 0027 is applied; else recording 0033 would skip activation for good.
  IF NOT EXISTS (SELECT 1 FROM public."tools" WHERE slug = ANY (slugs) AND data->>'createdBy' = marker) THEN
    RAISE EXCEPTION '#314 0033: no row carries the 0027 marker; apply 0027 first';
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
  RAISE NOTICE '#314 0033: activated % productivity rows; not active and left alone: %', activated, coalesce(skipped, 'none');
END
$p314c$;
--> statement-breakpoint
