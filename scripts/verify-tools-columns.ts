#!/usr/bin/env tsx

/**
 * Verify Tools Table Columns
 * Quick check to confirm scoring columns exist in production
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function verifyToolsColumns() {
  const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

  if (!PROD_DATABASE_URL) {
    console.error("❌ Production database URL not found");
    process.exit(1);
  }

  const sql = neon(PROD_DATABASE_URL);

  console.log("\n📊 Checking tools table columns in PRODUCTION\n");

  try {
    // Get all columns from tools table
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

    // Check for original scoring columns (from migration 0003)
    const originalScoringColumns = [
      'baseline_score',
      'delta_score',
      'current_score',
      'score_updated_at'
    ];

    // Check for modality-specific scoring columns (reasoning, image, video, audio)
    const modalityScoringColumns = [
      'reasoning_score',
      'reasoning_score_reasoning',
      'image_score',
      'image_score_reasoning',
      'video_score',
      'video_score_reasoning',
      'audio_score',
      'audio_score_reasoning'
    ];

    const allScoringColumns = [...originalScoringColumns, ...modalityScoringColumns];
    const foundScoringColumns = columns.filter((col: any) =>
      allScoringColumns.includes(col.column_name)
    );

    console.log("\n🎯 Scoring Columns Analysis:");
    console.log("═══════════════════════════════════════════════════════════");

    if (foundScoringColumns.length === 0) {
      console.log("❌ NO scoring columns found");
      console.log("\n   Expected columns:");
      allScoringColumns.forEach(col => console.log(`     - ${col}`));
      console.log("\n   ⚠️  Migration 0003 may need to be applied to production");
    } else {
      console.log(`✅ Found ${foundScoringColumns.length} scoring columns:\n`);

      // Check original scoring columns
      const foundOriginal = foundScoringColumns.filter((col: any) =>
        originalScoringColumns.includes(col.column_name)
      );
      if (foundOriginal.length > 0) {
        console.log("   Original scoring columns (migration 0003):");
        foundOriginal.forEach((col: any) => {
          console.log(`     ✓ ${col.column_name} (${col.data_type})`);
        });
      }

      // Check modality scoring columns
      const foundModality = foundScoringColumns.filter((col: any) =>
        modalityScoringColumns.includes(col.column_name)
      );
      if (foundModality.length > 0) {
        console.log("\n   Modality-specific scoring columns:");
        foundModality.forEach((col: any) => {
          console.log(`     ✓ ${col.column_name} (${col.data_type})`);
        });
      }

      // Check for missing expected columns
      const missingColumns = allScoringColumns.filter(expected =>
        !foundScoringColumns.find((col: any) => col.column_name === expected)
      );

      if (missingColumns.length > 0) {
        console.log("\n   ⚠️  Missing expected columns:");
        missingColumns.forEach(col => console.log(`     - ${col}`));
      } else {
        console.log("\n   ✅ All expected scoring columns are present");
      }
    }

    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

verifyToolsColumns();
