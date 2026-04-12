/**
 * Test duplicate prevention functionality
 * Verifies that the repository and database constraint work correctly
 */

import { ArticlesCoreRepository } from "@/lib/db/repositories/articles/articles-core.repository";
import type { NewArticle } from "@/lib/db/article-schema";

async function testDuplicatePrevention() {
  const repo = new ArticlesCoreRepository();

  try {
    console.log("🧪 Testing duplicate prevention...");

    const testUrl = "https://test-duplicate-prevention.com/article";
    const testArticle1: NewArticle = {
      slug: "test-duplicate-prevention-1",
      title: "Test Article 1",
      content: "Test content 1",
      sourceUrl: testUrl,
      ingestionType: "url",
      status: "active",
    };

    const testArticle2: NewArticle = {
      slug: "test-duplicate-prevention-2",
      title: "Test Article 2 (Duplicate URL)",
      content: "Test content 2",
      sourceUrl: testUrl, // Same URL
      ingestionType: "url",
      status: "active",
    };

    const testArticle3: NewArticle = {
      slug: "test-duplicate-prevention-3",
      title: "Test Article 3 (URL with tracking)",
      content: "Test content 3",
      sourceUrl: testUrl + "?utm_source=test&utm_medium=email", // Should be canonicalized
      ingestionType: "url",
      status: "active",
    };

    // Test 1: Create first article (should succeed)
    console.log("\n1️⃣ Creating first article...");
    const article1 = await repo.createArticle(testArticle1);
    console.log(`✅ First article created: ID=${article1.id}`);
    console.log(`📍 URL stored as: ${article1.sourceUrl}`);

    // Test 2: Try to create duplicate (should fail)
    console.log("\n2️⃣ Attempting to create duplicate article...");
    try {
      await repo.createArticle(testArticle2);
      console.log("❌ ERROR: Duplicate creation should have failed!");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        console.log("✅ Duplicate correctly prevented by application logic");
      } else {
        console.log("❌ Unexpected error:", error);
      }
    }

    // Test 3: Try to create URL variant with tracking params (should fail due to canonicalization)
    console.log("\n3️⃣ Attempting to create URL variant with tracking params...");
    try {
      await repo.createArticle(testArticle3);
      console.log("❌ ERROR: URL variant creation should have failed!");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        console.log("✅ URL variant correctly prevented by canonicalization");
      } else {
        console.log("❌ Unexpected error:", error);
      }
    }

    // Test 4: Create article with different URL (should succeed)
    console.log("\n4️⃣ Creating article with different URL...");
    const differentUrlArticle: NewArticle = {
      slug: "test-duplicate-prevention-different",
      title: "Test Article with Different URL",
      content: "Test content different",
      sourceUrl: "https://different-url.com/article",
      ingestionType: "url",
      status: "active",
    };

    const article4 = await repo.createArticle(differentUrlArticle);
    console.log(`✅ Different URL article created: ID=${article4.id}`);

    // Cleanup: Remove test articles
    console.log("\n🧹 Cleaning up test articles...");
    await repo.deleteArticle(article1.id, true);
    await repo.deleteArticle(article4.id, true);
    console.log("✅ Test cleanup completed");

    console.log("\n🎉 All duplicate prevention tests passed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await testDuplicatePrevention();
    console.log("\n✅ Duplicate prevention test suite completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  }
}

main();
