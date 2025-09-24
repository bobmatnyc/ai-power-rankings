#!/usr/bin/env tsx

/**
 * Check and compare schemas between dev and prod
 */

import { neon } from "@neondatabase/serverless";

async function checkSchemas() {
  const DEV_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const PROD_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const devSql = neon(DEV_DATABASE_URL);
  const prodSql = neon(PROD_DATABASE_URL);

  console.log("Comparing database schemas...\n");

  try {
    // Get dev schema
    const devColumns = await devSql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'articles'
      ORDER BY ordinal_position
    `;

    // Get prod schema
    const prodColumns = await prodSql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'articles'
      ORDER BY ordinal_position
    `;

    console.log("DEVELOPMENT (ep-bold-sunset) - 79 articles:");
    console.log(`=${"=".repeat(50)}`);
    for (const col of devColumns) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    console.log("\n\nPRODUCTION (ep-wispy-fog) - 0 articles:");
    console.log(`=${"=".repeat(50)}`);
    for (const col of prodColumns) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    // Find differences
    const devColNames = new Set(devColumns.map((c) => c.column_name));
    const prodColNames = new Set(prodColumns.map((c) => c.column_name));

    const onlyInDev = [...devColNames].filter((c) => !prodColNames.has(c));
    const onlyInProd = [...prodColNames].filter((c) => !devColNames.has(c));

    console.log("\n\nDIFFERENCES:");
    console.log(`=${"=".repeat(50)}`);
    if (onlyInDev.length > 0) {
      console.log("Columns only in DEV:", onlyInDev.join(", "));
    }
    if (onlyInProd.length > 0) {
      console.log("Columns only in PROD:", onlyInProd.join(", "));
    }

    if (onlyInDev.length === 0 && onlyInProd.length === 0) {
      console.log("✅ Schemas match!");
    } else {
      console.log("\n⚠️  Schemas are different! Production has the article-ingestion schema.");
      console.log("We need to recreate the articles table with the correct schema.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

checkSchemas();
