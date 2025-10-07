#!/usr/bin/env node

/**
 * Script to apply pending migrations to the database
 * Applies migrations in order from the migrations directory
 */

import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/connection";
import fs from "fs";
import path from "path";

async function applyMigrations() {
  try {
    console.log("🚀 Starting migration application...");

    // Initialize database connection
    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }
    console.log("✅ Database connected");

    // Get list of migration files
    const migrationsDir = path.join(process.cwd(), "lib/db/migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`\n📋 Found ${migrationFiles.length} migration files`);

    // Create migrations tracking table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);

    // Get applied migrations
    const appliedMigrations = await db.execute(sql`
      SELECT hash FROM _drizzle_migrations;
    `);

    const appliedHashes = new Set(
      appliedMigrations.rows.map((row: any) => row.hash)
    );

    console.log(`✓ ${appliedHashes.size} migrations already applied\n`);

    // Apply pending migrations
    let appliedCount = 0;
    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(migrationPath, "utf-8");

      // Use filename as hash for simplicity
      const hash = file;

      if (appliedHashes.has(hash)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`🔧 Applying ${file}...`);

      try {
        // Split by statement breakpoint and execute each statement
        const statements = migrationSql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));

        for (const statement of statements) {
          if (statement.trim()) {
            await db.execute(sql.raw(statement));
          }
        }

        // Record migration as applied
        await db.execute(sql`
          INSERT INTO _drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${Date.now()});
        `);

        console.log(`✅ Successfully applied ${file}`);
        appliedCount++;
      } catch (error) {
        console.error(`❌ Error applying ${file}:`, error);
        throw error;
      }
    }

    console.log(`\n✨ Migration application completed!`);
    console.log(`   Applied: ${appliedCount} new migrations`);
    console.log(`   Total: ${appliedHashes.size + appliedCount} migrations`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// Run if called directly
if (require.main === module) {
  applyMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { applyMigrations };
