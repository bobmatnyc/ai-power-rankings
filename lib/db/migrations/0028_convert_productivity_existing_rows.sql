-- Migration: Move six existing rows to the productivity board
-- Created: 2026-10-27
-- Description: #314 (ruling Dd1) — six rows that already exist move to kind 'productivity':
--   claude-artifacts is renamed Claude.AI (slug and history kept; category, subcategory and
--   website change), openclaw changes kind (harness to productivity) and listing fields, and perplexity changes
--   kind, subcategory and category (other/non_ai to productivity/ai_assistant/productivity).
--   openclaw's listing fields are also corrected (website, pricing, licence), each guarded: a field
--   is written only when it holds the known wrong value or already holds the target, else this
--   file raises. Sources are recorded in data.info_provenance: https://openclaw.ai/ (free, no
--   paid version, MIT) and https://github.com/openclaw/openclaw/blob/main/LICENSE (MIT).
--   The description is left as it is. openclaw's two retired alias
--   rows, clawdbot and moltbot, change kind only, because the kind sheet holds a retired row at its
--   survivor's kind; they are redirect rows and sit on no board. Status, scores, metrics and
--   every other column stay as they are.
--   chatgpt-canvas, claude-desktop-extensions and cowork (Dd1 reclassification; D8c for
--   claude-desktop-extensions) change kind only, harness to productivity; their subcategory,
--   category and status stay. cowork's retired alias cowork-ai follows cowork, as clawdbot and
--   moltbot follow openclaw.
--   APPLY WITH ACTIVATION, AFTER 2026-11-01, not with 0027: a kind change removes these rows
--   from the harness board at the next publish.
--   Perplexity's tool page stays noindex: its signed noindex row in the URL table is a separate
--   ruling and this file does not touch it.
--   One DO block: a guard failure raises and writes nothing. The UPDATEs skip rows already in the
--   target state, so a re-run writes nothing and leaves updated_at alone.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0028_convert_productivity_existing_rows.sql, show_columns_table tools.

