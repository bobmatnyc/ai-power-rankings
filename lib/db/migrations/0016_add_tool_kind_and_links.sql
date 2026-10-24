-- Migration: Add the tool kind, the model fields and the tool_links table
-- Created: 2026-10-24
-- Description: #183 (slice B-1) — every tools row gets a kind (model, harness,
--   productivity, other), an optional subcategory and, for models, an open-weight
--   flag and a few sortable model fields. tool_links pairs a model with a harness
--   (D29). The model vendor is the existing tools.company_id; no vendor column.
--   Additive only: no DROP, no type change, no row rewrite. The new columns are
--   nullable or carry a constant default, so Postgres adds them without rewriting
--   tools. kind defaults to 'harness' on every existing row; the reviewed per-slug
--   kinds are a separate data step (0017), never part of this file.
--   The kind rule on tool_links (model side kind='model', harness side not a
--   model) is not a constraint here: no trigger (Q-A5). The writer checks it and
--   TOOL_LINK_KIND_VIOLATIONS_SQL (lib/db/tool-links.ts) finds violating rows.
--   Every statement is guarded (IF NOT EXISTS, or a pg_constraint lookup inside a
--   DO block with a lock_timeout), so a re-run is a no-op.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0016_add_tool_kind_and_links.sql, show_columns_table tools.

-- #183: the eleven tools columns, in one ALTER so the table is locked once.
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  ALTER TABLE public."tools"
    ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'harness' NOT NULL,
    ADD COLUMN IF NOT EXISTS "subcategory" text,
    ADD COLUMN IF NOT EXISTS "open_weight" boolean,
    ADD COLUMN IF NOT EXISTS "licence" text,
    ADD COLUMN IF NOT EXISTS "parameters_b" numeric,
    ADD COLUMN IF NOT EXISTS "active_parameters_b" numeric,
    ADD COLUMN IF NOT EXISTS "context_window" integer,
    ADD COLUMN IF NOT EXISTS "price_in_per_mtok" numeric,
    ADD COLUMN IF NOT EXISTS "price_out_per_mtok" numeric,
    ADD COLUMN IF NOT EXISTS "release_date" date,
    ADD COLUMN IF NOT EXISTS "hf_repo" text;
END
$k183$;
--> statement-breakpoint

-- #183: kind is one of four values.
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tools_kind_check' AND conrelid = 'public.tools'::regclass
  ) THEN
    ALTER TABLE public."tools" ADD CONSTRAINT "tools_kind_check"
      CHECK (kind IN ('model', 'harness', 'productivity', 'other'));
  END IF;
END
$k183$;
--> statement-breakpoint

-- #183: subcategory is a lower-case underscore slug (Q-A4), e.g. app_builder.
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tools_subcategory_check' AND conrelid = 'public.tools'::regclass
  ) THEN
    ALTER TABLE public."tools" ADD CONSTRAINT "tools_subcategory_check"
      CHECK (subcategory ~ '^[a-z0-9_]+$');
  END IF;
END
$k183$;
--> statement-breakpoint

-- #183: only a model can carry an open-weight flag (criterion 5).
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tools_open_weight_check' AND conrelid = 'public.tools'::regclass
  ) THEN
    ALTER TABLE public."tools" ADD CONSTRAINT "tools_open_weight_check"
      CHECK (open_weight IS NULL OR kind = 'model');
  END IF;
END
$k183$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tools_kind_idx"
ON "tools" ("kind");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tools_kind_subcategory_idx"
ON "tools" ("kind", "subcategory");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tools_open_weight_idx"
ON "tools" ("open_weight") WHERE kind = 'model';
--> statement-breakpoint

-- #183 (D29): model-harness links. Timestamps are born timestamptz (#237).
CREATE TABLE IF NOT EXISTS "tool_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_tool_id" uuid NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
  "harness_tool_id" uuid NOT NULL REFERENCES "tools"("id") ON DELETE CASCADE,
  "relation" text NOT NULL,
  "source_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- #183: native (the vendor's own harness) or supports (a third-party harness).
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tool_links_relation_check' AND conrelid = 'public.tool_links'::regclass
  ) THEN
    ALTER TABLE public."tool_links" ADD CONSTRAINT "tool_links_relation_check"
      CHECK (relation IN ('native', 'supports'));
  END IF;
END
$k183$;
--> statement-breakpoint

-- #183: a tool never links to itself.
DO $k183$
BEGIN
  SET LOCAL lock_timeout = '5s';
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tool_links_no_self_link_check' AND conrelid = 'public.tool_links'::regclass
  ) THEN
    ALTER TABLE public."tool_links" ADD CONSTRAINT "tool_links_no_self_link_check"
      CHECK (model_tool_id <> harness_tool_id);
  END IF;
END
$k183$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "tool_links_model_harness_idx"
ON "tool_links" ("model_tool_id", "harness_tool_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tool_links_harness_idx"
ON "tool_links" ("harness_tool_id");
--> statement-breakpoint
