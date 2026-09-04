-- Migration: Add stale-skip counter and per-candidate outcome tracking
-- Created: 2026-09-03
-- Description: #132 — persist the articles_skipped_stale count (computed every
--   run since the freshness gate landed, but never mapped into a column and so
--   silently dropped) and a capped per-candidate outcome list, so a run that
--   discovered a fresh candidate and failed to insert it can be told apart from
--   a run where no fresh candidate existed.

-- Add articles_skipped_stale column to automated_ingestion_runs table
ALTER TABLE "automated_ingestion_runs"
ADD COLUMN IF NOT EXISTS "articles_skipped_stale" integer DEFAULT 0;
--> statement-breakpoint

-- Add candidate_outcomes column to automated_ingestion_runs table
ALTER TABLE "automated_ingestion_runs"
ADD COLUMN IF NOT EXISTS "candidate_outcomes" jsonb DEFAULT '[]';
--> statement-breakpoint
