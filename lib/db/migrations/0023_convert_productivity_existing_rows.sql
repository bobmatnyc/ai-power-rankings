-- Migration: Move three existing rows to the productivity board
-- Created: 2026-10-27
-- Description: #314 (ruling Dd1) — three rows that already exist move to kind 'productivity':
--   claude-artifacts is renamed Claude.AI (slug and history kept; category, subcategory and
--   website change), openclaw changes kind only (harness to productivity), and perplexity changes
--   kind and subcategory (other/non_ai to productivity/ai_assistant). openclaw's two retired alias
--   rows, clawdbot and moltbot, change kind only, because the kind sheet holds a retired row at its
--   survivor's kind; they are redirect rows and sit on no board. Status, scores, metrics and
--   every other column stay as they are. chatgpt-canvas, claude-desktop-extensions and cowork stay
--   harnesses and are not touched.
--   APPLY WITH ACTIVATION, AFTER 2026-11-01, not with 0022: a kind change removes openclaw and
--   claude-artifacts from the harness board at the next publish.
--   Perplexity's tool page stays noindex: its signed noindex row in the URL table is a separate
--   ruling and this file does not touch it.
--   One DO block: a guard failure raises and writes nothing. The UPDATEs skip rows already in the
--   target state, so a re-run writes nothing and leaves updated_at alone.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0023_convert_productivity_existing_rows.sql, show_columns_table tools.

DO $p314b$
DECLARE
  clash text;
  state text;
  changed integer := 0;
  n integer;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- #314: precondition — 0016 is applied (tools.kind exists).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tools' AND column_name = 'kind'
  ) THEN
    RAISE EXCEPTION '#314 0023: tools.kind is missing; apply 0016 first';
  END IF;

  -- #314: guard — exactly one Claude.AI row may exist, and it is claude-artifacts.
  SELECT string_agg(format('%s (name %s)', slug, name), ', ' ORDER BY slug) INTO clash
    FROM public."tools"
   WHERE slug <> 'claude-artifacts' AND (slug = 'claude-ai' OR lower(name) = 'claude.ai');
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION '#314 0023: another Claude.AI row exists: %', clash;
  END IF;

  -- #314: guard — each row exists and is in its old state or already converted.
  SELECT kind INTO state FROM public."tools" WHERE slug = 'claude-artifacts';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0023: claude-artifacts has no tools row';
  ELSIF state NOT IN ('harness', 'productivity') THEN
    RAISE EXCEPTION '#314 0023: claude-artifacts has kind %, expected harness or productivity', state;
  END IF;
  SELECT kind INTO state FROM public."tools" WHERE slug = 'openclaw';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0023: openclaw has no tools row';
  ELSIF state NOT IN ('harness', 'productivity') THEN
    RAISE EXCEPTION '#314 0023: openclaw has kind %, expected harness or productivity', state;
  END IF;
  SELECT kind INTO state FROM public."tools" WHERE slug = 'perplexity';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0023: perplexity has no tools row';
  ELSIF state NOT IN ('other', 'productivity') THEN
    RAISE EXCEPTION '#314 0023: perplexity has kind %, expected other or productivity', state;
  END IF;

  -- #314: guard — a row that stops being a harness must not be the harness side of a link
  -- (tool_links.harness_tool_id rows must point at kind harness; see TOOL_LINK_KIND_VIOLATIONS_SQL).
  IF to_regclass('public.tool_links') IS NOT NULL THEN
    SELECT string_agg(t.slug, ', ' ORDER BY t.slug) INTO clash
      FROM public."tool_links" l JOIN public."tools" t ON t.id = l.harness_tool_id
     WHERE t.slug IN ('claude-artifacts', 'openclaw', 'clawdbot', 'moltbot') AND t.kind = 'harness';
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION '#314 0023: tool_links still use these rows as a harness: %', clash;
    END IF;
  END IF;

  -- #314: claude-artifacts becomes Claude.AI. The slug and id stay; the JSON name is renamed only
  -- when the row carries one, and the website is set under data.info.
  UPDATE public."tools"
     SET name = 'Claude.AI',
         kind = 'productivity',
         subcategory = 'ai_assistant',
         category = 'productivity',
         data = jsonb_set(
                  CASE WHEN data->'name' IS NOT NULL
                       THEN jsonb_set(coalesce(data, '{}'::jsonb), '{name}', '"Claude.AI"'::jsonb)
                       ELSE coalesce(data, '{}'::jsonb) END,
                  '{info}',
                  coalesce(data->'info', '{}'::jsonb) || '{"website": "https://claude.ai"}'::jsonb),
         updated_at = now()
   WHERE slug = 'claude-artifacts'
     AND (name IS DISTINCT FROM 'Claude.AI'
          OR kind IS DISTINCT FROM 'productivity'
          OR subcategory IS DISTINCT FROM 'ai_assistant'
          OR category IS DISTINCT FROM 'productivity'
          OR data #>> '{info,website}' IS DISTINCT FROM 'https://claude.ai');
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: openclaw changes kind only; its other fields are corrected in a separate change.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug = 'openclaw' AND kind IS DISTINCT FROM 'productivity';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: openclaw's retired aliases follow it; a missing alias row is not an error.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug IN ('clawdbot', 'moltbot') AND kind = 'harness';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: perplexity changes kind and subcategory; category, status and data stay.
  UPDATE public."tools"
     SET kind = 'productivity', subcategory = 'ai_assistant', updated_at = now()
   WHERE slug = 'perplexity'
     AND (kind IS DISTINCT FROM 'productivity' OR subcategory IS DISTINCT FROM 'ai_assistant');
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: post-check — all three rows are productivity and claude-artifacts is named Claude.AI.
  SELECT count(*)::int INTO n
    FROM public."tools"
   WHERE slug IN ('claude-artifacts', 'openclaw', 'perplexity') AND kind = 'productivity';
  IF n <> 3 THEN
    RAISE EXCEPTION '#314 0023: % of 3 rows are productivity after the update', n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."tools" WHERE slug = 'claude-artifacts' AND name = 'Claude.AI') THEN
    RAISE EXCEPTION '#314 0023: claude-artifacts is not named Claude.AI after the update';
  END IF;
  RAISE NOTICE '#314 0023: updated % rows', changed;
END
$p314b$;
--> statement-breakpoint
