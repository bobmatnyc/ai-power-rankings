import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
// @ts-expect-error - drizzle-orm is a dependency of @payloadcms/db-postgres
import { sql } from 'drizzle-orm'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('Adding new fields to rankings table...')

  // Add all the new fields that are in the schema but missing from the database
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload"."rankings" 
    ADD COLUMN IF NOT EXISTS "agentic_capability" numeric,
    ADD COLUMN IF NOT EXISTS "innovation" numeric,
    ADD COLUMN IF NOT EXISTS "technical_performance" numeric,
    ADD COLUMN IF NOT EXISTS "developer_adoption" numeric,
    ADD COLUMN IF NOT EXISTS "market_traction" numeric,
    ADD COLUMN IF NOT EXISTS "business_sentiment" numeric,
    ADD COLUMN IF NOT EXISTS "development_velocity" numeric,
    ADD COLUMN IF NOT EXISTS "platform_resilience" numeric,
    ADD COLUMN IF NOT EXISTS "tool_id" text,
    ADD COLUMN IF NOT EXISTS "tool_name" text,
    ADD COLUMN IF NOT EXISTS "position_change" numeric,
    ADD COLUMN IF NOT EXISTS "score_change" numeric,
    ADD COLUMN IF NOT EXISTS "tier" text,
    ADD COLUMN IF NOT EXISTS "preview_date" text,
    ADD COLUMN IF NOT EXISTS "primary_reason" text,
    ADD COLUMN IF NOT EXISTS "narrative_explanation" text
  `)

  // Add indexes
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS "rankings_period_position_idx" ON "payload"."rankings" ("period", "position");
    CREATE INDEX IF NOT EXISTS "rankings_tool_period_idx" ON "payload"."rankings" ("tool", "period");
  `)

  console.log('Successfully added new fields to rankings table')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  console.log('Removing new fields from rankings table...')

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "payload"."rankings" 
    DROP COLUMN IF EXISTS "agentic_capability",
    DROP COLUMN IF EXISTS "innovation",
    DROP COLUMN IF EXISTS "technical_performance",
    DROP COLUMN IF EXISTS "developer_adoption",
    DROP COLUMN IF EXISTS "market_traction",
    DROP COLUMN IF EXISTS "business_sentiment",
    DROP COLUMN IF EXISTS "development_velocity",
    DROP COLUMN IF EXISTS "platform_resilience",
    DROP COLUMN IF EXISTS "tool_id",
    DROP COLUMN IF EXISTS "tool_name",
    DROP COLUMN IF EXISTS "position_change",
    DROP COLUMN IF EXISTS "score_change",
    DROP COLUMN IF EXISTS "tier",
    DROP COLUMN IF EXISTS "preview_date",
    DROP COLUMN IF EXISTS "primary_reason",
    DROP COLUMN IF EXISTS "narrative_explanation"
  `)

  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS "rankings_period_position_idx";
    DROP INDEX IF EXISTS "rankings_tool_period_idx";
  `)

  console.log('Successfully removed new fields from rankings table')
}