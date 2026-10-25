-- Migration: Create the four model family rows (glm, kimi, claude-opus, claude-sonnet)
-- Created: 2026-10-25
-- Description: D91 (#197) — the family entities that the per-version model rows fold
--   into (0019). Additive only: four INSERTs, ON CONFLICT (slug) DO NOTHING, so a re-run
--   writes nothing. The rows are created with status 'inactive', so the ranking generator,
--   /api/tools and the sitemap (all status = 'active') do not list them, and the tool page
--   marks them noindex. kind is named explicitly: the column default is 'harness'.
--   category 'other' and company_id NULL match the existing model rows. open_weight comes
--   from docs/refresh/tool-kind-mapping.csv; licence from the same sheet's model-card notes.
--   One DO block: the precondition guard and the post-count check raise and write nothing.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0018_create_model_family_rows.sql, show_columns_table tools.

DO $d91c$
DECLARE
  clash text;
  inserted integer;
  found integer;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- D91: precondition — 0016 is applied (tools.kind exists).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tools' AND column_name = 'kind'
  ) THEN
    RAISE EXCEPTION 'D91 0018: tools.kind is missing; apply 0016 first';
  END IF;
  -- D91: precondition — a family slug already taken by a non-model row is not ours to reuse.
  SELECT string_agg(format('%s (kind %s)', slug, kind), ', ' ORDER BY slug) INTO clash
    FROM public."tools"
   WHERE slug IN ('claude-opus', 'claude-sonnet', 'glm', 'kimi') AND kind <> 'model';
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'D91 0018: family slugs exist with another kind: %', clash;
  END IF;

  INSERT INTO public."tools" (slug, name, category, status, kind, open_weight, licence, company_id, data)
  VALUES
    ('claude-opus', 'Claude Opus', 'other', 'inactive', 'model', false, NULL, NULL,
     '{"createdBy": "migration 0018_create_model_family_rows", "ruling": "D91", "source": "#197"}'::jsonb),
    ('claude-sonnet', 'Claude Sonnet', 'other', 'inactive', 'model', false, NULL, NULL,
     '{"createdBy": "migration 0018_create_model_family_rows", "ruling": "D91", "source": "#197"}'::jsonb),
    ('glm', 'GLM', 'other', 'inactive', 'model', true, 'mit', NULL,
     '{"createdBy": "migration 0018_create_model_family_rows", "ruling": "D91", "source": "#197"}'::jsonb),
    ('kimi', 'Kimi', 'other', 'inactive', 'model', true, 'modified-mit', NULL,
     '{"createdBy": "migration 0018_create_model_family_rows", "ruling": "D91", "source": "#197"}'::jsonb)
  ON CONFLICT (slug) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- D91: post-count — exactly four family rows, all kind model (any status on a re-run).
  SELECT count(*)::int INTO found
    FROM public."tools"
   WHERE slug IN ('claude-opus', 'claude-sonnet', 'glm', 'kimi') AND kind = 'model';
  IF found <> 4 THEN
    RAISE EXCEPTION 'D91 0018: % family rows of kind model after the insert, expected 4', found;
  END IF;
  RAISE NOTICE 'D91 0018: inserted % family rows', inserted;
END
$d91c$;
--> statement-breakpoint
