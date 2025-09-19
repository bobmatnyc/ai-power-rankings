#!/usr/bin/env tsx

/**
 * Test Script: Article Database Insert
 * Tests the article save functionality with various edge cases
 */

import { config } from "dotenv";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import type { ArticleIngestionInput } from "@/lib/services/article-ingestion.service";

// Load environment variables
config();

console.log("🧪 Article Database Insert Test Suite");
console.log("=====================================\n");

const service = new ArticleDatabaseService();
let testsPassed = 0;
let testsFailed = 0;

async function runTest(
  name: string,
  input: Omit<ArticleIngestionInput, 'dryRun'>,
  expectSuccess: boolean = true
): Promise<void> {
  console.log(`\n📝 Test: ${name}`);
  console.log("-".repeat(50));

  try {
    // First do a dry run to check preview
    console.log("🔍 Running preview (dry run)...");
    const dryRunInput = { ...input, dryRun: true } as ArticleIngestionInput;
    const preview = await service.ingestArticle(dryRunInput);

    if ("article" in preview) {
      console.log("✅ Preview generated successfully");
      console.log(`   - Title: ${preview.article.title}`);
      console.log(`   - Tools detected: ${Array.isArray(preview.article.toolMentions) ? preview.article.toolMentions.length : 0}`);
      console.log(`   - Companies detected: ${Array.isArray(preview.article.companyMentions) ? preview.article.companyMentions.length : 0}`);
    }

    // Now attempt actual save
    console.log("\n💾 Attempting database save...");
    const saveInput = { ...input, dryRun: false } as ArticleIngestionInput;
    const result = await service.ingestArticle(saveInput);

    if ("id" in result) {
      console.log(`✅ Article saved successfully with ID: ${result.id}`);
      testsPassed++;
    } else {
      throw new Error("Save did not return an article with ID");
    }

    if (!expectSuccess) {
      console.log("⚠️  Test expected to fail but succeeded");
      testsFailed++;
    }
  } catch (error) {
    if (expectSuccess) {
      console.error("❌ Test failed with error:");
      console.error(error instanceof Error ? error.message : error);
      if (error instanceof Error && (error as any).errorDetails) {
        console.error("   Error details:", (error as any).errorDetails);
      }
      testsFailed++;
    } else {
      console.log("✅ Test failed as expected:", error instanceof Error ? error.message : error);
      testsPassed++;
    }
  }
}

async function runTestSuite() {
  // Test 1: Basic text article with minimal data
  await runTest("Basic Text Article", {
    type: "text",
    input:
      "Claude Code is an AI-powered coding assistant that helps developers write better code faster.",
    metadata: {
      author: "Test Author",
    },
  });

  // Test 2: Article with long content
  await runTest("Article with Long Content", {
    type: "text",
    input: "GitHub Copilot revolutionizes coding. ".repeat(500), // ~7000 characters
    metadata: {
      author: "Long Content Test",
    },
  });

  // Test 3: Article with special characters
  await runTest("Article with Special Characters", {
    type: "text",
    input: `AI tools like Claude's "Code Assistant" & GitHub's Copilot are transforming development.
      They handle <complex> code & special chars: @#$%^&*()_+-={}[]|\\:";'<>?,./`,
    metadata: {
      author: "Special Chars Test",
    },
  });

  // Test 4: Article with undefined/null fields (edge case)
  await runTest("Article with Minimal Required Fields", {
    type: "text",
    input: "Cursor is an AI code editor",
    // No metadata provided
  });

  // Test 5: Preprocessed article (from previous preview)
  await runTest("Preprocessed Article", {
    type: "preprocessed",
    preprocessedData: {
      article: {
        title: "Pre-analyzed Article about v0 by Vercel",
        summary: "v0 is a generative UI tool that creates React components from text descriptions",
        content:
          "v0 by Vercel is an innovative AI tool that generates UI components from natural language descriptions. It's particularly useful for rapid prototyping and creating React components with Tailwind CSS styling.",
        tool_mentions: [
          { name: "v0", relevance: 1.0, sentiment: 0.8, context: "Main subject of article" },
          { name: "Vercel", relevance: 0.7, sentiment: 0.6, context: "Creator of v0" },
        ],
        company_mentions: [{ name: "Vercel", relevance: 0.9, context: "Company behind v0" }],
        tags: ["AI", "Code Generation", "UI", "React"],
        category: "AI Tools",
        importance_score: 8,
        overall_sentiment: 0.75,
        source: "Test Source",
        published_date: new Date().toISOString(),
      },
      predictedChanges: [],
      newTools: [],
      newCompanies: [],
    },
  });

  // Test 6: Article with very long title and summary
  await runTest("Article with Long Title and Summary", {
    type: "text",
    input: `${"AI Code Assistant ".repeat(50)} is a revolutionary tool. ${"It helps developers ".repeat(100)}`,
    metadata: {
      author: "Field Length Test",
    },
  });

  // Test 7: Article with invalid JSON in tool mentions (should handle gracefully)
  await runTest("Article with Complex Tool Mentions", {
    type: "text",
    input: `Multiple AI tools are changing development:
        - Claude Code offers intelligent code suggestions
        - GitHub Copilot provides AI pair programming
        - Cursor integrates AI directly into the editor
        - Windsurf brings AI to web development
        - Tabnine offers code completion
        Each tool has unique strengths and use cases.`,
    metadata: {
      author: "Multiple Tools Test",
    },
  });

  // Test 8: Article with unicode and emoji
  await runTest("Article with Unicode and Emoji", {
    type: "text",
    input:
      "AI coding tools 🚀 are amazing! They support múltiple languages: 中文, العربية, हिन्दी, and more. Claude Code 💻 is particularly impressive.",
    metadata: {
      author: "Unicode Test 🌍",
    },
  });

  // Test 9: Empty article (should fail gracefully)
  await runTest(
    "Empty Article",
    {
      type: "text",
      input: "",
      metadata: {
        author: "Empty Test",
      },
    },
    false // Expect this to fail
  );

  // Test 10: Article with extreme sentiment scores
  await runTest("Article with Extreme Analysis Values", {
    type: "preprocessed",
    preprocessedData: {
      article: {
        title: "Extreme Values Test",
        summary: "Testing boundary conditions",
        content: "This tests extreme values in analysis",
        tool_mentions: [
          { name: "TestTool", relevance: 999, sentiment: 999, context: "Extreme values" },
        ],
        company_mentions: [],
        tags: ["test"],
        category: "test",
        importance_score: 999, // Should be clamped to 10
        overall_sentiment: 999, // Should be clamped to 1
        source: "Test",
        published_date: "invalid-date", // Should default to current date
      },
      predictedChanges: [],
      newTools: [],
      newCompanies: [],
    },
  });

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results Summary");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(
    `📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`
  );

  if (testsFailed === 0) {
    console.log("\n🎉 All tests passed! Database insert functionality is working correctly.");
  } else {
    console.log("\n⚠️  Some tests failed. Review the errors above for details.");
    process.exit(1);
  }
}

// Run the test suite
console.log("🚀 Starting test suite...\n");
runTestSuite().catch((error) => {
  console.error("\n💥 Fatal error running test suite:", error);
  process.exit(1);
});
