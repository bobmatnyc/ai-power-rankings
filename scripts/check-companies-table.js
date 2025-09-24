#!/usr/bin/env node

/**
 * Check the structure of the companies table
 */

const { Client } = require("pg");

// Production database connection string
const DATABASE_URL =
  "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function checkTable() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    console.log("📡 Connecting to production database...");
    await client.connect();
    console.log("✅ Connected successfully\n");

    // Check if companies table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'companies'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("❌ Companies table does not exist!");
      console.log("\n📝 Creating companies table...");

      // Create the table based on schema-complete.sql
      await client.query(`
        CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          website_url VARCHAR(255),
          headquarters VARCHAR(100),
          founded_year INTEGER,
          company_size VARCHAR(20) CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
          company_type VARCHAR(20) CHECK (company_type IN ('private', 'public', 'open-source', 'non-profit')),
          logo_url VARCHAR(500),
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      console.log("✅ Companies table created successfully");
    }

    // Get table structure
    console.log("📊 Companies table structure:");
    const columns = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'companies'
      ORDER BY ordinal_position;
    `);

    console.log("\nColumns:");
    columns.rows.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : "";
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(`  - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
    });

    // Check current data
    const countResult = await client.query("SELECT COUNT(*) as count FROM companies");
    console.log(`\n📈 Current row count: ${countResult.rows[0].count}`);

    // Show sample data if any exists
    if (parseInt(countResult.rows[0].count, 10) > 0) {
      console.log("\n📋 Sample data (first 3 rows):");
      const sampleData = await client.query("SELECT id, name, slug FROM companies LIMIT 3");
      sampleData.rows.forEach((row) => {
        console.log(`  - ${row.name} (${row.slug})`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
    console.log("\n👋 Connection closed");
  }
}

checkTable();
