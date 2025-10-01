#!/usr/bin/env tsx

/**
 * Verify Tools Table Columns in Development
 * Quick check to see what columns exist in dev
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function verifyDevToolsColumns() {
  const DEV_DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  if (!DEV_DATABASE_URL) {
    console.error("❌ Development database URL not found");
    process.exit(1);
  }

  const sql = neon(DEV_DATABASE_URL);

  console.log("\n📊 Checking tools table columns in DEVELOPMENT\n");

  try {
    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'tools'
      ORDER BY ordinal_position;
    `;

    console.log("All columns in tools table:");
    console.log("═══════════════════════════════════════════════════════════");
    columns.forEach((col: any) => {
      console.log(`  ${col.column_name.padEnd(35)} | ${col.data_type.padEnd(25)} | Nullable: ${col.is_nullable}`);
    });

    const scoringColumns = [
      'baseline_score',
      'delta_score',
      'current_score',
      'score_updated_at',
      'reasoning_score',
      'reasoning_score_reasoning',
      'image_score',
      'image_score_reasoning',
      'video_score',
      'video_score_reasoning',
      'audio_score',
      'audio_score_reasoning'
    ];

    const foundScoringColumns = columns.filter((col: any) =>
      scoringColumns.includes(col.column_name)
    );

    console.log("\n🎯 Scoring Columns:");
    console.log("═══════════════════════════════════════════════════════════");
    if (foundScoringColumns.length > 0) {
      foundScoringColumns.forEach((col: any) => {
        console.log(`  ✓ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log("  ❌ No scoring columns found");
    }

    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyDevToolsColumns();
