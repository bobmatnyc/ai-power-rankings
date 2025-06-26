import { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/drizzle";

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Add API key fields to users table
  await db.execute(sql`
    ALTER TABLE payload.users 
    ADD COLUMN IF NOT EXISTS enable_api_key boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS api_key text,
    ADD COLUMN IF NOT EXISTS api_key_index text
  `);

  // Create index for API key lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_api_key_index 
    ON payload.users(api_key_index) 
    WHERE api_key_index IS NOT NULL
  `);
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Drop the index first
  await db.execute(sql`
    DROP INDEX IF EXISTS payload.idx_users_api_key_index
  `);

  // Remove the columns
  await db.execute(sql`
    ALTER TABLE payload.users 
    DROP COLUMN IF EXISTS enable_api_key,
    DROP COLUMN IF EXISTS api_key,
    DROP COLUMN IF EXISTS api_key_index
  `);
}
