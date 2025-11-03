#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Verify Monthly Summaries Table
 * Checks that the table exists and contains data
 */

import { neon } from "@neondatabase/serverless";

// Load environment variables in development
const NODE_ENV = process.env.NODE_ENV || "development";
if (NODE_ENV === "development") {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config({ path: ".env" });
}

async function verifyTable() {
  const DATABASE_URL =
    NODE_ENV === "development"
      ? process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL
      : process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not configured");
    process.exit(1);
  }

  console.log("🔍 Verifying monthly_summaries table...");
  const sql = neon(DATABASE_URL);

  try {
    // Query all summaries
    const summaries = await sql`
      SELECT
        period,
        data_hash,
        metadata,
        generated_at,
        created_at,
        LENGTH(content) as content_length
      FROM monthly_summaries
      ORDER BY period DESC
    `;

    if (summaries.length === 0) {
      console.log("⚠️  Table exists but contains no data");
      console.log("This is expected if no summaries have been generated yet");
    } else {
      console.log(`✅ Found ${summaries.length} monthly summaries in database:\n`);
      summaries.forEach((summary: any) => {
        console.log(`Period: ${summary.period}`);
        console.log(`  Content Length: ${summary.content_length} characters`);
        console.log(`  Data Hash: ${summary.data_hash || "null"}`);
        console.log(
          `  Metadata: ${JSON.stringify(summary.metadata, null, 2).split("\n").join("\n    ")}`
        );
        console.log(`  Generated: ${summary.generated_at}`);
        console.log(`  Created: ${summary.created_at}`);
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

verifyTable().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
