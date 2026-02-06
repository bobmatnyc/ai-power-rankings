-- Migration: Add semantic duplicate tracking
-- Created: 2025-02-06
-- Description: Track semantic duplicates separately from URL duplicates in automated ingestion runs

-- Add articles_skipped_semantic column to automated_ingestion_runs table
ALTER TABLE "automated_ingestion_runs"
ADD COLUMN IF NOT EXISTS "articles_skipped_semantic" integer DEFAULT 0;
--> statement-breakpoint
