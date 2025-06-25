import { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
import { sql } from "drizzle-orm";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.rankings 
    ADD COLUMN IF NOT EXISTS tool_display text;
  `);

  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.metrics 
    ADD COLUMN IF NOT EXISTS tool_display text;
  `);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.rankings 
    DROP COLUMN IF EXISTS tool_display;
  `);

  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload.metrics 
    DROP COLUMN IF EXISTS tool_display;
  `);
}
