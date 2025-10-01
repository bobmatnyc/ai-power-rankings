/**
 * Verify tools table schema includes scoring columns
 */

import { neon } from "@neondatabase/serverless";

async function verifySchema() {
  console.log("🔍 Verifying tools table schema...\n");

  const DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found");
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    // Get all columns from tools table
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_name = 'tools'
      ORDER BY ordinal_position;
    `;

    console.log(`📋 Tools table has ${columns.length} columns:\n`);

    // Highlight scoring columns
    const scoringColumns = ["baseline_score", "delta_score", "current_score", "score_updated_at"];

    columns.forEach((col: any) => {
      const isScoring = scoringColumns.includes(col.column_name);
      const marker = isScoring ? "🎯" : "  ";
      const nullable = col.is_nullable === "YES" ? "nullable" : "not null";
      const defaultVal = col.column_default ? ` default: ${col.column_default}` : "";

      console.log(
        `${marker} ${col.ordinal_position.toString().padStart(2, " ")}. ${col.column_name.padEnd(20)} ${col.data_type.padEnd(25)} ${nullable}${defaultVal}`
      );
    });

    console.log("\n✅ Schema verification complete!");

    // Check if all scoring columns exist
    const existingScoring = columns.filter((col: any) =>
      scoringColumns.includes(col.column_name)
    );

    if (existingScoring.length === scoringColumns.length) {
      console.log("✅ All 4 scoring columns present in database");
    } else {
      console.warn(
        `⚠️  Only ${existingScoring.length}/4 scoring columns found:`,
        existingScoring.map((c: any) => c.column_name)
      );
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

verifySchema();
