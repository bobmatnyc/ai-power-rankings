#!/usr/bin/env tsx

/**
 * Check articles in production database
 */

import { neon } from "@neondatabase/serverless";

async function checkArticles() {
  const PROD_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const sql = neon(PROD_DATABASE_URL);

  console.log("Checking production database articles...\n");

  try {
    // Count articles
    const count = await sql`SELECT COUNT(*) as count FROM articles`;
    console.log(`Total articles in production: ${count[0].count}`);

    // Get sample articles
    if (count[0].count > 0) {
      const articles = await sql`
        SELECT id, title, slug, published_date, status
        FROM articles
        ORDER BY created_at DESC
        LIMIT 5
      `;

      console.log("\nSample articles:");
      console.log(`=${"=".repeat(59)}`);
      for (const article of articles) {
        console.log(`\nID: ${article.id}`);
        console.log(`Title: ${article.title}`);
        console.log(`Slug: ${article.slug}`);
        console.log(`Published: ${article.published_date}`);
        console.log(`Status: ${article.status}`);
      }
    }

    // Check if USE_DATABASE is true in production
    console.log("\n\nNote: For the admin panel to work, make sure:");
    console.log("1. USE_DATABASE=true is set in Vercel");
    console.log("2. DATABASE_URL points to ep-wispy-fog-ad8d4skz");
    console.log("3. The deployment has been restarted after env changes");
  } catch (error) {
    console.error("Error:", error);
  }
}

checkArticles();
