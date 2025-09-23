#!/usr/bin/env tsx

/**
 * Script to check if database tables exist
 * Helps diagnose article loading issues
 */

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.production.local" });
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function checkDatabaseTables() {
  const DATABASE_URL = process.env["DATABASE_URL"];

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not configured");
    process.exit(1);
  }

  if (DATABASE_URL.includes("YOUR_PASSWORD")) {
    console.error("❌ DATABASE_URL contains placeholder password");
    process.exit(1);
  }

  console.log("🔍 Checking Database Tables...\n");

  const dbUrl = new URL(DATABASE_URL);
  console.log(`Database Host: ${dbUrl.hostname}`);
  console.log(`Database Name: ${dbUrl.pathname.slice(1)}\n`);

  try {
    const sql = neon(DATABASE_URL);

    // Check if articles table exists
    console.log("Checking for articles table...");
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log("\nExisting tables:");
    tablesResult.forEach((row) => {
      const tableName = row.table_name;
      const isArticleRelated = tableName.includes("article");
      console.log(
        `  ${isArticleRelated ? "✅" : "  "} ${tableName}${isArticleRelated ? " (article-related)" : ""}`
      );
    });

    const hasArticlesTable = tablesResult.some((row) => row.table_name === "articles");
    const hasArticleRankingsChanges = tablesResult.some(
      (row) => row.table_name === "article_rankings_changes"
    );
    const hasArticleProcessingLogs = tablesResult.some(
      (row) => row.table_name === "article_processing_logs"
    );

    console.log("\n📊 Article Tables Status:");
    console.log(`  articles: ${hasArticlesTable ? "✅ Exists" : "❌ Missing"}`);
    console.log(
      `  article_rankings_changes: ${hasArticleRankingsChanges ? "✅ Exists" : "❌ Missing"}`
    );
    console.log(
      `  article_processing_logs: ${hasArticleProcessingLogs ? "✅ Exists" : "❌ Missing"}`
    );

    if (hasArticlesTable) {
      // Check articles count
      console.log("\nChecking articles table...");
      const countResult = await sql`SELECT COUNT(*) as count FROM articles`;
      console.log(`  Total articles: ${countResult[0].count}`);

      // Check table structure
      const columnsResult = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'articles'
        ORDER BY ordinal_position;
      `;

      console.log("\n  Key columns:");
      const keyColumns = ["id", "slug", "title", "content", "status", "created_at"];
      columnsResult.forEach((col) => {
        if (keyColumns.includes(col.column_name)) {
          console.log(
            `    ${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "(required)" : "(nullable)"}`
          );
        }
      });

      // Try to fetch a sample article
      try {
        const sampleResult = await sql`
          SELECT id, slug, title, status, created_at
          FROM articles
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (sampleResult.length > 0) {
          console.log("\n  Most recent article:");
          const article = sampleResult[0];
          console.log(`    ID: ${article.id}`);
          console.log(`    Title: ${article.title}`);
          console.log(`    Status: ${article.status}`);
          console.log(`    Created: ${article.created_at}`);
        }
      } catch (error) {
        console.log(
          "\n  ❌ Error fetching sample article:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    if (!hasArticlesTable || !hasArticleRankingsChanges || !hasArticleProcessingLogs) {
      console.log("\n⚠️  Missing tables detected!");
      console.log("Run the following command to create the tables:");
      console.log("\n  npm run db:push\n");
      console.log("Or if migrations exist:");
      console.log("\n  npm run db:migrate\n");
    } else {
      console.log("\n✅ All article tables exist!");
      console.log("\nIf articles still aren't loading, the issue might be:");
      console.log("  1. Authentication/authorization in the API");
      console.log("  2. Client-side error handling");
      console.log("  3. Network/CORS issues");
    }
  } catch (error) {
    console.error(
      "\n❌ Database connection error:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.message.includes("does not exist")) {
      console.log("\n⚠️  The database or tables don't exist.");
      console.log("You need to run database migrations or push the schema.");
    }
  }
}

// Run the check
checkDatabaseTables().catch(console.error);
