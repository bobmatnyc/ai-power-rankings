#!/usr/bin/env node

/**
 * Verify companies in database
 * Usage: node scripts/verify-companies-db.js [--production]
 */

const { Client } = require("pg");

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes("--production");

// Database connection string
const DATABASE_URL = isProduction
  ? "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
  : process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-autumn-glitter-ad1uqvfm.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

console.log(`🔍 Verifying companies in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} database`);
console.log(`   Database: ${DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown"}`);

async function verifyCompanies() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    // Connect to database
    console.log("\n📡 Connecting to database...");
    await client.connect();
    console.log("✅ Connected successfully");

    // Count companies
    console.log("\n📊 Company Statistics:");
    const countResult = await client.query("SELECT COUNT(*) as count FROM companies");
    const count = parseInt(countResult.rows[0].count);
    console.log(`   Total companies: ${count}`);

    // List all companies
    console.log("\n📋 All companies in database:");
    const allResult = await client.query("SELECT slug, name, data FROM companies ORDER BY name");
    allResult.rows.forEach((row, index) => {
      const data = row.data || {};
      console.log(`   ${index + 1}. ${row.name} (slug: ${row.slug})`);
      if (data.id) {
        console.log(`      - Original ID: ${data.id}`);
      }
      if (data.website) {
        console.log(`      - Website: ${data.website}`);
      }
    });

    // Check for specific companies that should exist
    console.log("\n✔️ Checking key companies:");
    const keyCompanies = ["openai", "anthropic", "google", "microsoft", "github"];
    for (const slug of keyCompanies) {
      const result = await client.query("SELECT name FROM companies WHERE slug = $1", [slug]);
      if (result.rows.length > 0) {
        console.log(`   ✅ ${slug}: ${result.rows[0].name}`);
      } else {
        console.log(`   ❌ ${slug}: NOT FOUND`);
      }
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n👋 Database connection closed");
  }
}

// Run the verification
verifyCompanies().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
