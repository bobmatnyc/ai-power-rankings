/**
 * Test script to verify content extraction fixes for 401 errors
 * Tests Jina Reader integration with retry logic and fallback
 */

import { jinaReaderService } from "../lib/services/jina-reader.service";
import { isDomainBlocked, getBlockedDomainsStats } from "../lib/services/blocked-domains.config";

async function testContentExtraction() {
  console.log("=".repeat(60));
  console.log("Content Extraction Fix Test");
  console.log("=".repeat(60));

  // Test URLs - mix of potentially blocked and normal sites
  const testUrls = [
    "https://techcrunch.com/2024/01/15/anthropic-launches-claude-3/",
    "https://reuters.com/technology/artificial-intelligence/",
    "https://arstechnica.com/ai/",
  ];

  console.log("\n1. Checking Jina Reader availability...");
  const isAvailable = jinaReaderService.isAvailable();
  console.log(`   ✓ Jina Reader configured: ${isAvailable}`);

  if (!isAvailable) {
    console.log("   ⚠ JINA_API_KEY not configured. Set it to test Jina Reader.");
    console.log("   Testing will use fallback HTML fetch only.");
  }

  console.log("\n2. Checking blocked domains configuration...");
  const stats = getBlockedDomainsStats();
  console.log(`   ✓ Blocked domains count: ${stats.count}`);
  if (stats.count > 0) {
    console.log(`   ✓ Blocked domains: ${stats.domains.join(", ")}`);
  }

  console.log("\n3. Testing content extraction with retry logic...");
  for (const url of testUrls) {
    console.log(`\n   Testing: ${url}`);

    // Check if domain is blocked
    const isBlocked = isDomainBlocked(url);
    console.log(`   - Domain blocked: ${isBlocked}`);

    if (isBlocked) {
      console.log(`   ⊘ Skipping blocked domain`);
      continue;
    }

    // Try Jina Reader
    if (isAvailable) {
      try {
        console.log(`   - Attempting Jina Reader...`);
        const startTime = Date.now();
        const result = await jinaReaderService.fetchArticle(url);
        const duration = Date.now() - startTime;

        console.log(`   ✓ Success in ${duration}ms`);
        console.log(`   - Content length: ${result.content.length} chars`);
        console.log(`   - Title: ${result.metadata.title || "N/A"}`);
        console.log(`   - Source: ${result.metadata.source || "N/A"}`);
        console.log(`   - Partial: ${result.isPartialContent || false}`);

        if (result.content.length > 100) {
          console.log(`   - Preview: ${result.content.substring(0, 150)}...`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.log(`   ✗ Failed: ${errorMsg}`);

        // Check if it's a 401/403 error
        if (errorMsg.includes("401") || errorMsg.includes("403")) {
          console.log(`   ⚠ Detected blocking (401/403) - domain should be auto-blocked`);
        }
      }
    } else {
      console.log(`   ⊘ Jina Reader not available, skipping`);
    }
  }

  console.log("\n4. Final blocked domains status:");
  const finalStats = getBlockedDomainsStats();
  console.log(`   - Total blocked: ${finalStats.count}`);
  if (finalStats.count > 0) {
    console.log(`   - Domains: ${finalStats.domains.join(", ")}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!");
  console.log("=".repeat(60));
}

// Run test
testContentExtraction().catch((error) => {
  console.error("\n❌ Test failed with error:", error);
  process.exit(1);
});
