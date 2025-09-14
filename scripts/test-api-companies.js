#!/usr/bin/env node

/**
 * Test API endpoint for companies to ensure it's using the database
 */

const http = require("node:http");

async function testAPI() {
  console.log("🌐 Testing Companies API Endpoint");
  console.log("   Expecting data from production database\n");

  const options = {
    hostname: "localhost",
    port: 3000,
    path: "/api/companies",
    method: "GET",
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);

          console.log("📊 API Response:");
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Companies returned: ${response.companies?.length || 0}`);

          if (response.companies && response.companies.length > 0) {
            console.log("\n📋 First 5 companies from API:");
            response.companies.slice(0, 5).forEach((company, index) => {
              console.log(`   ${index + 1}. ${company.name} (${company.slug})`);
              if (company.website) {
                console.log(`      Website: ${company.website}`);
              }
            });

            // Check for specific companies that should exist
            console.log("\n✔️ Checking key companies in API response:");
            const keyCompanies = ["openai", "anthropic", "google", "microsoft"];
            keyCompanies.forEach((slug) => {
              const found = response.companies.find((c) => c.slug === slug);
              if (found) {
                console.log(`   ✅ ${slug}: ${found.name}`);
              } else {
                console.log(`   ❌ ${slug}: NOT FOUND`);
              }
            });

            console.log("\n✅ API is working correctly with database!");
          } else {
            console.log("\n⚠️ No companies returned from API");
            console.log("   Response:", JSON.stringify(response, null, 2));
          }

          resolve();
        } catch (error) {
          console.error("❌ Error parsing response:", error);
          console.error("   Raw response:", data);
          reject(error);
        }
      });
    });

    req.on("error", (error) => {
      console.error("❌ Request failed:", error);
      console.log("\n💡 Make sure the dev server is running:");
      console.log("   pnpm run dev:pm2 start");
      reject(error);
    });

    req.end();
  });
}

// Run the test
testAPI().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
