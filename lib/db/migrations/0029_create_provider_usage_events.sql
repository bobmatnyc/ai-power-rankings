-- Migration: Create the paid provider call ledger
-- Created: 2026-10-27
-- Description: #325 PR2 — one row per paid provider call, written by
--   lib/services/provider-usage.ts. OpenRouter calls are recorded first; other
--   providers follow in a later change. run_id links a call made inside an
--   automated ingestion run and becomes NULL if that run is deleted. No existing
--   table is changed and no older run is backfilled.
--   Numbered 0026 because 0022-0025 are taken on unmerged branches.
--   Every statement is guarded with IF NOT EXISTS, so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0026_create_provider_usage_events.sql, show_columns_table provider_usage_events.

CREATE TABLE IF NOT EXISTS "provider_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider" text NOT NULL,
  "operation" text NOT NULL,
  "model" text,
  "run_id" uuid REFERENCES "automated_ingestion_runs"("id") ON DELETE SET NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "units" numeric(14, 4),
  "reported_cost_usd" numeric(12, 6),
  "estimated_cost_usd" numeric(12, 6),
  "cost_is_estimated" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "provider_usage_events_created_at_idx"
ON "provider_usage_events" ("created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "provider_usage_events_provider_created_at_idx"
ON "provider_usage_events" ("provider", "created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "provider_usage_events_run_id_idx"
ON "provider_usage_events" ("run_id");
--> statement-breakpoint
