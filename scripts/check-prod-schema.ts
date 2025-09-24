#!/usr/bin/env tsx

/**
 * Check the schema of production articles table
 */

import { neon } from "@neondatabase/serverless";

async function checkSchema() {
  const PROD_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const sql = neon(PROD_DATABASE_URL);

  console.log("Checking production database schema...\n");

  try {
    // Get column information for articles table
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'articles'
      ORDER BY ordinal_position
    `;

    console.log("Articles table columns in production:");
    console.log(`=${"=".repeat(59)}`);

    for (const col of columns) {
      console.log(
        `${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "NOT NULL" : "NULL"}`
      );
    }

    console.log("\nTotal columns:", columns.length);
  } catch (error) {
    console.error("Error:", error);
  }
}

checkSchema();
