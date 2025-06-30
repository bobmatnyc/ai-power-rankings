#!/usr/bin/env node
import { google } from "googleapis";
import https from "https";
import * as fs from "fs";
import * as path from "path";

const SITE_URL = "https://aipowerrankings.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const CHECK_INTERVAL = 60000; // Check every minute
const MAX_ATTEMPTS = 60; // Try for up to 1 hour

let attempts = 0;

async function checkSiteAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    https
      .get(SITE_URL, { timeout: 10000 }, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302);
      })
      .on("error", () => {
        resolve(false);
      });
  });
}

async function submitSitemap() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/webmasters"],
    });

    const searchconsole = google.searchconsole({
      version: "v1",
      auth,
    });

    console.log("📤 Submitting sitemap to Google Search Console...");

    await searchconsole.sitemaps.submit({
      siteUrl: SITE_URL,
      feedpath: SITEMAP_URL,
    });

    console.log("✅ Sitemap submitted successfully!");

    // Check submission status
    const sitemapList = await searchconsole.sitemaps.list({
      siteUrl: SITE_URL,
    });

    const submittedSitemap = sitemapList.data.sitemap?.find((s) => s.path === SITEMAP_URL);

    if (submittedSitemap) {
      console.log("\n📊 Sitemap Status:");
      console.log(`  - Path: ${submittedSitemap.path}`);
      console.log(`  - Last submitted: ${submittedSitemap.lastSubmitted}`);
      console.log(`  - Last downloaded: ${submittedSitemap.lastDownloaded}`);
      console.log(`  - Warnings: ${submittedSitemap.warnings || 0}`);
      console.log(`  - Errors: ${submittedSitemap.errors || 0}`);
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Failed to submit sitemap:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function monitorAndSubmit() {
  console.log("🔍 Monitoring site availability...");
  console.log(`📍 Site: ${SITE_URL}`);
  console.log(`📄 Sitemap: ${SITEMAP_URL}`);
  console.log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000} seconds`);
  console.log(`🔄 Max attempts: ${MAX_ATTEMPTS}\n`);

  const checkSite = async () => {
    attempts++;
    console.log(`[${new Date().toLocaleTimeString()}] Attempt ${attempts}/${MAX_ATTEMPTS}`);

    const isAvailable = await checkSiteAvailability();

    if (isAvailable) {
      console.log("✅ Site is now available!");

      // Wait a bit for sitemap to be fully available
      console.log("⏳ Waiting 10 seconds for sitemap to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const success = await submitSitemap();

      if (success) {
        console.log("\n🎉 Sitemap submission completed successfully!");

        // Save a success marker
        const successFile = path.join(process.cwd(), "sitemap-submitted.json");
        fs.writeFileSync(
          successFile,
          JSON.stringify(
            {
              siteUrl: SITE_URL,
              sitemapUrl: SITEMAP_URL,
              submittedAt: new Date().toISOString(),
            },
            null,
            2
          )
        );

        console.log(`📝 Success details saved to: ${successFile}`);
      }

      process.exit(0);
    } else {
      console.log("❌ Site not available yet...");

      if (attempts >= MAX_ATTEMPTS) {
        console.error("\n⏰ Maximum attempts reached. Site is still not available.");
        console.error("Please check:");
        console.error("  1. DNS configuration");
        console.error("  2. Vercel deployment status");
        console.error("  3. Domain settings");
        process.exit(1);
      }

      // Schedule next check
      setTimeout(checkSite, CHECK_INTERVAL);
    }
  };

  // Start monitoring
  checkSite();
}

// Create a simple status script
const statusScript = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const statusFile = path.join(process.cwd(), 'sitemap-submitted.json');

if (fs.existsSync(statusFile)) {
  const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  console.log('✅ Sitemap submission status:');
  console.log(\`  - Site: \${status.siteUrl}\`);
  console.log(\`  - Sitemap: \${status.sitemapUrl}\`);
  console.log(\`  - Submitted at: \${status.submittedAt}\`);
} else {
  console.log('❌ Sitemap not yet submitted');
  console.log('Run: npm run sitemap:monitor to start monitoring');
}
`;

// Save the status check script
fs.writeFileSync(path.join(process.cwd(), "src/scripts/check-sitemap-status.js"), statusScript);

// Main execution
console.log("🚀 Sitemap Monitor and Submitter");
console.log("================================\n");

monitorAndSubmit().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
