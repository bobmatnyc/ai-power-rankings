-- Migration: Create the weekly digest table
-- Created: 2026-10-27
-- Description: #181 (M2-3) — the weekly-digest cron route writes one row per closed
--   ISO week, keyed "YYYY-Www" (unique), holding the digest markdown, the week's
--   window, a hash of its input ids and generation metadata. It is a new table, not a
--   kind of monthly_summaries row: a "W" key sorts after every "YYYY-MM" period and
--   would be read as the latest monthly report. Nothing existing is touched.
--   Numbered 0025 because 0022-0024 are reserved by open pull requests.
--   Every statement is guarded with IF NOT EXISTS, so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0025_create_weekly_digests.sql, show_columns_table weekly_digests.

-- #181: apply this before the deploy that ships the weekly digest; the /whats-new
-- list and the sitemap read the table.
CREATE TABLE IF NOT EXISTS "weekly_digests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "week" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "window_end" timestamptz NOT NULL,
  "content" text NOT NULL,
  "data_hash" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "generated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_digests_week_idx"
ON "weekly_digests" ("week");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "weekly_digests_generated_at_idx"
ON "weekly_digests" ("generated_at");
--> statement-breakpoint
