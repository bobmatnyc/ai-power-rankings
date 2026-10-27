-- Migration: Create the nine new productivity-board rows
-- Created: 2026-10-27
-- Description: #314 (ruling Dd1) — the nine new rows of the productivity board, from the reviewed
--   seed docs/refresh/productivity-tools.json. Additive only: nine INSERTs, ON CONFLICT (slug) DO
--   NOTHING, so a re-run writes nothing. The rows are created with status 'inactive', so the ranking
--   generator, /api/tools, the sitemap and the What's New new-tools summary (all filter on
--   status = 'active') do not list them, and the tool page marks them noindex. kind is named explicitly: the column default is 'harness'. No score,
--   metric or rank is written; metrics are a later reviewed step. company_id is NULL, as on the
--   model rows of 0018. The three existing rows (claude-artifacts, openclaw, perplexity) change in
--   0023, which is applied with activation, after 2026-11-01, not with this file.
--   One DO block: the precondition guard and the post-count check raise and write nothing.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0022_create_productivity_rows.sql, show_columns_table tools.

DO $p314a$
DECLARE
  clash text;
  inserted integer;
  found integer;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- #314: precondition — 0016 is applied (tools.kind exists).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tools' AND column_name = 'kind'
  ) THEN
    RAISE EXCEPTION '#314 0022: tools.kind is missing; apply 0016 first';
  END IF;
  -- #314: precondition — a slug already taken by a row of another kind is not ours to reuse.
  SELECT string_agg(format('%s (kind %s)', slug, kind), ', ' ORDER BY slug) INTO clash
    FROM public."tools"
   WHERE slug IN ('chatgpt', 'gemini-app', 'genspark', 'grok-app', 'hermes-agent', 'manus', 'microsoft-copilot', 'mistral-vibe', 'notion-ai') AND kind <> 'productivity';
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION '#314 0022: productivity slugs exist with another kind: %', clash;
  END IF;

  INSERT INTO public."tools" (slug, name, category, subcategory, status, kind, company_id, data)
  VALUES
    ('chatgpt', 'ChatGPT', 'productivity', 'ai_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://apps.apple.com/us/app/chatgpt/id6448311069", "info": {"website": "https://chatgpt.com", "description": "OpenAI''s assistant app for chat, research, files and agent tasks.", "company": "OpenAI"}}'::jsonb),
    ('gemini-app', 'Gemini', 'productivity', 'ai_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://gemini.google/overview/", "info": {"website": "https://gemini.google.com", "description": "Google''s Gemini assistant app on web, Android and iOS.", "company": "Google"}}'::jsonb),
    ('hermes-agent', 'Hermes Agent', 'productivity', 'autonomous_agent', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://hermes-agent.nousresearch.com/", "info": {"website": "https://hermes-agent.nousresearch.com", "description": "Open-source, MIT-licensed agent with persistent memory, scheduled tasks and subagents, reachable from CLI and chat apps.", "company": "Nous Research"}}'::jsonb),
    ('microsoft-copilot', 'Microsoft Copilot', 'productivity', 'ai_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://www.microsoft.com/en-us/microsoft-copilot/for-individuals", "info": {"website": "https://copilot.microsoft.com", "description": "Microsoft''s consumer Copilot assistant, bundled into Microsoft 365 Personal, Family and Premium.", "company": "Microsoft"}}'::jsonb),
    ('manus', 'Manus', 'productivity', 'autonomous_agent', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://manus.im/", "info": {"website": "https://manus.im", "description": "General-purpose AI agent that builds slides, websites, games and designs from one prompt.", "company": "Manus AI"}}'::jsonb),
    ('genspark', 'Genspark', 'productivity', 'autonomous_agent', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://www.genspark.ai/helpcenter/super-app", "info": {"website": "https://www.genspark.ai", "description": "AI workspace whose Super Agent runs tasks in a cloud sandbox and makes slides, sheets and docs.", "company": "Genspark Inc"}}'::jsonb),
    ('mistral-vibe', 'Mistral Vibe', 'productivity', 'ai_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://mistral.ai/news/vibe-agent/", "info": {"website": "https://chat.mistral.ai", "description": "Mistral''s unified agent for work and coding (the former Le Chat), with long-running tasks and connectors.", "company": "Mistral AI"}}'::jsonb),
    ('notion-ai', 'Notion AI', 'productivity', 'workspace_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://www.notion.com/product/ai", "info": {"website": "https://www.notion.com/product/ai", "description": "Notion''s built-in AI teammate that works across pages, docs, tasks and databases.", "company": "Notion Labs"}}'::jsonb),
    ('grok-app', 'Grok', 'productivity', 'ai_assistant', 'inactive', 'productivity', NULL,
     '{"createdBy": "migration 0022_create_productivity_rows", "ruling": "Dd1", "source": "#314", "source_url": "https://apps.apple.com/app/grok/id6670324846", "info": {"website": "https://grok.com", "description": "xAI''s Grok assistant app (separate row from the grok model family).", "company": "xAI"}}'::jsonb)
  ON CONFLICT (slug) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  -- #314: post-count — exactly nine productivity rows from this seed (any status on a re-run).
  SELECT count(*)::int INTO found
    FROM public."tools"
   WHERE slug IN ('chatgpt', 'gemini-app', 'genspark', 'grok-app', 'hermes-agent', 'manus', 'microsoft-copilot', 'mistral-vibe', 'notion-ai') AND kind = 'productivity';
  IF found <> 9 THEN
    RAISE EXCEPTION '#314 0022: % productivity rows after the insert, expected 9', found;
  END IF;
  RAISE NOTICE '#314 0022: inserted % productivity rows', inserted;
END
$p314a$;
--> statement-breakpoint
