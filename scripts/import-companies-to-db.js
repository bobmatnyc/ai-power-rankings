#!/usr/bin/env node

/**
 * Import companies from JSON file to database
 * Usage: node scripts/import-companies-to-db.js [--production]
 */

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes("--production");

// Database connection string
const DATABASE_URL = isProduction
  ? "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
  : process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-autumn-glitter-ad1uqvfm.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

console.log(
  `🚀 Starting companies import to ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} database`
);
console.log(`   Database: ${DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown"}`);

async function importCompanies() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    // Connect to database
    console.log("\n📡 Connecting to database...");
    await client.connect();
    console.log("✅ Connected successfully");

    // Read companies JSON file
    console.log("\n📖 Reading companies JSON file...");
    const jsonPath = path.join(__dirname, "..", "data", "json", "companies", "companies.json");
    const jsonContent = fs.readFileSync(jsonPath, "utf8");
    const companiesData = JSON.parse(jsonContent);

    const companies = companiesData.companies;
    console.log(`✅ Found ${companies.length} companies to import`);

    // Clear existing companies (optional - comment out if you want to preserve existing data)
    console.log("\n🗑️  Clearing existing companies...");
    await client.query("DELETE FROM companies");
    console.log("✅ Existing companies cleared");

    // Import each company
    console.log("\n📥 Importing companies...");
    let successCount = 0;
    let errorCount = 0;

    for (const company of companies) {
      try {
        // Generate a proper slug if not present
        const slug =
          company.slug ||
          company.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        // Prepare company data
        const companyData = {
          id: company.id,
          slug: slug,
          name: company.name,
          website: company.website || null,
          founded: company.founded || null,
          size: company.size || null,
          headquarters: company.headquarters || null,
          description: company.description || null,
          created_at: company.created_at || new Date().toISOString(),
          updated_at: company.updated_at || new Date().toISOString(),
        };

        // Convert description if it's a rich text array
        if (Array.isArray(companyData.description)) {
          // Extract text from rich text format
          companyData.description = companyData.description
            .map((block) => block.children?.map((child) => child.text).join(""))
            .join(" ")
            .trim();
        }

        // Store full data in JSONB column
        const fullData = { ...company };
        delete fullData.id; // Remove id from data column since it's a separate column
        delete fullData.slug; // Remove slug from data column
        delete fullData.name; // Remove name from data column

        // Insert into database
        const query = `
          INSERT INTO companies (id, slug, name, data, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
        `;

        await client.query(query, [
          companyData.slug,
          companyData.name,
          JSON.stringify(fullData),
          companyData.created_at,
          companyData.updated_at,
        ]);

        successCount++;
        process.stdout.write(`\r   Imported: ${successCount}/${companies.length} companies`);
      } catch (error) {
        errorCount++;
        console.error(`\n❌ Error importing company "${company.name}":`, error.message);
      }
    }

    console.log(`\n✅ Import completed: ${successCount} successful, ${errorCount} errors`);

    // Verify import
    console.log("\n🔍 Verifying import...");
    const result = await client.query("SELECT COUNT(*) as count FROM companies");
    const count = parseInt(result.rows[0].count, 10);
    console.log(`✅ Database now contains ${count} companies`);

    // Show sample of imported companies
    console.log("\n📊 Sample of imported companies:");
    const sampleResult = await client.query(
      "SELECT slug, name FROM companies ORDER BY name LIMIT 5"
    );
    sampleResult.rows.forEach((row) => {
      console.log(`   - ${row.name} (${row.slug})`);
    });
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n👋 Database connection closed");
  }
}

// Run the import
importCompanies().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
