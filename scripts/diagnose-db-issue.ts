#!/usr/bin/env npx tsx

/**
 * Standalone Database Diagnostic Script
 *
 * This script tests the database connection and queries that are failing in production.
 * It helps identify the specific cause of the "Failed query" error.
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

interface DiagnosticResult {
  test: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  details?: any;
  error?: string;
}

const results: DiagnosticResult[] = [];

function logResult(result: DiagnosticResult) {
  results.push(result);
  const statusIcon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⏭️";
  console.log(`${statusIcon} ${result.test}: ${result.message}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  if (result.details) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
  }
}

async function runDiagnostics() {
  console.log("🔍 Running Database Diagnostics...\n");

  // Test 1: Environment Variables
  console.log("=== ENVIRONMENT VARIABLES ===");

  const dbUrl = process.env.DATABASE_URL;
  const useDb = process.env.USE_DATABASE;

  logResult({
    test: "Environment Setup",
    status: dbUrl && useDb === "true" ? "PASS" : "FAIL",
    message: `DATABASE_URL: ${dbUrl ? "configured" : "missing"}, USE_DATABASE: ${useDb}`,
    details: {
      DATABASE_URL_EXISTS: !!dbUrl,
      DATABASE_URL_LENGTH: dbUrl?.length || 0,
      DATABASE_URL_PREFIX: dbUrl?.substring(0, 30) || "not set",
      USE_DATABASE: useDb,
      NODE_ENV: process.env.NODE_ENV || "not set",
    },
  });

  if (!dbUrl || useDb !== "true") {
    logResult({
      test: "Database Connection",
      status: "SKIP",
      message: "Skipping connection tests - database not configured",
    });
    return;
  }

  // Test 2: Neon Import
  console.log("\n=== NEON IMPORT ===");

  try {
    const { neon } = await import("@neondatabase/serverless");
    logResult({
      test: "Neon Import",
      status: "PASS",
      message: "Successfully imported @neondatabase/serverless",
    });

    // Test 3: Connection Creation
    console.log("\n=== CONNECTION CREATION ===");

    try {
      const sql = neon(dbUrl);
      logResult({
        test: "Neon Client Creation",
        status: "PASS",
        message: "Neon client created successfully",
      });

      // Test 4: Basic Query
      console.log("\n=== BASIC QUERIES ===");

      try {
        const timeResult = await sql`SELECT NOW() as current_time, version() as pg_version`;
        logResult({
          test: "Basic Query",
          status: "PASS",
          message: "SELECT NOW() query successful",
          details: {
            serverTime: timeResult?.[0]?.current_time,
            version: timeResult?.[0]?.pg_version?.substring(0, 50) + "...",
          },
        });

        // Test 5: Schema Check
        console.log("\n=== SCHEMA VERIFICATION ===");

        try {
          const tables = await sql`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
          `;

          logResult({
            test: "Schema Check",
            status: "PASS",
            message: `Found ${tables.length} tables in public schema`,
            details: tables.map((t: any) => ({ name: t.table_name, type: t.table_type })),
          });

          // Test 6: Articles Table Check
          const hasArticlesTable = tables.some((t: any) => t.table_name === "articles");

          if (hasArticlesTable) {
            try {
              // This is the query that's failing in production
              const countResult = await sql`SELECT COUNT(*) as count FROM articles`;
              logResult({
                test: "Articles Count Query",
                status: "PASS",
                message: `Articles table has ${countResult[0]?.count} rows`,
                details: { count: countResult[0]?.count },
              });

              // Test 7: Articles Order By Query (the failing query)
              console.log("\n=== ARTICLES QUERIES (PRODUCTION FAILURE) ===");

              try {
                const articlesQuery = await sql`
                  SELECT id, title, published_date, status
                  FROM articles
                  ORDER BY published_date DESC
                  LIMIT 5
                `;

                logResult({
                  test: "Articles Order By Query",
                  status: "PASS",
                  message: "Successfully queried articles with ORDER BY published_date DESC",
                  details: {
                    rowCount: articlesQuery.length,
                    firstRow: articlesQuery[0]
                      ? {
                          id: articlesQuery[0].id,
                          title: articlesQuery[0].title?.substring(0, 50),
                          published_date: articlesQuery[0].published_date,
                          status: articlesQuery[0].status,
                        }
                      : null,
                  },
                });

                // Test 8: Articles with Status Filter
                try {
                  const statusQuery = await sql`
                    SELECT id, title, status
                    FROM articles
                    WHERE status = 'active'
                    ORDER BY published_date DESC
                    LIMIT 10
                  `;

                  logResult({
                    test: "Articles Status Filter Query",
                    status: "PASS",
                    message: `Found ${statusQuery.length} active articles`,
                    details: { activeCount: statusQuery.length },
                  });
                } catch (statusError) {
                  logResult({
                    test: "Articles Status Filter Query",
                    status: "FAIL",
                    message: "Failed to query articles with status filter",
                    error: statusError instanceof Error ? statusError.message : String(statusError),
                  });
                }
              } catch (orderError) {
                logResult({
                  test: "Articles Order By Query",
                  status: "FAIL",
                  message: "Failed to query articles with ORDER BY - THIS IS THE PRODUCTION ERROR",
                  error: orderError instanceof Error ? orderError.message : String(orderError),
                });
              }
            } catch (countError) {
              logResult({
                test: "Articles Count Query",
                status: "FAIL",
                message: "Failed to count articles",
                error: countError instanceof Error ? countError.message : String(countError),
              });
            }
          } else {
            logResult({
              test: "Articles Table Existence",
              status: "FAIL",
              message: "Articles table not found in schema",
            });
          }
        } catch (schemaError) {
          logResult({
            test: "Schema Check",
            status: "FAIL",
            message: "Failed to query information_schema",
            error: schemaError instanceof Error ? schemaError.message : String(schemaError),
          });
        }
      } catch (queryError) {
        logResult({
          test: "Basic Query",
          status: "FAIL",
          message: "Failed to execute basic query",
          error: queryError instanceof Error ? queryError.message : String(queryError),
        });
      }
    } catch (connectionError) {
      logResult({
        test: "Neon Client Creation",
        status: "FAIL",
        message: "Failed to create Neon client",
        error: connectionError instanceof Error ? connectionError.message : String(connectionError),
      });
    }
  } catch (importError) {
    logResult({
      test: "Neon Import",
      status: "FAIL",
      message: "Failed to import @neondatabase/serverless",
      error: importError instanceof Error ? importError.message : String(importError),
    });
  }

  // Test 9: Drizzle Connection
  console.log("\n=== DRIZZLE ORM ===");

  try {
    const { getDb } = await import("../src/lib/db/connection");
    const db = getDb();

    if (db) {
      logResult({
        test: "Drizzle Connection",
        status: "PASS",
        message: "Drizzle ORM connection established",
      });

      // Test Drizzle query
      try {
        const { articles } = await import("../src/lib/db/article-schema");
        const { sql: drizzleSql } = await import("drizzle-orm");

        const drizzleResult = await db.select({ count: drizzleSql`count(*)` }).from(articles);
        logResult({
          test: "Drizzle Query",
          status: "PASS",
          message: `Drizzle query successful: ${drizzleResult[0]?.count} articles`,
          details: { count: drizzleResult[0]?.count },
        });
      } catch (drizzleQueryError) {
        logResult({
          test: "Drizzle Query",
          status: "FAIL",
          message: "Drizzle query failed",
          error:
            drizzleQueryError instanceof Error
              ? drizzleQueryError.message
              : String(drizzleQueryError),
        });
      }
    } else {
      logResult({
        test: "Drizzle Connection",
        status: "FAIL",
        message: "getDb() returned null",
      });
    }
  } catch (drizzleError) {
    logResult({
      test: "Drizzle Connection",
      status: "FAIL",
      message: "Failed to load Drizzle connection",
      error: drizzleError instanceof Error ? drizzleError.message : String(drizzleError),
    });
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log("\n🚨 FAILURES:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`  - ${r.test}: ${r.error || r.message}`);
      });
  }

  console.log("\n💡 RECOMMENDATIONS:");

  if (!dbUrl) {
    console.log("  - Set DATABASE_URL environment variable");
  }
  if (useDb !== "true") {
    console.log("  - Set USE_DATABASE=true environment variable");
  }
  if (failed === 0 && passed > 0) {
    console.log("  - Database connection appears healthy locally");
    console.log("  - The issue may be specific to production environment:");
    console.log("    • Check Vercel environment variables");
    console.log("    • Verify Neon database is not paused");
    console.log("    • Check for connection pool limits");
    console.log("    • Verify database permissions");
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);
