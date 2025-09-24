#!/usr/bin/env tsx

/**
 * Analyze JSON formatting issues in development database
 */

import { neon } from "@neondatabase/serverless";

async function analyzeJsonIssues() {
  const DEV_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const sql = neon(DEV_DATABASE_URL);

  console.log("Analyzing JSON formatting issues in development database...\n");

  try {
    // Get articles with tool_mentions
    const articles = await sql`
      SELECT id, title, tool_mentions
      FROM articles
      WHERE tool_mentions IS NOT NULL
      LIMIT 5
    `;

    console.log("Sample tool_mentions data:");
    console.log(`=${"=".repeat(59)}`);

    for (const article of articles) {
      console.log(`\nArticle: ${article.title.substring(0, 50)}...`);
      console.log("tool_mentions type:", typeof article.tool_mentions);

      if (typeof article.tool_mentions === "string") {
        console.log("Raw string value (first 200 chars):");
        console.log(article.tool_mentions.substring(0, 200));

        // Try to identify the issue
        if (article.tool_mentions.includes('\\",\\"')) {
          console.log("❌ Issue: Contains escaped quotes that may be double-escaped");
        }
        if (article.tool_mentions.includes('"}"')) {
          console.log("❌ Issue: Malformed JSON ending");
        }

        // Try to parse
        try {
          JSON.parse(article.tool_mentions);
          console.log("✅ Valid JSON, parsed successfully");
        } catch (e) {
          console.log("❌ Invalid JSON:", e.message);

          // Try to fix and parse
          try {
            // Common fix: remove escape characters
            const fixed = article.tool_mentions.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
            JSON.parse(fixed);
            console.log("✅ Fixed by removing escape characters");
          } catch {
            console.log("❌ Still invalid after basic fix");
          }
        }
      } else if (typeof article.tool_mentions === "object") {
        console.log(
          "✅ Already an object:",
          JSON.stringify(article.tool_mentions).substring(0, 100)
        );
      }
    }

    // Count how many have issues
    const allArticles = await sql`
      SELECT id, tool_mentions
      FROM articles
      WHERE tool_mentions IS NOT NULL
    `;

    let validCount = 0;
    let invalidCount = 0;
    let nullCount = 0;

    for (const article of allArticles) {
      if (!article.tool_mentions) {
        nullCount++;
      } else if (typeof article.tool_mentions === "object") {
        validCount++;
      } else if (typeof article.tool_mentions === "string") {
        try {
          JSON.parse(article.tool_mentions);
          validCount++;
        } catch {
          invalidCount++;
        }
      }
    }

    console.log("\n\nSummary:");
    console.log(`=${"=".repeat(59)}`);
    console.log(`Total articles: ${allArticles.length}`);
    console.log(`Valid JSON: ${validCount}`);
    console.log(`Invalid JSON: ${invalidCount}`);
    console.log(`Null values: ${nullCount}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

analyzeJsonIssues();
