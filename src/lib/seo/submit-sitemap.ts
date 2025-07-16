#!/usr/bin/env node

import { config } from "dotenv";
import { GoogleSearchConsole } from "../google-search-console";

// Load environment variables
config({ path: ".env.local" });

async function submitSitemap() {
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aipowerranking.com";

  if (!siteUrl) {
    console.error("❌ GOOGLE_SEARCH_CONSOLE_SITE_URL not configured");
    console.log("Please set the environment variable first");
    process.exit(1);
  }

  try {
    console.log("📤 Submitting sitemap to Google Search Console...");
    console.log(`Site URL: ${siteUrl}`);
    console.log(`Sitemap URL: ${baseUrl}/sitemap.xml`);

    const gsc = new GoogleSearchConsole({ siteUrl });

    await gsc.submitSitemap(`${baseUrl}/sitemap.xml`);

    console.log("✅ Sitemap submitted successfully!");

    // Check submission status
    const sitemaps = await gsc.getSitemaps();
    console.log("\n📊 Current sitemaps:");
    console.log(JSON.stringify(sitemaps, null, 2));
  } catch (error) {
    console.error("❌ Failed to submit sitemap:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  submitSitemap();
}

export { submitSitemap };
