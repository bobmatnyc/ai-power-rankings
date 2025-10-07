#!/usr/bin/env node

/**
 * Script to create ranking_versions table and required enums
 * Manually applies migration 0004 if tables don't exist
 */

import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/connection";

async function createRankingVersionsTable() {
  try {
    console.log("🚀 Starting ranking_versions table creation...");

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }
    console.log("✅ Database connected");

    // Check if ranking_versions table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ranking_versions'
      );
    `);

    const tableExists = tableCheck.rows[0]?.exists;

    if (tableExists) {
      console.log("✓ ranking_versions table already exists, skipping creation");
      return;
    }

    console.log("📝 Creating enums and ranking_versions table...");

    // Create enums (ignore if they already exist)
    const enums = [
      `CREATE TYPE "public"."change_type" AS ENUM('increase', 'decrease', 'new_entry', 'no_change')`,
      `CREATE TYPE "public"."ingestion_type" AS ENUM('url', 'text', 'file')`,
      `CREATE TYPE "public"."processing_action" AS ENUM('dry_run', 'ingest', 'update', 'recalculate', 'delete', 'rollback')`,
      `CREATE TYPE "public"."processing_status" AS ENUM('started', 'completed', 'failed')`,
    ];

    for (const enumSql of enums) {
      try {
        await db.execute(sql.raw(enumSql));
        console.log(`✓ Created enum`);
      } catch (error: any) {
        if (error.code === '42710') {
          console.log(`✓ Enum already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    // Create ranking_versions table
    await db.execute(sql`
      CREATE TABLE "ranking_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "version" varchar(50) NOT NULL,
        "article_id" uuid,
        "rankings_snapshot" jsonb NOT NULL,
        "changes_summary" text,
        "news_items_count" integer DEFAULT 0,
        "tools_affected" integer DEFAULT 0,
        "previous_version_id" uuid,
        "created_by" varchar(255) DEFAULT 'system',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "is_rollback" boolean DEFAULT false,
        "rolled_back_from_id" uuid,
        CONSTRAINT "ranking_versions_version_unique" UNIQUE("version")
      );
    `);

    console.log("✓ Created ranking_versions table");

    // Add foreign key constraint
    await db.execute(sql`
      ALTER TABLE "ranking_versions"
      ADD CONSTRAINT "ranking_versions_article_id_articles_id_fk"
      FOREIGN KEY ("article_id")
      REFERENCES "public"."articles"("id")
      ON DELETE set null
      ON UPDATE no action;
    `);

    console.log("✓ Added foreign key constraint");

    // Create indexes
    await db.execute(sql`
      CREATE UNIQUE INDEX "idx_ranking_versions_version" ON "ranking_versions" USING btree ("version");
    `);
    await db.execute(sql`
      CREATE INDEX "idx_ranking_versions_article_id" ON "ranking_versions" USING btree ("article_id");
    `);
    await db.execute(sql`
      CREATE INDEX "idx_ranking_versions_created_at" ON "ranking_versions" USING btree ("created_at");
    `);
    await db.execute(sql`
      CREATE INDEX "idx_ranking_versions_previous" ON "ranking_versions" USING btree ("previous_version_id");
    `);

    console.log("✓ Created indexes");

    console.log("\n✨ ranking_versions table created successfully!");
  } catch (error) {
    console.error("❌ Error creating ranking_versions table:", error);
    process.exit(1);
  } finally {
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// Run if called directly
if (require.main === module) {
  createRankingVersionsTable()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createRankingVersionsTable };
