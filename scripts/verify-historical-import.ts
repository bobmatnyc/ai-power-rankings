#!/usr/bin/env tsx

/**
 * Verify Historical Rankings Import
 * Checks that all historical ranking versions were imported correctly
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function verifyImport() {
  const DATABASE_URL = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL_STAGING or DATABASE_URL environment variable is required");
  }

  const sql = neon(DATABASE_URL);

  console.log("\n📊 Verifying Historical Rankings Import");
  console.log("=" .repeat(50));

  // Get all imported versions
  const versions = await sql`
    SELECT
      version,
      tools_affected,
      created_at,
      created_by,
      LENGTH(rankings_snapshot::text) as data_size
    FROM ranking_versions
    WHERE created_by = 'historical-import'
    ORDER BY version
  `;

  console.log(`\n✅ Imported Versions: ${versions.length}`);
  console.log("");

  for (const v of versions) {
    console.log(`Version: ${v.version}`);
    console.log(`  Tools: ${v.tools_affected}`);
    const date = new Date(v.created_at);
    console.log(`  Created: ${date.toLocaleDateString()}`);
    console.log(`  Data Size: ${(v.data_size / 1024).toFixed(2)} KB`);

    // Get sample rankings from this version
    const versionData = await sql`
      SELECT rankings_snapshot
      FROM ranking_versions
      WHERE version = ${v.version}
    `;

    const rankings = versionData[0].rankings_snapshot;
    console.log(`  Top 3 tools:`);
    rankings.slice(0, 3).forEach((r: any, i: number) => {
      console.log(`    ${i + 1}. ${r.tool_name} (Score: ${r.score.toFixed(2)})`);
    });
    console.log("");
  }

  console.log("=" .repeat(50));
  console.log("✨ Verification complete!");
}

verifyImport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
