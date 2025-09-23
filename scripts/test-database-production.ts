#!/usr/bin/env npx tsx

/**
 * Production Database Connection Test
 * Tests database connectivity and table existence
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const DATABASE_URL = process.env["DATABASE_URL"];

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function success(msg: string) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg: string) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function info(msg: string) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

function warning(msg: string) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

async function testDatabase() {
  console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════╗
║            PRODUCTION DATABASE CONNECTION TEST               ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Check DATABASE_URL
  if (!DATABASE_URL) {
    error("DATABASE_URL not found in environment variables");
    return;
  }

  if (DATABASE_URL.includes("YOUR_PASSWORD")) {
    error("DATABASE_URL contains placeholder password");
    return;
  }

  info(`Database URL configured: ${DATABASE_URL.substring(0, 30)}...`);

  try {
    // Create connection
    const sql = neon(DATABASE_URL);
    success("Database client created");

    // Test basic connection
    console.log("\n" + colors.bright + "Testing connection..." + colors.reset);
    const connectionTest = await sql`SELECT NOW() as current_time, version() as pg_version`;
    success("Connected to PostgreSQL");
    console.log("Server time:", connectionTest[0].current_time);
    console.log("PostgreSQL version:", connectionTest[0].pg_version);

    // Check for articles table
    console.log("\n" + colors.bright + "Checking tables..." + colors.reset);
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      warning("No tables found in public schema");
    } else {
      success(`Found ${tables.length} tables:`);
      tables.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Check if articles table exists
    const articlesTableExists = tables.some((t: any) => t.table_name === "articles");

    if (articlesTableExists) {
      success("Articles table exists!");

      // Get table structure
      console.log("\n" + colors.bright + "Articles table structure:" + colors.reset);
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'articles'
        ORDER BY ordinal_position
      `;

      columns.forEach((col: any) => {
        console.log(
          `  ${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "NOT NULL" : ""}`
        );
      });

      // Count articles
      const countResult = await sql`SELECT COUNT(*) as count FROM articles`;
      info(`Articles in database: ${countResult[0].count}`);

      // Get sample articles
      if (Number(countResult[0].count) > 0) {
        console.log("\n" + colors.bright + "Recent articles:" + colors.reset);
        const articles = await sql`
          SELECT id, title, published_date, created_at
          FROM articles
          ORDER BY created_at DESC
          LIMIT 3
        `;

        articles.forEach((article: any) => {
          console.log(`  - ${article.title}`);
          console.log(`    Published: ${article.published_date}, Created: ${article.created_at}`);
        });
      }
    } else {
      warning("Articles table does not exist!");

      // Check for migration table
      const migrationsExist = tables.some(
        (t: any) => t.table_name === "__drizzle_migrations" || t.table_name === "drizzle_migrations"
      );

      if (!migrationsExist) {
        error("No migration table found. Database migrations have not been run.");
        console.log("\n" + colors.yellow + "To fix this, run:" + colors.reset);
        console.log("  pnpm run db:push   # Push schema to database");
        console.log("  OR");
        console.log("  pnpm run db:migrate # Run migrations");
      } else {
        info("Migration table exists, but articles table is missing");
        console.log("Checking migration status...");

        try {
          const migrations = await sql`
            SELECT * FROM drizzle_migrations
            ORDER BY created_at DESC
            LIMIT 5
          `;

          if (migrations.length > 0) {
            console.log("Recent migrations:");
            migrations.forEach((m: any) => {
              console.log(`  - ${m.hash}: ${m.created_at}`);
            });
          }
        } catch (err) {
          // Try alternate table name
          try {
            const migrations = await sql`
              SELECT * FROM __drizzle_migrations
              ORDER BY created_at DESC
              LIMIT 5
            `;

            if (migrations.length > 0) {
              console.log("Recent migrations:");
              migrations.forEach((m: any) => {
                console.log(`  - ${m.id}: ${m.created_at}`);
              });
            }
          } catch (err2) {
            warning("Could not read migration table");
          }
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    success("Database test complete!");
  } catch (err: any) {
    error(`Database connection failed: ${err.message}`);

    if (err.message.includes("does not exist")) {
      info("The database might not be created yet");
    } else if (err.message.includes("password")) {
      info("Authentication failed. Check DATABASE_URL credentials");
    } else if (err.message.includes("timeout")) {
      info("Connection timeout. Check network and firewall settings");
    }
  }
}

testDatabase().catch(console.error);
