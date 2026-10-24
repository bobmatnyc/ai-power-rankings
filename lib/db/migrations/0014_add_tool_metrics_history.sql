-- Migration: Add the private monthly metrics history and its collection ledger
-- Created: 2026-10-24
-- Description: #95 slice 1 — the collect-metrics cron route writes one row per
--   tool per collection day into tool_metrics_history (each collector owns one
--   top-level key of `metrics`, merged with `||`), and one row per collector shard
--   per day into metrics_collection_runs. The data is kept forever and is private:
--   no page or public API reads it. Nothing here touches the tools table.
--   Every statement is guarded with IF NOT EXISTS, so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0014_add_tool_metrics_history.sql, show_columns_table tool_metrics_history.

CREATE TABLE IF NOT EXISTS "tool_metrics_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tool_id" uuid REFERENCES "tools"("id") ON DELETE SET NULL,
  "tool_slug" text NOT NULL,
  "collected_date" date NOT NULL,
  "period" text NOT NULL,
  "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "tool_metrics_history_tool_date_idx"
ON "tool_metrics_history" ("tool_id", "collected_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tool_metrics_history_period_idx"
ON "tool_metrics_history" ("period");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tool_metrics_history_metrics_gin_idx"
ON "tool_metrics_history" USING gin ("metrics");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "metrics_collection_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collected_date" date NOT NULL,
  "period" text NOT NULL,
  "collector" text NOT NULL,
  "shard" integer NOT NULL,
  "shard_count" integer NOT NULL,
  "status" text NOT NULL,
  "attempted" integer DEFAULT 0 NOT NULL,
  "recorded" integer DEFAULT 0 NOT NULL,
  "flagged" integer DEFAULT 0 NOT NULL,
  "not_found" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "skipped_timeout" integer DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamp NOT NULL,
  "finished_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "metrics_collection_runs_date_collector_shard_idx"
ON "metrics_collection_runs" ("collected_date", "collector", "shard");
--> statement-breakpoint