DO $p314b$
DECLARE
  info jsonb;
  biz jsonb;
  lic_paths text[] := ARRAY['{info,business,license_type}', '{info,license_type}'];
  lic_path text;
  lic_found boolean := false;
  v text;
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
    RAISE EXCEPTION '#314 0028: tools.kind is missing; apply 0016 first';
  END IF;

  -- #314: guard — exactly one Claude.AI row may exist, and it is claude-artifacts.
  SELECT string_agg(format('%s (name %s)', slug, name), ', ' ORDER BY slug) INTO clash
    FROM public."tools"
   WHERE slug <> 'claude-artifacts' AND (slug = 'claude-ai' OR lower(name) = 'claude.ai');
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION '#314 0028: another Claude.AI row exists: %', clash;
  END IF;

  -- #314: guard — each row exists and is in its old state or already converted.
  SELECT kind INTO state FROM public."tools" WHERE slug = 'claude-artifacts';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0028: claude-artifacts has no tools row';
  ELSIF state NOT IN ('harness', 'productivity') THEN
    RAISE EXCEPTION '#314 0028: claude-artifacts has kind %, expected harness or productivity', state;
  END IF;
  SELECT kind INTO state FROM public."tools" WHERE slug = 'openclaw';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0028: openclaw has no tools row';
  ELSIF state NOT IN ('harness', 'productivity') THEN
    RAISE EXCEPTION '#314 0028: openclaw has kind %, expected harness or productivity', state;
  END IF;
  SELECT kind INTO state FROM public."tools" WHERE slug = 'perplexity';
  IF state IS NULL THEN
    RAISE EXCEPTION '#314 0028: perplexity has no tools row';
  ELSIF state NOT IN ('other', 'productivity') THEN
    RAISE EXCEPTION '#314 0028: perplexity has kind %, expected other or productivity', state;
  END IF;
  -- #314: guard — the three Dd1 harnesses exist and are harness or already productivity.
  FOREACH v IN ARRAY ARRAY['chatgpt-canvas', 'claude-desktop-extensions', 'cowork'] LOOP
    SELECT kind INTO state FROM public."tools" WHERE slug = v;
    IF state IS NULL THEN
      RAISE EXCEPTION '#314 0028: % has no tools row', v;
    ELSIF state NOT IN ('harness', 'productivity') THEN
      RAISE EXCEPTION '#314 0028: % has kind %, expected harness or productivity', v, state;
    END IF;
  END LOOP;

  -- #314: guard — openclaw's listing fields hold the known wrong value or already the target.
  SELECT data->'info' INTO info FROM public."tools" WHERE slug = 'openclaw';
  biz := info->'business';
  v := info->>'website';
  IF v IS NULL OR v NOT IN ('https://openclaw.dev', 'https://openclaw.ai') THEN
    RAISE EXCEPTION '#314 0028: openclaw data.info.website is %, expected https://openclaw.dev or https://openclaw.ai', v;
  END IF;
  v := biz->>'pricing_model';
  IF v IS NULL OR v NOT IN ('subscription', 'free') THEN
    RAISE EXCEPTION '#314 0028: openclaw business.pricing_model is %, expected subscription or free', v;
  END IF;
  v := biz->>'free_tier';
  IF v IS NULL OR v NOT IN ('false', 'true') THEN
    RAISE EXCEPTION '#314 0028: openclaw business.free_tier is %, expected false or true', v;
  END IF;
  -- The licence sits under info.business in the dashboard reader and under info in the API reader;
  -- every path the row carries is checked and written, and at least one must exist.
  FOREACH lic_path IN ARRAY lic_paths LOOP
    v := (SELECT data #>> lic_path::text[] FROM public."tools" WHERE slug = 'openclaw');
    IF v IS NOT NULL THEN
      lic_found := true;
      IF v NOT IN ('proprietary', 'MIT') THEN
        RAISE EXCEPTION '#314 0028: openclaw % is %, expected proprietary or MIT', lic_path, v;
      END IF;
    END IF;
  END LOOP;
  IF NOT lic_found THEN
    RAISE EXCEPTION '#314 0028: openclaw has no license_type under data.info or data.info.business';
  END IF;

  -- #314: guard — a row that stops being a harness must not be the harness side of a link
  -- (tool_links.harness_tool_id rows must point at kind harness; see TOOL_LINK_KIND_VIOLATIONS_SQL).
  IF to_regclass('public.tool_links') IS NOT NULL THEN
    SELECT string_agg(t.slug, ', ' ORDER BY t.slug) INTO clash
      FROM public."tool_links" l JOIN public."tools" t ON t.id = l.harness_tool_id
     WHERE t.slug IN ('claude-artifacts', 'openclaw', 'clawdbot', 'moltbot',
                      'chatgpt-canvas', 'claude-desktop-extensions', 'cowork', 'cowork-ai')
       AND t.kind = 'harness';
    IF clash IS NOT NULL THEN
      RAISE EXCEPTION '#314 0028: tool_links still use these rows as a harness: %', clash;
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

  -- #314: openclaw's kind changes here; its listing fields are corrected above.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug = 'openclaw' AND kind IS DISTINCT FROM 'productivity';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: openclaw's listing fields, cited to the vendor page and its LICENSE file. A re-run finds
  -- every value at its target and writes nothing.
  UPDATE public."tools"
     SET data = jsonb_set(jsonb_set(jsonb_set(jsonb_set(data,
           '{info,website}', '"https://openclaw.ai"'::jsonb),
           '{info,business,pricing_model}', '"free"'::jsonb),
           '{info,business,free_tier}', 'true'::jsonb),
           '{info_provenance}', coalesce(data->'info_provenance', '{}'::jsonb) || jsonb_build_object(
             'website', jsonb_build_object('source', 'https://openclaw.ai/', 'as_of', '2026-10-27'),
             'pricing_model', jsonb_build_object('source', 'https://openclaw.ai/', 'as_of', '2026-10-27'),
             'free_tier', jsonb_build_object('source', 'https://openclaw.ai/', 'as_of', '2026-10-27'),
             'license_type', jsonb_build_object('source', 'https://github.com/openclaw/openclaw/blob/main/LICENSE', 'as_of', '2026-10-27'))),
         updated_at = now()
   WHERE slug = 'openclaw'
     AND (data #>> '{info,website}' IS DISTINCT FROM 'https://openclaw.ai'
          OR data #>> '{info,business,pricing_model}' IS DISTINCT FROM 'free'
          OR data #>> '{info,business,free_tier}' IS DISTINCT FROM 'true');
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;
  FOREACH lic_path IN ARRAY lic_paths LOOP
    UPDATE public."tools"
       SET data = jsonb_set(data, lic_path::text[], '"MIT"'::jsonb), updated_at = now()
     WHERE slug = 'openclaw' AND data #>> lic_path::text[] IS NOT NULL AND data #>> lic_path::text[] <> 'MIT';
    GET DIAGNOSTICS n = ROW_COUNT;
    changed := changed + n;
  END LOOP;

  -- #314: openclaw's retired aliases follow it; a missing alias row is not an error.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug IN ('clawdbot', 'moltbot') AND kind = 'harness';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: perplexity changes kind, subcategory and category; status and data stay.
  UPDATE public."tools"
     SET kind = 'productivity', subcategory = 'ai_assistant', category = 'productivity', updated_at = now()
   WHERE slug = 'perplexity'
     AND (kind IS DISTINCT FROM 'productivity' OR subcategory IS DISTINCT FROM 'ai_assistant'
          OR category IS DISTINCT FROM 'productivity');
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314 (Dd1, D8c): chatgpt-canvas, claude-desktop-extensions and cowork change kind only.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug IN ('chatgpt-canvas', 'claude-desktop-extensions', 'cowork') AND kind IS DISTINCT FROM 'productivity';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: cowork's retired alias follows it; a missing alias row is not an error.
  UPDATE public."tools"
     SET kind = 'productivity', updated_at = now()
   WHERE slug = 'cowork-ai' AND kind = 'harness';
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;

  -- #314: post-check — all six rows are productivity and claude-artifacts is named Claude.AI.
  SELECT count(*)::int INTO n
    FROM public."tools"
   WHERE slug IN ('claude-artifacts', 'openclaw', 'perplexity', 'chatgpt-canvas', 'claude-desktop-extensions', 'cowork')
     AND kind = 'productivity';
  IF n <> 6 THEN
    RAISE EXCEPTION '#314 0028: % of 6 rows are productivity after the update', n;
  END IF;
  -- #314: post-check — an alias row that exists must be productivity; a missing one is allowed.
  SELECT string_agg(format('%s (kind %s)', slug, kind), ', ' ORDER BY slug) INTO clash
    FROM public."tools"
   WHERE slug IN ('clawdbot', 'moltbot', 'cowork-ai') AND kind IS DISTINCT FROM 'productivity';
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION '#314 0028: retired aliases are not productivity after the update: %', clash;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."tools" WHERE slug = 'claude-artifacts' AND name = 'Claude.AI') THEN
    RAISE EXCEPTION '#314 0028: claude-artifacts is not named Claude.AI after the update';
  END IF;
  RAISE NOTICE '#314 0028: updated % rows', changed;
END
$p314b$;
--> statement-breakpoint
