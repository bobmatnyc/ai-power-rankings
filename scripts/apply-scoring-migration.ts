/**
 * Apply scoring columns migration to tools table
 * Reads and executes the migration SQL file
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

async function applyMigration() {
  console.log("🚀 Starting scoring columns migration...\n");

  // Get database URL
  const DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  console.log("📍 Using database:", DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown");

  // Create SQL client
  const sql = neon(DATABASE_URL);

  try {
    // Read migration file
    const migrationPath = join(
      __dirname,
      "..",
      "lib",
      "db",
      "migrations",
      "0003_add_scoring_columns.sql"
    );
    console.log("📄 Reading migration file:", migrationPath);

    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Parse SQL statements - split by semicolon and filter out comments/breakpoints
    const allStatements = migrationSQL
      .split(";")
      .map((stmt) => {
        // Remove comments and breakpoints
        return stmt
          .split("\n")
          .filter((line) => {
            const trimmed = line.trim();
            return (
              trimmed.length > 0 &&
              !trimmed.startsWith("--") &&
              !trimmed.startsWith("-->")
            );
          })
          .join("\n")
          .trim();
      })
      .filter((stmt) => stmt.length > 0 && stmt.toLowerCase().includes("alter table"));

    console.log(`\n📝 Found ${allStatements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < allStatements.length; i++) {
      const statement = allStatements[i];

      console.log(`⚙️  Executing statement ${i + 1}/${allStatements.length}...`);
      const preview = statement.split("\n")[0].substring(0, 80);
      console.log(`   ${preview}${preview.length >= 80 ? "..." : ""}`);

      try {
        await sql(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (error) {
        // Check if error is because column already exists
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          console.log(
            `⚠️  Statement ${i + 1} skipped - column already exists\n`
          );
          continue;
        }
        throw error;
      }
    }

    // Verify columns were added
    console.log("\n🔍 Verifying columns were added...");
    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'tools'
        AND column_name IN ('baseline_score', 'delta_score', 'current_score', 'score_updated_at')
      ORDER BY column_name;
    `;

    if (result.length === 4) {
      console.log("\n✅ All scoring columns verified in database:");
      result.forEach((col: any) => {
        console.log(
          `   - ${col.column_name}: ${col.data_type}${col.column_default ? ` (default: ${col.column_default})` : ""}`
        );
      });
    } else {
      console.warn(
        `\n⚠️  Expected 4 columns, found ${result.length}. Migration may be incomplete.`
      );
      console.log("Found columns:", result);
    }

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run migration
applyMigration();
