#!/usr/bin/env node

import { GoogleSearchConsole } from "../lib/google-search-console";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

async function testSearchConsole() {
  const siteUrl = process.env["GOOGLE_SEARCH_CONSOLE_SITE_URL"];

  if (!siteUrl) {
    console.error("❌ GOOGLE_SEARCH_CONSOLE_SITE_URL not configured");
    process.exit(1);
  }

  console.log("🔍 Testing Google Search Console connection...");
  console.log(`Site URL: ${siteUrl}`);

  try {
    const gsc = new GoogleSearchConsole({ siteUrl });

    // Test 1: Get site metrics
    console.log("\n📊 Fetching site metrics...");
    const metrics = await gsc.getSiteMetrics();
    console.log("Current period clicks:", metrics.current.clicks);
    console.log("Current period impressions:", metrics.current.impressions);
    console.log("Current period CTR:", metrics.current.ctr.toFixed(2) + "%");
    console.log("Current period avg position:", metrics.current.position.toFixed(1));

    // Test 2: Get current sitemaps
    console.log("\n🗺️  Fetching current sitemaps...");
    const sitemaps = await gsc.getSitemaps();
    console.log(`Found ${sitemaps.length} sitemap(s):`);
    sitemaps.forEach((sitemap) => {
      console.log(`- ${sitemap.path}`);
      console.log(`  Status: ${sitemap.isSitemapsIndex ? "Index" : "Sitemap"}`);
      console.log(`  Last submitted: ${sitemap.lastSubmitted}`);
      console.log(`  Last downloaded: ${sitemap.lastDownloaded}`);
    });

    // Test 3: Get top queries
    console.log("\n🔍 Fetching top queries...");
    const queries = await gsc.getTopQueries(5);
    if (queries.rows && queries.rows.length > 0) {
      console.log("Top 5 search queries:");
      queries.rows.forEach((row, index: number) => {
        console.log(
          `${index + 1}. "${row.keys[0]}" - ${row.clicks} clicks, ${row.impressions} impressions`
        );
      });
    } else {
      console.log("No query data available yet");
    }

    console.log("\n✅ Google Search Console connection successful!");
  } catch (error) {
    console.error("\n❌ Failed to connect to Google Search Console:", error);

    if (error instanceof Error) {
      if (error.message.includes("invalid_grant")) {
        console.log("\n💡 To fix this, run: gcloud auth application-default login");
        console.log("   Then select the Google account that has access to Search Console");
      }
    }

    process.exit(1);
  }
}

// Run the test
testSearchConsole();
