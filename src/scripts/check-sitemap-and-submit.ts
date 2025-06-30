#!/usr/bin/env node
import { google } from "googleapis";
import https from "https";
import * as fs from "fs";
import * as path from "path";

const SITE_URL = "https://aipowerrankings.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

async function checkSitemapAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`🔍 Checking sitemap accessibility at ${SITEMAP_URL}...`);

    https
      .get(SITEMAP_URL, { timeout: 30000 }, (res) => {
        console.log(`📊 Response status: ${res.statusCode}`);

        if (res.statusCode === 200) {
          console.log("✅ Sitemap is accessible!");

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            // Check if it's valid XML
            if (data.includes("<?xml") && data.includes("<urlset")) {
              console.log("✅ Sitemap contains valid XML");
              console.log(`📊 Sitemap size: ${data.length} bytes`);

              // Count URLs
              const urlCount = (data.match(/<url>/g) || []).length;
              console.log(`📊 Number of URLs in sitemap: ${urlCount}`);

              // Save sitemap locally for inspection
              const localPath = path.join(process.cwd(), "sitemap-backup.xml");
              fs.writeFileSync(localPath, data);
              console.log(`💾 Sitemap saved locally to: ${localPath}`);

              resolve(true);
            } else {
              console.error("❌ Response is not a valid XML sitemap");
              resolve(false);
            }
          });
        } else {
          console.error(`❌ Sitemap not accessible. Status: ${res.statusCode}`);
          resolve(false);
        }
      })
      .on("error", (err) => {
        console.error("❌ Error accessing sitemap:", err.message);
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

    console.log("🔐 Authenticating with Google Search Console...");

    // First, verify we have access to the site
    try {
      const siteList = await searchconsole.sites.list();
      console.log("✅ Successfully authenticated!");

      const sites = siteList.data.siteEntry || [];
      const ourSite = sites.find(
        (site) => site.siteUrl === SITE_URL || site.siteUrl === `${SITE_URL}/`
      );

      if (!ourSite) {
        console.error(`❌ Site ${SITE_URL} not found in Search Console`);
        console.log(
          "Available sites:",
          sites.map((s) => s.siteUrl)
        );
        return;
      }

      console.log(`✅ Site verified in Search Console: ${ourSite.siteUrl}`);
    } catch (error) {
      console.error(
        "❌ Failed to list sites:",
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    // Submit the sitemap
    console.log(`📤 Submitting sitemap: ${SITEMAP_URL}`);

    try {
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

        if (submittedSitemap.contents) {
          submittedSitemap.contents.forEach((content) => {
            console.log(
              `  - ${content.type}: ${content.submitted} submitted, ${content.indexed} indexed`
            );
          });
        }
      }
    } catch (error) {
      console.error(
        "❌ Failed to submit sitemap:",
        error instanceof Error ? error.message : String(error)
      );

      const err = error as { response?: { data?: unknown } };
      if (err.response?.data) {
        console.error("Error details:", JSON.stringify(err.response.data, null, 2));
      }

      // Try to get existing sitemap info
      console.log("\n🔍 Checking existing sitemaps...");
      try {
        const sitemapList = await searchconsole.sitemaps.list({
          siteUrl: SITE_URL,
        });

        if (sitemapList.data.sitemap && sitemapList.data.sitemap.length > 0) {
          console.log("📊 Existing sitemaps:");
          sitemapList.data.sitemap.forEach((s) => {
            console.log(`  - ${s.path} (submitted: ${s.lastSubmitted})`);
          });
        } else {
          console.log("📊 No existing sitemaps found");
        }
      } catch (listError) {
        console.error("Failed to list sitemaps:", listError);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  console.log("🚀 Sitemap Checker and Submitter");
  console.log("================================\n");

  // First check if sitemap is accessible
  const isAccessible = await checkSitemapAccess();

  if (isAccessible) {
    console.log("\n🎯 Proceeding with sitemap submission...\n");
    await submitSitemap();
  } else {
    console.log("\n❌ Cannot submit sitemap - it's not accessible");
    console.log("🔧 Please ensure:");
    console.log("  1. The site is deployed and accessible");
    console.log("  2. The sitemap.ts file is properly configured");
    console.log("  3. The Next.js build includes the sitemap");
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
