import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Add is_current column to rankings table
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings ADD COLUMN IF NOT EXISTS "is_current" BOOLEAN DEFAULT false`
  );

  // Add index on is_current column for performance
  await payload.db.drizzle.execute(
    sql`CREATE INDEX IF NOT EXISTS "rankings_is_current_idx" ON rankings ("is_current")`
  );

  // Log the migration
  payload.logger.info("Added is_current field to rankings collection");
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Drop the index first
  await payload.db.drizzle.execute(
    sql`DROP INDEX IF EXISTS "rankings_is_current_idx"`
  );

  // Remove is_current column from rankings table
  await payload.db.drizzle.execute(
    sql`ALTER TABLE rankings DROP COLUMN IF EXISTS "is_current"`
  );

  payload.logger.info("Removed is_current field from rankings collection");
}