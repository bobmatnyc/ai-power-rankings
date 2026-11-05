-- Migration: Drop the orphaned articles.content_markdown column
-- Created: 2026-11-05
-- Description: #115, owner ruling D6f — "Drop it: back up (id, content_markdown), plain
--   DROP COLUMN, no CASCADE, verify." Production carries articles.content_markdown, which
--   no migration in this repository creates and the drizzle schema never declared. Its
--   244 non-null rows were backed up outside the repository before this file was written.
--   No CASCADE: if any view or other object depends on the column, the drop fails and
--   nothing changes. DROP COLUMN IF EXISTS makes a re-run, or a database that never had
--   the column, a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0032_drop_articles_content_markdown.sql, show_columns_table articles.

-- #115 (D6f): plain drop, no CASCADE.
ALTER TABLE public.articles DROP COLUMN IF EXISTS content_markdown;
--> statement-breakpoint
