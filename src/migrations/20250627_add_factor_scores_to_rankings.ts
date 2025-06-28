import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Add factor score columns to rankings table
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings 
      ADD COLUMN IF NOT EXISTS "agentic_capability" NUMERIC,
      ADD COLUMN IF NOT EXISTS "innovation" NUMERIC,
      ADD COLUMN IF NOT EXISTS "technical_performance" NUMERIC,
      ADD COLUMN IF NOT EXISTS "developer_adoption" NUMERIC,
      ADD COLUMN IF NOT EXISTS "market_traction" NUMERIC,
      ADD COLUMN IF NOT EXISTS "business_sentiment" NUMERIC,
      ADD COLUMN IF NOT EXISTS "development_velocity" NUMERIC,
      ADD COLUMN IF NOT EXISTS "platform_resilience" NUMERIC`
  );

  // Add additional metadata columns
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings
      ADD COLUMN IF NOT EXISTS "tool_id" VARCHAR,
      ADD COLUMN IF NOT EXISTS "tool_name" VARCHAR,
      ADD COLUMN IF NOT EXISTS "position_change" INTEGER,
      ADD COLUMN IF NOT EXISTS "score_change" NUMERIC,
      ADD COLUMN IF NOT EXISTS "tier" VARCHAR,
      ADD COLUMN IF NOT EXISTS "preview_date" VARCHAR,
      ADD COLUMN IF NOT EXISTS "primary_reason" TEXT,
      ADD COLUMN IF NOT EXISTS "narrative_explanation" TEXT`
  );

  // Log the migration
  payload.logger.info("Added factor score fields to rankings collection");
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Remove factor score columns from rankings table
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings 
      DROP COLUMN IF EXISTS "agentic_capability",
      DROP COLUMN IF EXISTS "innovation",
      DROP COLUMN IF EXISTS "technical_performance",
      DROP COLUMN IF EXISTS "developer_adoption",
      DROP COLUMN IF EXISTS "market_traction",
      DROP COLUMN IF EXISTS "business_sentiment",
      DROP COLUMN IF EXISTS "development_velocity",
      DROP COLUMN IF EXISTS "platform_resilience"`
  );

  // Remove additional metadata columns
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings
      DROP COLUMN IF EXISTS "tool_id",
      DROP COLUMN IF EXISTS "tool_name",
      DROP COLUMN IF EXISTS "position_change",
      DROP COLUMN IF EXISTS "score_change",
      DROP COLUMN IF EXISTS "tier",
      DROP COLUMN IF EXISTS "preview_date",
      DROP COLUMN IF EXISTS "primary_reason",
      DROP COLUMN IF EXISTS "narrative_explanation"`
  );

  payload.logger.info("Removed factor score fields from rankings collection");
}
