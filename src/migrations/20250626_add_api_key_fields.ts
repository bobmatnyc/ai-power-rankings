import { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
// @ts-expect-error - drizzle-orm is a dependency of @payloadcms/db-postgres
import { sql } from "drizzle-orm";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Add API key fields to users table
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.users 
    ADD COLUMN IF NOT EXISTS enable_api_key boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS api_key text,
    ADD COLUMN IF NOT EXISTS api_key_index text
  `);

  // Create index for API key lookups
  await payload.db.drizzle.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_api_key_index 
    ON payload.users(api_key_index) 
    WHERE api_key_index IS NOT NULL
  `);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Drop the index first
  await payload.db.drizzle.execute(sql`
    DROP INDEX IF EXISTS payload.idx_users_api_key_index
  `);

  // Remove the columns
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.users 
    DROP COLUMN IF EXISTS enable_api_key,
    DROP COLUMN IF EXISTS api_key,
    DROP COLUMN IF EXISTS api_key_index
  `);
}
