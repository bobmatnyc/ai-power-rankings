/**
 * Test script for Jina.ai Reader Service
 *
 * Usage:
 *   npx ts-node scripts/test-jina-reader.ts [url]
 *
 * Example:
 *   npx ts-node scripts/test-jina-reader.ts https://techcrunch.com/2024/01/15/ai-news-article
 */

import { jinaReaderService } from "../lib/services/jina-reader.service";

async function testJinaReader(url: string) {
  console.log("=== Jina.ai Reader Service Test ===\n");

  // Check if service is available
  console.log("1. Checking service availability...");
  const available = jinaReaderService.isAvailable();
  console.log(`   Available: ${available ? "✅ Yes" : "❌ No"}`);

  if (!available) {
    console.log("\n⚠️  JINA_API_KEY not configured in environment");
    console.log("   Set JINA_API_KEY in .env.local to test");
    process.exit(1);
  }

  // Test fetch article
  console.log("\n2. Fetching article from URL...");
  console.log(`   URL: ${url}`);

  try {
    const startTime = Date.now();
    const result = await jinaReaderService.fetchArticle(url);
    const duration = Date.now() - startTime;

    console.log(`   ✅ Success! (${duration}ms)`);

    // Display results
    console.log("\n3. Content:");
    console.log(`   Length: ${result.content.length} characters`);
    console.log(`   Preview: ${result.content.substring(0, 200)}...`);

    console.log("\n4. Metadata:");
    console.log(`   Title: ${result.metadata.title || "(not extracted)"}`);
    console.log(`   Author: ${result.metadata.author || "(not extracted)"}`);
    console.log(`   Published: ${result.metadata.publishedDate || "(not extracted)"}`);
    console.log(`   Source: ${result.metadata.source || "(not extracted)"}`);
    console.log(`   Description: ${result.metadata.description ? result.metadata.description.substring(0, 100) + "..." : "(not extracted)"}`);

    // Health check
    console.log("\n5. Running health check...");
    const healthy = await jinaReaderService.healthCheck();
    console.log(`   Health: ${healthy ? "✅ Healthy" : "❌ Unhealthy"}`);

    console.log("\n=== Test Complete ===");
    process.exit(0);

  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);

    if (error instanceof Error) {
      console.log(`\nError details:`);
      console.log(error.stack);
    }

    console.log("\n=== Test Failed ===");
    process.exit(1);
  }
}

// Get URL from command line or use default
const testUrl = process.argv[2] || "https://example.com";

testJinaReader(testUrl);
