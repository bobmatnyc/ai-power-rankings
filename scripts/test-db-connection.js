#!/usr/bin/env node

/**
 * Test database connection and companies count
 */

// Set environment variables
process.env.NODE_ENV = "production";
process.env.USE_DATABASE = "true";

async function testDatabase() {
  console.log("🔍 Testing Database Connection");
  console.log("   NODE_ENV:", process.env.NODE_ENV);
  console.log("   USE_DATABASE:", process.env.USE_DATABASE);
  console.log("");

  try {
    // Import after setting env variables
    const { testConnection, getDb } = await import("../src/lib/db/connection.ts");
    const { companiesRepository } = await import(
      "../src/lib/db/repositories/companies.repository.ts"
    );

    // Test connection
    console.log("📡 Testing database connection...");
    const connected = await testConnection();

    if (!connected) {
      console.error("❌ Could not connect to database");
      process.exit(1);
    }

    // Count companies
    console.log("\n📊 Counting companies in database...");
    const count = await companiesRepository.count();
    console.log(`   ✅ Found ${count} companies in database`);

    // Get sample companies
    console.log("\n📋 Sample companies:");
    const companies = await companiesRepository.findAll({ limit: 5 });
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name} (${company.slug})`);
    });

    // Check specific company
    console.log("\n🔍 Testing findBySlug...");
    const openai = await companiesRepository.findBySlug("openai");
    if (openai) {
      console.log(`   ✅ Found OpenAI: ${openai.name}`);
    } else {
      console.log("   ❌ OpenAI not found");
    }

    console.log("\n✅ Database connection and repository are working correctly!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error("   Stack:", error.stack);
    process.exit(1);
  }
}

// Run the test
testDatabase().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
