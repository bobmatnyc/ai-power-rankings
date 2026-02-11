/**
 * Quick script to check recent articles in the database
 * for diagnosing cron job execution
 */
import { getDb } from "../lib/db/connection";
import { sql } from "drizzle-orm";

async function checkRecentArticles() {
  try {
    const db = getDb();
    if (!db) {
      console.log("Database not available");
      return;
    }

    // Get count of all articles
    const countResult = await db.execute(sql`SELECT count(*) FROM articles`);
    console.log("\n=== DATABASE ARTICLE STATISTICS ===");
    console.log("Total articles in database:", countResult.rows[0]?.count || 0);

    // Get most recent 10 articles
    const recentArticles = await db.execute(
      sql`SELECT id, title, source_url, created_at, updated_at, published_date, ingestion_type
          FROM articles
          ORDER BY created_at DESC
          LIMIT 10`
    );

    console.log("\n=== MOST RECENT ARTICLES ===");
    if (recentArticles.rows.length === 0) {
      console.log("No articles found in database!");
    } else {
      recentArticles.rows.forEach((article: Record<string, unknown>, i: number) => {
        const title = article.title as string;
        console.log(
          "\n" + (i + 1) + ". " + (title?.substring(0, 70) || "No title") + "..."
        );
        console.log("   Created: " + article.created_at);
        console.log("   Published: " + article.published_date);
        console.log("   Type: " + article.ingestion_type);
      });
    }

    // Get articles from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await db.execute(
      sql`SELECT count(*) FROM articles WHERE created_at > ${sevenDaysAgo.toISOString()}`
    );

    console.log("\n=== RECENT ACTIVITY ===");
    console.log("Articles created in last 7 days:", recentCount.rows[0]?.count || 0);

    // Check automated ingestion runs using raw SQL
    console.log("\n=== AUTOMATED INGESTION RUNS ===");
    try {
      const ingestionRuns = await db.execute(
        sql`SELECT id, status, started_at, completed_at, articles_discovered, articles_ingested,
                   articles_skipped, articles_skipped_semantic, error_log
            FROM automated_ingestion_runs
            ORDER BY started_at DESC
            LIMIT 10`
      );

      if (ingestionRuns.rows.length === 0) {
        console.log("No automated ingestion runs found!");
      } else {
        ingestionRuns.rows.forEach((run: Record<string, unknown>, i: number) => {
          console.log(`\n${i + 1}. Run ID: ${run.id}`);
          console.log(`   Started: ${run.started_at}`);
          console.log(`   Completed: ${run.completed_at}`);
          console.log(`   Status: ${run.status}`);
          console.log(`   Articles Discovered: ${run.articles_discovered}`);
          console.log(`   Articles Ingested: ${run.articles_ingested}`);
          console.log(`   Articles Skipped: ${run.articles_skipped}`);
          console.log(`   Semantic Skipped: ${run.articles_skipped_semantic}`);
          if (run.error_log) {
            const errLog = JSON.stringify(run.error_log);
            console.log(`   Error Log: ${errLog.substring(0, 500)}`);
          }
        });
      }
    } catch (runError) {
      console.log("Could not query ingestion runs:", (runError as Error).message);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkRecentArticles();
