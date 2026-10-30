-- Migration: Create the monthly report version table
-- Created: 2026-10-30
-- Description: #182 — one monthly report generator writes here, append-only:
--   each generation inserts the next version for its "YYYY-MM" period, and no
--   code path updates or deletes a row, so regenerating a month keeps every
--   prior version readable. monthly_summaries and state_of_ai_summaries become
--   read-only; this file does not touch them or any other table.
--   Numbered 0031 because 0030 is taken on main.
--   Every statement is guarded with IF NOT EXISTS, so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0031_create_monthly_report_versions.sql, show_columns_table
--   monthly_report_versions.

-- #182: apply this before the deploy that ships the merged generator; the
-- /whats-new pages, the sitemap and /api/state-of-ai/current read the table.
CREATE TABLE IF NOT EXISTS "monthly_report_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period" text NOT NULL,
  "version" integer NOT NULL,
  "content" text NOT NULL,
  "data_hash" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "generated_by" text NOT NULL,
  "generated_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_report_versions_period_version_idx"
ON "monthly_report_versions" ("period", "version");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "monthly_report_versions_generated_at_idx"
ON "monthly_report_versions" ("generated_at");
--> statement-breakpoint
