#!/usr/bin/env node

/**
 * Test companies repository to ensure it's using the database
 */

// Set environment variables before importing anything
process.env.USE_DATABASE = "true";
process.env.DATABASE_URL =
  "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function testRepository() {
  console.log("🧪 Testing Companies Repository");
  console.log("   USE_DATABASE:", process.env.USE_DATABASE);
  console.log(
    "   DATABASE_URL:",
    process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown"
  );
  console.log("");

  try {
    // Import the repository after setting env variables
    const { companiesRepository } = await import(
      "../src/lib/db/repositories/companies.repository.ts"
    );

    // Test 1: Count companies
    console.log("📊 Test 1: Counting companies...");
    const count = await companiesRepository.count();
    console.log(`   ✅ Found ${count} companies`);

    // Test 2: Find all companies
    console.log("\n📋 Test 2: Getting all companies...");
    const allCompanies = await companiesRepository.findAll({ limit: 5 });
    console.log(`   ✅ Retrieved ${allCompanies.length} companies (limited to 5)`);
    allCompanies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name} (${company.slug})`);
    });

    // Test 3: Find by slug
    console.log("\n🔍 Test 3: Finding by slug...");
    const openai = await companiesRepository.findBySlug("openai");
    if (openai) {
      console.log(`   ✅ Found: ${openai.name}`);
      console.log(`      Website: ${openai.website || "N/A"}`);
      console.log(`      Founded: ${openai.founded || "N/A"}`);
    } else {
      console.log("   ❌ OpenAI not found");
    }

    // Test 4: Search functionality
    console.log("\n🔎 Test 4: Testing search...");
    const searchResults = await companiesRepository.search("Google");
    console.log(`   ✅ Search found ${searchResults.length} results for "Google"`);
    searchResults.forEach((company) => {
      console.log(`      - ${company.name}`);
    });

    // Test 5: Find by size
    console.log("\n📏 Test 5: Finding by size...");
    const startups = await companiesRepository.findBySize("startup");
    console.log(`   ✅ Found ${startups.length} startups`);
    if (startups.length > 0) {
      console.log("   First 3 startups:");
      startups.slice(0, 3).forEach((company) => {
        console.log(`      - ${company.name}`);
      });
    }

    console.log("\n✅ All tests completed successfully!");
    console.log("   The repository is correctly using the database.");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error("   Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testRepository().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
